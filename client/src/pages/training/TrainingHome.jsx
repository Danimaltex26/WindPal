import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../utils/api';

const ACCENT = '#22D3EE';

function CircularProgress({ size = 56, stroke = 5, percent = 0 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 75 ? ACCENT : percent >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2A2A2E" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.24, fontWeight: 700, color: '#F5F5F5',
      }}>
        {percent}%
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B6B73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CertCard({ cert, onNavigate }) {
  const isLocked = cert.locked;
  const notStarted = !isLocked && cert.readiness === 0 && !cert.in_progress;
  const inProgress = !isLocked && cert.in_progress;
  const examReady = !isLocked && cert.readiness >= (cert.pass_threshold || 75);

  return (
    <div className="card" style={{ opacity: isLocked ? 0.6 : 1 }}>
      <div className="row-between">
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
            {isLocked && <LockIcon />}
            <h3 style={{ fontSize: '1rem' }}>{cert.name}</h3>
          </div>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            {cert.module_count} modules · ~{cert.estimated_hours} hours
          </p>
          {isLocked && (
            <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.375rem' }}>
              {cert.lock_reason}
            </p>
          )}
          {examReady && (
            <span className="badge badge-green" style={{ marginTop: '0.5rem' }}>EXAM READY</span>
          )}
        </div>
        <CircularProgress percent={cert.readiness || 0} />
      </div>
      {!isLocked && (
        <div style={{ marginTop: '0.75rem' }}>
          {notStarted && (
            <button className="btn btn-primary btn-block" onClick={() => onNavigate(cert.key)}>
              Start
            </button>
          )}
          {inProgress && (
            <button className="btn btn-primary btn-block" onClick={() => onNavigate(cert.key)}>
              Continue — {cert.progress_label || `${cert.readiness}% ready`}
            </button>
          )}
          {!notStarted && !inProgress && (
            <button className="btn btn-secondary btn-block" onClick={() => onNavigate(cert.key)}>
              View Modules
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrainingHome() {
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet('/training/path')
      .then(setPath)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function goTo(certKey) {
    navigate(`/training/${certKey}`);
  }

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
        <p className="spinner-message">Loading certification paths...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  const ladder = path?.path || path?.ladder || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Training</h1>
        <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
          Wind energy certification paths
        </p>
      </div>

      <div className="stack">
        {ladder.map((cert, i) => (
          <div key={cert.key}>
            <CertCard cert={cert} onNavigate={goTo} />
            {i < ladder.length - 1 && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 2, height: 24, backgroundColor: '#2A2A2E' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
