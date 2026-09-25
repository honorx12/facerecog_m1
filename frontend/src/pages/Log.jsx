import { useEffect, useState } from 'react';
import { getAttendanceRoster, setRosterStatus, exportAttendance, emailAttendance } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import './Log.css';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Log() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState(null);
  const [pending, setPending] = useState(new Map()); // name -> unsaved status
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(''); // '' | 'saving' | 'exporting' | 'emailing'
  const { isTeacher } = useAuth();

  useEffect(() => {
    setRows(null);
    setPending(new Map());
    setError('');
    setNotice('');
    getAttendanceRoster(date)
      .then(setRows)
      .catch((err) => setError(err.message || 'Could not load the roster.'));
  }, [date]);

  function effectiveStatus(row) {
    return pending.has(row.name) ? pending.get(row.name) : row.status;
  }

  function setStatus(name, status) {
    setPending((prev) => new Map(prev).set(name, status));
  }

  const total = rows?.length || 0;
  const present = rows ? rows.filter((r) => effectiveStatus(r) === 'present').length : 0;
  const absent = total - present;

  async function handleReset() {
    setPending(new Map());
    setNotice('');
    setError('');
  }

  async function handleSubmit() {
    if (pending.size === 0) {
      setNotice('Nothing to save — mark a student present or absent first.');
      return;
    }
    setBusy('saving');
    setError('');
    setNotice('');
    try {
      const updates = await Promise.all(
        [...pending.entries()].map(([name, status]) => setRosterStatus(name, date, status))
      );
      const byName = new Map(updates.map((u) => [u.name, u]));
      setRows((prev) =>
        prev.map((r) => (byName.has(r.name) ? { ...r, status: byName.get(r.name).status, id: byName.get(r.name).id, time: byName.get(r.name).time } : r))
      );
      setPending(new Map());
      try {
        await emailAttendance(date);
        setNotice('Saved and emailed to the teacher.');
      } catch (mailErr) {
        setNotice(`Saved. Email not sent — ${mailErr.message}`);
      }
    } catch (err) {
      setError(err.message || 'Could not save attendance.');
    } finally {
      setBusy('');
    }
  }

  async function handleExport() {
    setBusy('exporting');
    setError('');
    setNotice('');
    try {
      await exportAttendance(date);
    } catch (err) {
      setError(err.message || 'Could not export the sheet.');
    } finally {
      setBusy('');
    }
  }

  async function handleEmailOnly() {
    setBusy('emailing');
    setError('');
    setNotice('');
    try {
      const res = await emailAttendance(date);
      setNotice(`Sent to ${res.sent_to}.`);
    } catch (err) {
      setError(err.message || 'Could not send the email.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="container form-page">
      <div className="form-page-head roster-head">
        <div>
          <span className="hero-eyebrow">Access log</span>
          <h1>Mark attendance</h1>
          <p>Auto-detected students are ticked present already — override anyone by hand, then save.</p>
        </div>
        <input
          type="date"
          className="date-select"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {!isTeacher && (
        <div className="alert" style={{ marginBottom: 20 }}>
          Viewing only. <a href="/login">Sign in as teacher or developer</a> to mark attendance, export, or email.
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}
      {notice && <div className="alert alert-success" style={{ marginBottom: 20 }}>{notice}</div>}

      {rows && rows.length === 0 && (
        <div className="empty-state card">Nobody's enrolled yet — add students on the Roster page first.</div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="log-stats">
            <div className="log-stat">
              <span className="log-stat-value">{total}</span>
              <span className="log-stat-label">Total students</span>
            </div>
            <div className="log-stat log-stat-present">
              <span className="log-stat-value">{present}</span>
              <span className="log-stat-label">Present</span>
            </div>
            <div className="log-stat log-stat-absent">
              <span className="log-stat-value">{absent}</span>
              <span className="log-stat-label">Absent</span>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table className="table log-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Time</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = effectiveStatus(r);
                  const dirty = pending.has(r.name);
                  return (
                    <tr key={r.name} className={dirty ? 'log-row-dirty' : ''}>
                      <td style={{ fontFamily: 'var(--font-body)' }}>{r.name}</td>
                      <td>{r.time || '—'}</td>
                      <td>
                        <label className="log-radio">
                          <input
                            type="radio"
                            name={`status-${r.name}`}
                            checked={status === 'present'}
                            disabled={!isTeacher}
                            onChange={() => setStatus(r.name, 'present')}
                          />
                          Present
                        </label>
                        <label className="log-radio">
                          <input
                            type="radio"
                            name={`status-${r.name}`}
                            checked={status === 'absent'}
                            disabled={!isTeacher}
                            onChange={() => setStatus(r.name, 'absent')}
                          />
                          Absent
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isTeacher && (
            <div className="log-actions">
              <button type="button" className="btn btn-amber" onClick={handleSubmit} disabled={busy !== ''}>
                {busy === 'saving' ? <span className="spinner" /> : null}
                Submit &amp; send attendance
              </button>
              <button type="button" className="btn btn-outline" onClick={handleExport} disabled={busy !== ''}>
                {busy === 'exporting' ? <span className="spinner" /> : null}
                Export attendance
              </button>
              <button type="button" className="btn btn-outline" onClick={handleEmailOnly} disabled={busy !== ''}>
                {busy === 'emailing' ? <span className="spinner" /> : null}
                Email attendance
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleReset} disabled={busy !== '' || pending.size === 0}>
                Reset
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
