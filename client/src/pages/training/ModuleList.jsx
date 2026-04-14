import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiGet } from '../../utils/api';

function StatusBadge({ status, score }) {
  if (status === 'passed') return <span className="badge badge-green">Passed</span>;
  if (status === 'needs_review') return <span className="badge badge-red">Needs Review</span>;
  if (status === 'in_progress') return <span className="badge badge-amber">In Progress</span>;
  return <span className="badge badge-gray">Not Started</span>;
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ModuleList() {
  const { certLevel } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/training/modules/${certLevel}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [certLevel]);

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
        <p className="spinner-message">Loading modules...</p>
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

  const { cert_name, modules = [], passed_count = 0, total_count = 0, readiness = 0 } = data || {};

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/training')} style={{ padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          &larr; Back to Training
        </button>
        <h1>{cert_name}</h1>
        <div className="row-between" style={{ marginTop: '0.375rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            {passed_count} of {total_count} modules passed · {readiness}% ready
          </p>
          <Link to={`/training/${certLevel}/readiness`} style={{ fontSize: '0.875rem' }}>
            Readiness &rarr;
          </Link>
        </div>
      </div>

      <div className="stack">
        {modules.map((mod, i) => (
          <button
            key={mod.id}
            className="card"
            style={{
              textAlign: 'left',
              cursor: mod.locked ? 'not-allowed' : 'pointer',
              opacity: mod.locked ? 0.55 : 1,
              border: 'none',
              width: '100%',
            }}
            onClick={() => !mod.locked && navigate(`/training/${certLevel}/${mod.id}`)}
            disabled={mod.locked}
          >
            <div className="row-between" style={{ marginBottom: '0.5rem' }}>
              <div className="row" style={{ gap: '0.5rem' }}>
                {mod.locked && <LockIcon />}
                <span className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  Module {i + 1}
                </span>
              </div>
              <StatusBadge status={mod.status} score={mod.last_score} />
            </div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.375rem' }}>{mod.title}</h3>
            <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
              <span className="text-muted" style={{ fontSize: '0.8125rem' }}>~{mod.estimated_minutes} min</span>
              <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{mod.topic_count} topics</span>
              <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{mod.sections_read}/{mod.sections_total} sections</span>
              {mod.last_score != null && (
                <span className="text-secondary" style={{ fontSize: '0.8125rem' }}>
                  Last: {mod.last_score}%
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button
          className="btn btn-secondary btn-block"
          onClick={() => navigate(`/training/${certLevel}/exam`)}
        >
          Exams & Practice
        </button>
      </div>
    </div>
  );
}
