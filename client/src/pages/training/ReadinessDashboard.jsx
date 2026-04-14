import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../../utils/api';

const ACCENT = '#22D3EE';

function ReadinessGauge({ percent = 0, size = 140 }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 75 ? ACCENT : percent >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2A2A2E" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: size, height: size,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.22, fontWeight: 700, color: '#F5F5F5',
        }}>
          {percent}%
        </div>
      </div>
      <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
        Overall Readiness
      </p>
    </div>
  );
}

function DomainBar({ domain, percent, questionsAnswered }) {
  const color = percent >= 75 ? ACCENT : percent >= 60 ? '#F59E0B' : '#EF4444';
  const tooFew = questionsAnswered < 10;

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <div className="row-between" style={{ marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.9375rem' }}>{domain}</span>
        {tooFew ? (
          <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Answer more to unlock</span>
        ) : (
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color }}>{percent}%</span>
        )}
      </div>
      <div style={{ height: 6, backgroundColor: '#2A2A2E', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: tooFew ? '0%' : `${percent}%`,
          backgroundColor: tooFew ? '#2A2A2E' : color,
          borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function ReadinessDashboard() {
  const { certLevel } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/training/readiness/${certLevel}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [certLevel]);

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
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

  // Server returns { readiness: { overall_readiness_percent, domain_readiness, ... } }
  const raw = data?.readiness || data || {};
  const cert_name = certLevel;
  const readiness = Math.round(raw.overall_readiness_percent || 0);
  const estimated_pass = raw.estimated_pass || false;
  const domainReadiness = raw.domain_readiness || {};
  const domains = Object.entries(domainReadiness).map(([domain, percent]) => ({
    domain,
    percent: Math.round(percent || 0),
    questionsAnswered: 10, // assume enough if domain exists
  }));
  const session_count = raw.sessions_count || 0;
  const last_session_date = raw.last_updated_at || null;
  const study_streak = 0; // not tracked yet
  const recommended_action = domains.length > 0 ? `Focus on ${domains.sort((a, b) => a.percent - b.percent)[0]?.domain}` : null;
  const recommended_action_label = recommended_action ? 'Start Drill' : null;
  const recommended_action_path = recommended_action ? `/training/${certLevel}/exam?mode=weak_area_drill` : null;

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate(`/training/${certLevel}`)} style={{ padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          &larr; Back to {cert_name}
        </button>
        <h1>Readiness</h1>
      </div>

      <div className="stack">
        {/* Gauge */}
        <div className="card" style={{ textAlign: 'center' }}>
          <ReadinessGauge percent={readiness} />
          {estimated_pass && (
            <div style={{
              marginTop: '1rem',
              padding: '0.625rem 1rem',
              backgroundColor: 'rgba(51,204,51,0.1)',
              border: '1px solid rgba(51,204,51,0.3)',
              borderRadius: 8,
              color: ACCENT,
              fontWeight: 700,
              fontSize: '1rem',
            }}>
              EXAM READY
            </div>
          )}
        </div>

        {/* Domain breakdown */}
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>Domain Breakdown</h3>
          {domains.map((d) => (
            <DomainBar
              key={d.domain}
              domain={d.domain}
              percent={d.percent}
              questionsAnswered={d.questions_answered}
            />
          ))}
          {domains.length === 0 && (
            <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>
              Complete some practice to see domain breakdown.
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>Study Stats</h3>
          <div className="stack-sm">
            <div className="row-between">
              <span className="text-secondary">Sessions completed</span>
              <span style={{ fontWeight: 600 }}>{session_count}</span>
            </div>
            <div className="row-between">
              <span className="text-secondary">Last session</span>
              <span style={{ fontWeight: 600 }}>
                {last_session_date ? new Date(last_session_date).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="row-between">
              <span className="text-secondary">Study streak</span>
              <span style={{ fontWeight: 600, color: study_streak >= 3 ? ACCENT : '#F5F5F5' }}>
                {study_streak} day{study_streak !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Recommended action */}
        {recommended_action && (
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Recommended Next</h3>
            <p className="text-secondary" style={{ fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
              {recommended_action}
            </p>
            {recommended_action_path && (
              <button
                className="btn btn-primary btn-block"
                onClick={() => navigate(recommended_action_path)}
              >
                {recommended_action_label || 'Go'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
