import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../utils/api';

function ConfidenceButtons({ onRate }) {
  const labels = ['Again', 'Hard', 'Okay', 'Good', 'Easy'];
  return (
    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.75rem' }}>
      {labels.map((label, i) => (
        <button
          key={i}
          className="btn btn-secondary"
          style={{ flex: 1, minHeight: 44, fontSize: '0.8125rem', padding: '0.5rem 0' }}
          onClick={() => onRate(i + 1)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SpacedRepetitionQueue() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiGet('/training/sr/queue')
      .then((data) => {
        const q = data.questions || [];
        setQuestions(q);
        if (q.length === 0) setDone(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function selectAnswer(choice) {
    if (revealed) return;
    setSelected(choice);
    setRevealed(true);
  }

  async function handleConfidence(rating) {
    const q = questions[current];
    try {
      await apiPost('/training/sr/review', {
        question_id: q.id,
        confidence: rating,
        selected_answer: selected,
      });
    } catch { /* ignore */ }

    setReviewedCount((c) => c + 1);

    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      setDone(true);
    }
  }

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
        <p className="spinner-message">Loading review queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
        <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => navigate('/training')}>
          &larr; Back to Training
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
            {reviewedCount > 0 ? reviewedCount : 0}
          </p>
          <p className="text-secondary" style={{ marginBottom: '1rem' }}>
            {reviewedCount > 0 ? 'cards reviewed — nice work!' : 'No cards due for review right now.'}
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/training')}>
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="page">
      <div className="page-header">
        <div className="row-between">
          <button className="btn btn-ghost" onClick={() => navigate('/training')} style={{ padding: '0.5rem 0' }}>
            &larr; Back
          </button>
          <span className="text-muted" style={{ fontSize: '0.875rem' }}>
            {reviewedCount} of {questions.length} reviewed
          </span>
        </div>
        <h1 style={{ marginTop: '0.5rem' }}>Spaced Repetition</h1>
      </div>

      <div className="stack">
        <div className="card">
          <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
            {q.topic && q.topic}
          </p>
          <p style={{ fontSize: '1rem', lineHeight: 1.55, marginBottom: '1rem' }}>{q.text}</p>

          <div className="stack-sm">
            {(q.options || []).map((opt) => {
              const isCorrect = opt.key === q.correct_answer;
              const isSelected = opt.key === selected;

              let bg = 'transparent';
              let border = '#2A2A2E';

              if (revealed) {
                if (isCorrect) { bg = 'rgba(51,204,51,0.1)'; border = '#22D3EE'; }
                else if (isSelected && !isCorrect) { bg = 'rgba(239,68,68,0.1)'; border = '#EF4444'; }
              }

              return (
                <button
                  key={opt.key}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.75rem 1rem', borderRadius: 8,
                    border: `1px solid ${border}`, backgroundColor: bg,
                    color: '#F5F5F5', fontSize: '0.9375rem',
                    cursor: revealed ? 'default' : 'pointer',
                    minHeight: 48,
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                  onClick={() => selectAnswer(opt.key)}
                  disabled={revealed}
                >
                  <strong>{opt.key}.</strong> {opt.text}
                </button>
              );
            })}
          </div>

          {revealed && q.explanation && (
            <div style={{
              marginTop: '1rem', padding: '0.875rem',
              backgroundColor: 'rgba(51,204,51,0.05)', borderRadius: 8,
              borderLeft: '3px solid #22D3EE',
            }}>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.55, color: '#D4D4D8' }}>{q.explanation}</p>
              {q.standard_reference && (
                <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.375rem' }}>
                  Ref: {q.standard_reference}
                </p>
              )}
            </div>
          )}

          {revealed && <ConfidenceButtons onRate={handleConfidence} />}
        </div>
      </div>
    </div>
  );
}
