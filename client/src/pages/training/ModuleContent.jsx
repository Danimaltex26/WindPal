import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../utils/api';

const SECTION_STYLES = {
  concept: {},
  example: { borderLeft: '4px solid #F59E0B' },
  formula: { borderLeft: '4px solid #A0A0A8' },
  code_reference: { borderLeft: '4px solid #3B82F6' },
  tip: { borderLeft: '4px solid #22D3EE' },
};

const SECTION_LABELS = {
  example: 'Field Example:',
  formula: 'Formula:',
  code_reference: null, // uses standard_name
  tip: 'Field Tip:',
};

function SectionCard({ section, onMarkRead }) {
  const style = SECTION_STYLES[section.content_type] || {};
  const label = section.content_type === 'code_reference'
    ? section.standard_reference
    : SECTION_LABELS[section.content_type];

  return (
    <div className="card" style={{ ...style, position: 'relative' }}>
      {label && (
        <p style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: section.content_type === 'tip' ? '#22D3EE'
            : section.content_type === 'example' ? '#F59E0B'
            : section.content_type === 'code_reference' ? '#3B82F6'
            : '#A0A0A8',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.025em',
        }}>
          {label}
        </p>
      )}
      {section.section_title && <h3 style={{ marginBottom: '0.5rem' }}>{section.section_title}</h3>}
      <div style={{
        whiteSpace: 'pre-wrap',
        fontSize: '0.9375rem',
        lineHeight: 1.65,
        color: '#D4D4D8',
        fontFamily: section.content_type === 'formula' ? 'monospace' : 'inherit',
      }}>
        {section.content_text}
      </div>
      {!section.is_read && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#22D3EE' }}
          onClick={() => onMarkRead(section.section_number)}
        >
          Mark as read
        </button>
      )}
      {section.is_read && (
        <span className="text-muted" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          Read
        </span>
      )}
    </div>
  );
}

/* ---- Practice Test Sub-component ---- */
function PracticeTest({ moduleId, certLevel }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [finished, setFinished] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [startTime] = useState(Date.now());
  const [showMissed, setShowMissed] = useState(false);

  useEffect(() => {
    apiGet(`/training/module/${moduleId}/questions`)
      .then((data) => {
        // Transform DB column format to component format
        const transformed = (data.questions || []).map((q) => ({
          ...q,
          text: q.question_text,
          options: [
            { key: 'A', text: q.option_a },
            { key: 'B', text: q.option_b },
            { key: 'C', text: q.option_c },
            { key: 'D', text: q.option_d },
          ],
        }));
        setQuestions(transformed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [moduleId]);

  function selectAnswer(qIdx, choice) {
    if (revealed[qIdx]) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: choice }));
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  }

  async function finishTest() {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const results = questions.map((q, i) => ({
      question_id: q.id,
      selected: answers[i] || null,
      correct: answers[i] === q.correct_answer,
    }));
    const correctCount = results.filter((r) => r.correct).length;

    try {
      const resp = await apiPost('/training/module/test/submit', {
        module_id: moduleId,
        answers: results,
        time_seconds: elapsed,
      });
      setScoreData({
        correct: correctCount,
        total: questions.length,
        percent: Math.round((correctCount / questions.length) * 100),
        passed: Math.round((correctCount / questions.length) * 100) >= 70,
        time_seconds: elapsed,
        topic_breakdown: resp.topic_breakdown || [],
        next_module_id: resp.next_module_id,
      });
    } catch {
      setScoreData({
        correct: correctCount,
        total: questions.length,
        percent: Math.round((correctCount / questions.length) * 100),
        passed: Math.round((correctCount / questions.length) * 100) >= 70,
        time_seconds: elapsed,
        topic_breakdown: [],
        next_module_id: null,
      });
    }
    setFinished(true);
  }

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
      </div>
    );
  }
  if (error) return <div className="error-banner">{error}</div>;
  if (questions.length === 0) {
    return <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>No practice questions available yet.</p>;
  }

  // Score screen
  if (finished && scoreData) {
    const missedIndices = questions.map((_, i) => i).filter((i) => answers[i] !== questions[i].correct_answer);

    function formatTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    return (
      <div className="stack">
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: scoreData.passed ? '#22D3EE' : '#F59E0B',
          }}>
            {scoreData.correct} / {scoreData.total} — {scoreData.percent}%
          </p>
          <span className={`badge ${scoreData.passed ? 'badge-green' : 'badge-amber'}`} style={{ marginTop: '0.5rem' }}>
            {scoreData.passed ? 'PASSED' : 'NEEDS REVIEW'}
          </span>
          <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Time: {formatTime(scoreData.time_seconds)}
          </p>
        </div>

        {scoreData.topic_breakdown.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Topic Breakdown</h3>
            {scoreData.topic_breakdown.map((t) => (
              <div key={t.topic} className="row-between" style={{ padding: '0.375rem 0', borderBottom: '1px solid #2A2A2E' }}>
                <span style={{ fontSize: '0.875rem' }}>{t.topic}</span>
                <span style={{ fontSize: '0.875rem', color: t.percent >= 70 ? '#22D3EE' : '#F59E0B' }}>
                  {t.correct}/{t.total} ({t.percent}%)
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="stack-sm">
          {missedIndices.length > 0 && (
            <button className="btn btn-secondary btn-block" onClick={() => {
              setShowMissed(!showMissed);
            }}>
              {showMissed ? 'Hide' : 'Review'} missed questions ({missedIndices.length})
            </button>
          )}
          <button className="btn btn-secondary btn-block" onClick={() => {
            setFinished(false);
            setScoreData(null);
            setAnswers({});
            setRevealed({});
            setCurrent(0);
            setShowMissed(false);
          }}>
            Retake test
          </button>
          {scoreData.passed && scoreData.next_module_id && (
            <button className="btn btn-primary btn-block" onClick={() => navigate(`/training/${certLevel}/${scoreData.next_module_id}`)}>
              Next module &rarr;
            </button>
          )}
          <button className="btn btn-ghost btn-block" onClick={() => navigate(`/training/${certLevel}`)}>
            Back to modules
          </button>
        </div>

        {showMissed && (
          <div className="stack">
            {missedIndices.map((i) => {
              const q = questions[i];
              return (
                <div key={i} className="card">
                  <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    Q{i + 1} · {q.topic}
                  </p>
                  <p style={{ marginBottom: '0.75rem' }}>{q.text}</p>
                  {q.options.map((opt) => {
                    const isCorrect = opt.key === q.correct_answer;
                    const wasSelected = opt.key === answers[i];
                    return (
                      <div key={opt.key} style={{
                        padding: '0.625rem 0.875rem',
                        marginBottom: '0.375rem',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: isCorrect ? '#22D3EE' : wasSelected ? '#EF4444' : '#2A2A2E',
                        backgroundColor: isCorrect ? 'rgba(51,204,51,0.1)' : wasSelected ? 'rgba(239,68,68,0.1)' : 'transparent',
                        fontSize: '0.9375rem',
                      }}>
                        <strong>{opt.key}.</strong> {opt.text}
                      </div>
                    );
                  })}
                  {q.explanation && (
                    <p className="text-secondary" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Question view
  const q = questions[current];
  const isRevealed = revealed[current];
  const selected = answers[current];
  const allAnswered = Object.keys(answers).length === questions.length;

  return (
    <div className="stack">
      {/* Progress */}
      <div className="row-between">
        <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
          Question {current + 1} of {questions.length}
        </span>
        <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
          {Object.keys(answers).length} answered
        </span>
      </div>

      <div className="card">
        <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>{q.topic}</p>
        <p style={{ fontSize: '1rem', marginBottom: '1rem', lineHeight: 1.55 }}>{q.text}</p>

        <div className="stack-sm">
          {q.options.map((opt) => {
            let bg = 'transparent';
            let border = '#2A2A2E';
            if (isRevealed) {
              if (opt.key === q.correct_answer) { bg = 'rgba(51,204,51,0.1)'; border = '#22D3EE'; }
              else if (opt.key === selected) { bg = 'rgba(239,68,68,0.1)'; border = '#EF4444'; }
            } else if (opt.key === selected) {
              bg = 'rgba(51,204,51,0.08)'; border = '#22D3EE';
            }

            return (
              <button
                key={opt.key}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  backgroundColor: bg,
                  color: '#F5F5F5',
                  fontSize: '0.9375rem',
                  cursor: isRevealed ? 'default' : 'pointer',
                  minHeight: 48,
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onClick={() => selectAnswer(current, opt.key)}
                disabled={isRevealed}
              >
                <strong>{opt.key}.</strong> {opt.text}
              </button>
            );
          })}
        </div>

        {isRevealed && q.explanation && (
          <div style={{
            marginTop: '1rem',
            padding: '0.875rem',
            backgroundColor: 'rgba(51,204,51,0.05)',
            borderRadius: 8,
            borderLeft: '3px solid #22D3EE',
          }}>
            <p style={{ fontSize: '0.875rem', color: '#A0A0A8', fontWeight: 600, marginBottom: '0.25rem' }}>Explanation</p>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.55, color: '#D4D4D8' }}>{q.explanation}</p>
            {q.standard_reference && (
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.375rem' }}>
                Ref: {q.standard_reference}
              </p>
            )}
          </div>
        )}

        {isRevealed && (
          <button className="btn btn-ghost" style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6B6B73' }}>
            Report an issue
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="row-between">
        <button
          className="btn btn-ghost"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          &larr; Previous
        </button>
        {current < questions.length - 1 ? (
          <button className="btn btn-ghost" onClick={() => setCurrent((c) => c + 1)}>
            Next &rarr;
          </button>
        ) : allAnswered ? (
          <button className="btn btn-primary" onClick={finishTest}>
            See Score
          </button>
        ) : (
          <button className="btn btn-ghost" disabled>
            Answer all to finish
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Main ModuleContent ---- */
export default function ModuleContent() {
  const { certLevel, moduleId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('learn');
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchModule = useCallback(() => {
    apiGet(`/training/module/${moduleId}`)
      .then(setModule)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [moduleId]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  async function markRead(sectionNumber) {
    try {
      await apiPost(`/training/module/${moduleId}/complete-section`, { sectionNumber });
      setModule((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.section_number === sectionNumber ? { ...s, is_read: true } : s
        ),
        sections_read: (prev.sections_read || 0) + 1,
      }));
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
        <p className="spinner-message">Loading module...</p>
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

  const { title, sections = [], sections_read = 0, sections_total = 0 } = module || {};
  const allRead = sections_read >= sections_total && sections_total > 0;

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate(`/training/${certLevel}`)} style={{ padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          &larr; Back to modules
        </button>
        <h1 style={{ fontSize: '1.375rem' }}>{title}</h1>
      </div>

      {/* Tabs */}
      <div className="toggle-group" style={{ marginBottom: '1.25rem' }}>
        <button
          className={`toggle-option${activeTab === 'learn' ? ' active' : ''}`}
          onClick={() => setActiveTab('learn')}
        >
          Learn
        </button>
        <button
          className={`toggle-option${activeTab === 'test' ? ' active' : ''}`}
          onClick={() => setActiveTab('test')}
        >
          Practice Test
        </button>
      </div>

      {activeTab === 'learn' && (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div className="row-between" style={{ marginBottom: '0.375rem' }}>
              <span className="text-secondary" style={{ fontSize: '0.875rem' }}>
                {sections_read} of {sections_total} sections read
              </span>
              {allRead && (
                <button
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.8125rem',
                    color: '#22D3EE',
                    animation: 'pulse 2s ease-in-out infinite',
                    padding: '0.25rem 0.5rem',
                    minHeight: 'auto',
                  }}
                  onClick={() => setActiveTab('test')}
                >
                  Take Practice Test &rarr;
                </button>
              )}
            </div>
            <div style={{ height: 4, backgroundColor: '#2A2A2E', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${sections_total > 0 ? (sections_read / sections_total) * 100 : 0}%`,
                backgroundColor: '#22D3EE',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          <div className="stack">
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} onMarkRead={markRead} />
            ))}
          </div>
        </>
      )}

      {activeTab === 'test' && (
        <PracticeTest moduleId={moduleId} certLevel={certLevel} />
      )}
    </div>
  );
}
