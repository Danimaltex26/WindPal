import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../../utils/api';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExamScoreReport() {
  const { certLevel, attemptId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/training/exam/score/${attemptId}`)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

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

  const {
    passed = false,
    score = 0,
    correct = 0,
    total = 0,
    pass_threshold = 70,
    domains = [],
    time_seconds = null,
    previous_attempts = [],
    weakest_domain = null,
  } = report || {};

  const sorted = [...domains].sort((a, b) => a.percent - b.percent);

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate(`/training/${certLevel}/exam`)} style={{ padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          &larr; Back to Exams
        </button>
      </div>

      <div className="stack">
        {/* Main score */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 100, height: 100,
            borderRadius: '50%',
            border: `4px solid ${passed ? '#22D3EE' : '#EF4444'}`,
            marginBottom: '0.75rem',
          }}>
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: passed ? '#22D3EE' : '#EF4444',
            }}>
              {passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>
            {correct} / {total} — {score}%
          </p>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Pass threshold: {pass_threshold}%
          </p>
        </div>

        {/* Domain breakdown */}
        {sorted.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Domain Breakdown</h3>
            <div style={{ fontSize: '0.8125rem', color: '#6B6B73', marginBottom: '0.5rem' }}>
              <div className="row-between">
                <span>Domain</span>
                <span>Score · vs Pass</span>
              </div>
            </div>
            {sorted.map((d) => {
              const diff = d.percent - pass_threshold;
              return (
                <div key={d.domain} style={{ padding: '0.5rem 0', borderBottom: '1px solid #2A2A2E' }}>
                  <div className="row-between" style={{ marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.9375rem' }}>{d.domain}</span>
                    <div className="row" style={{ gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                        {d.correct}/{d.total} ({d.percent}%)
                      </span>
                      <span style={{
                        fontSize: '0.8125rem',
                        color: diff >= 0 ? '#22D3EE' : '#EF4444',
                      }}>
                        {diff >= 0 ? '+' : ''}{diff}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 4, backgroundColor: '#2A2A2E', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${d.percent}%`,
                      backgroundColor: d.percent >= pass_threshold ? '#22D3EE' : '#EF4444',
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Time analysis */}
        {time_seconds != null && (
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Time</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatTime(time_seconds)}</p>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              ~{Math.round(time_seconds / total)}s per question
            </p>
          </div>
        )}

        {/* Previous attempts */}
        {previous_attempts.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Previous Attempts</h3>
            {previous_attempts.map((a, i) => (
              <div key={a.id || i} className="row-between" style={{ padding: '0.375rem 0', borderBottom: '1px solid #2A2A2E' }}>
                <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                  Attempt {a.attempt_number || i + 1} · {new Date(a.completed_at).toLocaleDateString()}
                </span>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: a.passed ? '#22D3EE' : '#EF4444',
                }}>
                  {a.score}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recommendation */}
        {weakest_domain && (
          <div className="info-box">
            Recommended: Focus on <strong>{weakest_domain}</strong>
          </div>
        )}

        {/* Action buttons */}
        <div className="stack-sm">
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate(`/training/${certLevel}/exam/run?mode=weak_area_drill`)}
          >
            Start Weak Area Drill
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate(`/training/${certLevel}/exam/run?mode=timed`)}
          >
            Retake Exam
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => navigate('/training')}
          >
            Back to Training
          </button>
        </div>
      </div>
    </div>
  );
}
