import { useEffect, useRef, useState } from 'react';
import { recognizeFace } from '../lib/api';
import '../components/CaptureInput.css';
import './FormPage.css';
import './Verify.css';

const INTERVAL_MS = 1500; // how often a frame is checked
const FRAME_WIDTH = 640; // frames are downscaled to this width before upload

function stamp() {
  return new Date().toLocaleTimeString('en-GB');
}

// "2407190100044 .............. present"
function dotted(name) {
  return `${name} ${'.'.repeat(Math.max(4, 26 - name.length))} `;
}

export default function Verify() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const termRef = useRef(null);
  const busyRef = useRef(false);
  const seenRef = useRef(new Set()); // names already printed this session
  const lastUnknownRef = useRef(0);
  const lastErrorRef = useRef(0);

  const [running, setRunning] = useState(true);
  const [camError, setCamError] = useState('');
  const [lines, setLines] = useState([
    { t: stamp(), kind: 'dim', text: 'scanner ready. waiting for faces...' }
  ]);

  function addLine(kind, text) {
    setLines((prev) => [...prev, { t: stamp(), kind, text }].slice(-200));
  }

  // camera starts automatically
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      } catch {
        setCamError('Camera unavailable — allow camera access, then reload the page.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // check a frame every INTERVAL_MS while running
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(scan, INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // keep the newest line in view
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  async function scan() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (busyRef.current || !video || !canvas || !video.videoWidth) return;
    busyRef.current = true;
    try {
      const scale = Math.min(1, FRAME_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) return;

      const res = await recognizeFace(new File([blob], 'frame.jpg', { type: 'image/jpeg' }), true);

      for (const face of res.faces) {
        if (face.name === 'Unknown') {
          if (Date.now() - lastUnknownRef.current > 5000) {
            lastUnknownRef.current = Date.now();
            addLine('dim', 'unknown face ... not in roster');
          }
          continue;
        }
        if (seenRef.current.has(face.name)) continue;
        seenRef.current.add(face.name);
        const fresh = res.logged.includes(face.name);
        addLine('ok', `${dotted(face.name)}present${fresh ? '' : ' (already logged today)'}`);
      }
    } catch (err) {
      if (Date.now() - lastErrorRef.current > 10000) {
        lastErrorRef.current = Date.now();
        addLine('err', `error: ${err.message || 'backend not reachable'}`);
      }
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className="container form-page">
      <div className="form-page-head">
        <span className="hero-eyebrow">Live attendance</span>
        <h1>Stand in front of the camera</h1>
        <p>Each recognised face is marked present automatically and written to the access log.</p>
      </div>

      <div className="form-grid">
        <div className="card">
          <div className="capture">
            <div className="capture-frame">
              <video ref={videoRef} className="capture-video" muted playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="capture-corner tl" />
              <div className="capture-corner tr" />
              <div className="capture-corner bl" />
              <div className="capture-corner br" />
            </div>
            <div className="capture-controls">
              <button type="button" className="btn btn-outline" onClick={() => setRunning((r) => !r)}>
                {running ? 'Pause scanning' : 'Resume scanning'}
              </button>
            </div>
            {camError && <div className="alert alert-error">{camError}</div>}
          </div>
        </div>

        <div className="card term-card">
          <div className="term-head">
            <span className={`term-dot ${running ? 'on' : ''}`} />
            attendance — {running ? 'live' : 'paused'}
          </div>
          <div className="term" ref={termRef}>
            {lines.map((l, i) => (
              <div key={i} className={`term-line ${l.kind}`}>
                <span className="term-t">[{l.t}]</span> {l.kind === 'ok' ? '> ' : ''}
                {l.text}
              </div>
            ))}
            <span className="term-cursor">▌</span>
          </div>
        </div>
      </div>
    </div>
  );
}
