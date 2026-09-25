import { supabase } from './supabaseClient';

const BASE = '/api';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* no JSON body */
    }
    throw new Error(detail);
  }
  return res.json();
}

export function getHealth() {
  return fetch(`${BASE}/health`).then(handle);
}

export function listFaces() {
  return fetch(`${BASE}/faces`).then(handle);
}

export async function registerFace(name, file) {
  const form = new FormData();
  form.append('name', name);
  form.append('file', file);
  return fetch(`${BASE}/register`, { method: 'POST', body: form, headers: await authHeaders() }).then(handle);
}

export async function renameStudent(name, newName) {
  return fetch(`${BASE}/faces/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ new_name: newName })
  }).then(handle);
}

export async function deleteStudent(name) {
  return fetch(`${BASE}/faces/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: await authHeaders()
  }).then(handle);
}

export function recognizeFace(file, markAttendance = true) {
  const form = new FormData();
  form.append('file', file);
  form.append('mark_attendance', String(markAttendance));
  return fetch(`${BASE}/recognize`, { method: 'POST', body: form }).then(handle);
}

export function getAttendance(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetch(`${BASE}/attendance${qs}`).then(handle);
}

export function getAttendanceDates() {
  return fetch(`${BASE}/attendance/dates`).then(handle);
}

export async function setAttendanceStatus(id, status) {
  return fetch(`${BASE}/attendance/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ status })
  }).then(handle);
}

export async function deleteAttendance(id) {
  return fetch(`${BASE}/attendance/${id}`, { method: 'DELETE', headers: await authHeaders() }).then(handle);
}

// ---- full-roster attendance grid (every enrolled name, present or absent) ----

export function getAttendanceRoster(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetch(`${BASE}/attendance/roster${qs}`).then(handle);
}

export async function setRosterStatus(name, date, status) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetch(`${BASE}/attendance/roster/${encodeURIComponent(name)}${qs}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ status })
  }).then(handle);
}

// Requires teacher auth, so this can't be a plain <a href> — fetch as a blob
// and trigger the save ourselves.
export async function exportAttendance(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${BASE}/attendance/export${qs}`, { headers: await authHeaders() });
  if (!res.ok) return handle(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${date || 'today'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function emailAttendance(date, to) {
  return fetch(`${BASE}/attendance/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ date, to })
  }).then(handle);
}

// Sign in via Supabase Auth directly, then ask the backend which role this
// account has (from the `profiles` table) so the UI can gate pages.
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` }
  });
  const me = await handle(res);
  return { email: data.user.email, role: me.role };
}
