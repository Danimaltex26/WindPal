import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../../utils/api';

function ModeCard({ title, subtitle, stats, buttonLabel, buttonClass = 'btn-primary', onClick }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
      {subtitle && <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{subtitle}</p>}
      {stats && (
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {stats.map((s, i) => (
            <span key={i} className="text-muted" style={{ fontSize: '0.8125rem' }}>{s}</span>
          ))}
        </div>
      )}
      <button className={`btn ${buttonClass} btn-block`} onClick={onClick}>{buttonLabel}</button>
    </div>
  );
}

export default function ExamSelection() {
  const { certLevel } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/training/exam-info/${certLevel}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [certLevel]);

  function startExam(mode) {
    navigate(`/training/${certLevel}/exam/run?mode=${mode}`);
  }

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
    cert_name = '',
    question_count = 0,
    time_limit_minutes = 0,
    best_score = null,
    sr_queue_count = 0,
    weak_domains = [],
    attempts = [],
  } = data || {};

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate(`/training/${certLevel}`)} style={{ padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          &larr; Back to {cert_name}
        </button>
        <h1>Exams & Practice</h1>
      </div>

      <div className="stack">
        {/* Section 1: Full Exam Practice */}
        <h2 style={{ fontSize: '1rem', color: '#A0A0A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Full Exam Practice
        </h2>

        <ModeCard
          title="Timed Exam"
          subtitle={`Simulates the real ${cert_name} exam conditions`}
          stats={[
            `${question_count} questions`,
            `${time_limit_minutes} min`,
            best_score != null ? `Best: ${best_score}%` : 'No attempts',
          ]}
          buttonLabel="Start Timed Exam"
          onClick={() => startExam('timed')}
        />

        <ModeCard
          title="Untimed Exam"
          subtitle="Full exam without time pressure"
          stats={[`${question_count} questions`, 'No time limit']}
          buttonLabel="Start Untimed Exam"
          buttonClass="btn-secondary"
          onClick={() => startExam('untimed')}
        />

        {/* Section 2: Focused Practice */}
        <h2 style={{ fontSize: '1rem', color: '#A0A0A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>
          Focused Practice
        </h2>

        <ModeCard
          title="Weak Area Drill"
          subtitle={weak_domains.length > 0 ? `Lowest: ${weak_domains.slice(0, 2).join(', ')}` : 'Complete some questions first'}
          buttonLabel="Start Drill"
          buttonClass="btn-secondary"
          onClick={() => startExam('weak_area_drill')}
        />

        <ModeCard
          title="Practice Mode"
          subtitle="Answer questions with immediate feedback"
          buttonLabel="Configure and Start"
          buttonClass="btn-secondary"
          onClick={() => startExam('practice')}
        />

        <ModeCard
          title="Study Mode"
          subtitle="View questions and explanations — no scoring"
          buttonLabel="Start Studying"
          buttonClass="btn-secondary"
          onClick={() => startExam('study')}
        />

        {/* Section 3: Daily Review */}
        <h2 style={{ fontSize: '1rem', color: '#A0A0A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>
          Daily Review
        </h2>

        <ModeCard
          title="Spaced Repetition"
          subtitle="Review questions based on your memory strength"
          stats={[`${sr_queue_count} cards due`]}
          buttonLabel="Start Review"
          buttonClass="btn-accent"
          onClick={() => navigate('/training/sr')}
        />

        {/* Section 4: Exam History */}
        {attempts.length > 0 && (
          <>
            <h2 style={{ fontSize: '1rem', color: '#A0A0A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>
              Exam History
            </h2>
            <div className="card">
              {attempts.map((a, i) => (
                <div
                  key={a.id || i}
                  className="row-between"
                  style={{
                    padding: '0.625rem 0',
                    borderBottom: i < attempts.length - 1 ? '1px solid #2A2A2E' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/training/${certLevel}/exam/score/${a.id}`)}
                >
                  <div>
                    <span style={{ fontSize: '0.9375rem' }}>Attempt {a.attempt_number || i + 1}</span>
                    <span className="text-muted" style={{ fontSize: '0.8125rem', marginLeft: '0.5rem' }}>
                      {new Date(a.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="row" style={{ gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: a.passed ? '#22D3EE' : '#F59E0B',
                    }}>
                      {a.score}%
                    </span>
                    <span className={`badge ${a.passed ? 'badge-green' : 'badge-red'}`}>
                      {a.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
