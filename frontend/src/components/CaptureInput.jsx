import { useEffect, useRef, useState } from 'react';
import './CaptureInput.css';

/**
 * Lets the person supply an image either by turning on their camera and
 * taking a still, or by choosing a file. Reports the chosen image back
 * as a File plus an object URL for preview.
 */
export default function CaptureInput({ onCapture, previewUrl }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState('idle'); // idle | camera | error
  const [error, setError] = useState('');

  useEffect(() => {
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // <video> only exists once mode === 'camera', so attach the stream after it mounts
  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [mode]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setMode('camera'); // <video> mounts now; effect above attaches the stream
    } catch (err) {
      setError('Camera unavailable — allow access or upload a photo instead.');
      setMode('error');
    }
  }

  function takeSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        onCapture(file, URL.createObjectURL(blob));
        stopStream();
        setMode('idle');
      },
      'image/jpeg',
      0.92
    );
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopStream();
    setMode('idle');
    onCapture(file, URL.createObjectURL(file));
  }

  return (
    <div className="capture">
      <div className="capture-frame">
        {mode === 'camera' ? (
          <video ref={videoRef} className="capture-video" muted playsInline />
        ) : previewUrl ? (
          <img src={previewUrl} alt="Selected" className="capture-video" />
        ) : (
          <div className="capture-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M9 4h6l1.5 2H20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5L9 4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span>{error || 'No image selected yet'}</span>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="capture-corner tl" />
        <div className="capture-corner tr" />
        <div className="capture-corner bl" />
        <div className="capture-corner br" />
      </div>

      <div className="capture-controls">
        {mode === 'camera' ? (
          <button type="button" className="btn btn-amber" onClick={takeSnapshot}>
            Capture still
          </button>
        ) : (
          <button type="button" className="btn btn-outline" onClick={startCamera}>
            Use camera
          </button>
        )}
        <label className="btn btn-ghost">
          Upload photo
          <input type="file" accept="image/*" onChange={handleFile} hidden />
        </label>
      </div>
    </div>
  );
}