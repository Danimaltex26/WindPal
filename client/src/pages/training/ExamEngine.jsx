import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost } from '../../utils/api';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ---------- Timer ---------- */
function Timer({ totalSeconds, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const pct = totalSeconds > 0 ? remaining / totalSeconds : 1;
  const color = pct <= 0.1 ? '#EF4444' : pct <= 0.25 ? '#F59E0B' : '#F5F5F5';

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onExpire]);

  return (
    <span style={{
      fontWeight: 700,
      fontSize: '1.125rem',
      color,
      fontVariantNumeric: 'tabular-nums',
      animation: pct <= 0.1 ? 'pulse 1s ease-in-out infinite' : 'none',
    }}>
      {formatTime(remaining)}
    </span>
  );
}

/* ---------- Progress Dots ---------- */
function ProgressDots({ questions, answers, flagged, current, onJump }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      padding: '0.5rem 0',
    }}>
      {questions.map((_, i) => {
        const isFlagged = flagged[i];
        const isAnswered = answers[i] != null;
        let bg = '#2A2A2E'; // unanswered
        if (isAnswered) bg = '#F5F5F5';
        if (isFlagged) bg = '#F59E0B';
        if (!isAnswered && i !== current) bg = '#2A2A2E';
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              backgroundColor: bg,
              border: i === current ? '2px solid #22D3EE' : '1px solid #3A3A3E',
              cursor: 'pointer',
              padding: 0, flexShrink: 0,
            }}
            aria-label={`Question ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

/* ---------- Confidence Buttons (SR) ---------- */
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

/* ---------- Review Grid ---------- */
function ReviewGrid({ questions, answers, flagged, onJump, onSubmit }) {
  return (
    <div className="page">
      <h2 style={{ marginBottom: '1rem' }}>Review Answers</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
        gap: 6,
        marginBottom: '1.5rem',
      }}>
        {questions.map((_, i) => {
          const isFlagged = flagged[i];
          const isAnswered = answers[i] != null;
          let bg = '#EF4444'; // skipped = red
          if (isAnswered && !isFlagged) bg = '#F5F5F5'; // answered = white
          if (isFlagged) bg = '#F59E0B'; // flagged = amber
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: 6,
                backgroundColor: bg,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 600,
                color: bg === '#F5F5F5' ? '#0D0D0F' : '#fff',
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ gap: '0.75rem', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#F5F5F5', display: 'inline-block' }} /> Answered
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#F59E0B', display: 'inline-block' }} /> Flagged
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#EF4444', display: 'inline-block' }} /> Skipped
        </span>
      </div>
      <button className="btn btn-primary btn-block" onClick={onSubmit}>
        Submit Exam
      </button>
    </div>
  );
}

/* ========== MAIN ENGINE ========== */
export default function ExamEngine() {
  const { certLevel } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'practice';

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [examMeta, setExamMeta] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [srReviewCount, setSrReviewCount] = useState(0);
  const [studyRevealed, setStudyRevealed] = useState({});
  const [domainBanner, setDomainBanner] = useState(null);
  const [runningScore, setRunningScore] = useState({ correct: 0, total: 0 });
  const saveTimerRef = useRef(null);
  const prevDomainRef = useRef(null);

  const isExamMode = mode === 'timed' || mode === 'untimed';
  const isPractice = mode === 'practice' || mode === 'weak_area_drill';
  const isStudy = mode === 'study';
  const isSR = mode === 'sr_review';
  const isTimed = mode === 'timed';

  // Load questions
  useEffect(() => {
    async function load() {
      try {
        let data;
        if (isSR) {
          data = await apiGet('/training/sr/queue');
          setQuestions(data.questions || []);
        } else if (isExamMode) {
          data = await apiPost('/training/exam/start', { cert_level: certLevel, mode });
          setQuestions(data.questions || []);
          setExamMeta(data.meta || {});
          setAttemptId(data.attempt_id);
        } else {
          data = await apiPost('/training/practice/start', { cert_level: certLevel, mode });
          setQuestions(data.questions || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [certLevel, mode, isExamMode, isSR]);

  // Auto-save for exam modes
  useEffect(() => {
    if (!isExamMode || !attemptId) return;
    saveTimerRef.current = setInterval(() => {
      apiPost('/training/exam/save-state', {
        attempt_id: attemptId,
        answers,
        flagged,
        current_index: current,
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(saveTimerRef.current);
  }, [isExamMode, attemptId, answers, flagged, current]);

  // Domain banner for weak area drill
  useEffect(() => {
    if (mode !== 'weak_area_drill' || questions.length === 0) return;
    const q = questions[current];
    if (q && q.domain && q.domain !== prevDomainRef.current) {
      setDomainBanner(q.domain);
      prevDomainRef.current = q.domain;
      const t = setTimeout(() => setDomainBanner(null), 3000);
      return () => clearTimeout(t);
    }
  }, [current, questions, mode]);

  const handleExpire = useCallback(() => {
    submitExam();
  }, [answers, attemptId]);

  function selectAnswer(qIdx, choice) {
    if (isExamMode) {
      setAnswers((prev) => ({ ...prev, [qIdx]: choice }));
      return;
    }
    if (revealed[qIdx]) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: choice }));
    if (isPractice) {
      setRevealed((prev) => ({ ...prev, [qIdx]: true }));
      const q = questions[qIdx];
      if (q) {
        setRunningScore((prev) => ({
          correct: prev.correct + (choice === q.correct_answer ? 1 : 0),
          total: prev.total + 1,
        }));
      }
    }
  }

  function toggleFlag(qIdx) {
    setFlagged((prev) => ({ ...prev, [qIdx]: !prev[qIdx] }));
  }

  async function submitExam() {
    clearInterval(saveTimerRef.current);
    try {
      const resp = await apiPost('/training/exam/submit', {
        attempt_id: attemptId,
        answers,
        cert_level: certLevel,
        mode,
      });
      navigate(`/training/${certLevel}/exam/score/${resp.attempt_id || attemptId}`);
    } catch {
      navigate(`/training/${certLevel}/exam`);
    }
  }

  async function handleSRConfidence(rating) {
    const q = questions[current];
    try {
      await apiPost('/training/sr/review', { question_id: q.id, confidence: rating });
    } catch { /* ignore */ }
    setSrReviewCount((c) => c + 1);
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setRevealed({});
      setAnswers((prev) => { const n = { ...prev }; delete n[current + 1]; return n; });
    } else {
      navigate('/training');
    }
  }

  function handleStudyReveal(qIdx) {
    setStudyRevealed((prev) => ({ ...prev, [qIdx]: true }));
  }

  function handlePracticeGotIt() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    }
  }

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
        <p className="spinner-message">Preparing questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
        <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => navigate(-1)}>
          &larr; Go back
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <p className="text-muted">No questions available for this mode.</p>
        <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => navigate(-1)}>
          &larr; Go back
        </button>
      </div>
    );
  }

  // Review grid (exam modes)
  if (showReview && isExamMode) {
    return (
      <ReviewGrid
        questions={questions}
        answers={answers}
        flagged={flagged}
        onJump={(i) => { setCurrent(i); setShowReview(false); }}
        onSubmit={() => setShowConfirm(true)}
      />
    );
  }

  // Confirmation dialog
  if (showConfirm) {
    const unanswered = questions.filter((_, i) => answers[i] == null).length;
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Submit Exam?</h2>
          {unanswered > 0 && (
            <p className="text-warning" style={{ marginBottom: '0.75rem' }}>
              You have {unanswered} unanswered question{unanswered !== 1 ? 's' : ''}.
            </p>
          )}
          <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>This cannot be undone.</p>
          <div className="stack-sm">
            <button className="btn btn-primary btn-block" onClick={submitExam}>Yes, Submit</button>
            <button className="btn btn-secondary btn-block" onClick={() => setShowConfirm(false)}>Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="page">
      {/* Top bar */}
      <div className="row-between" style={{ marginBottom: '0.75rem' }}>
        <button className="btn btn-ghost" style={{ padding: '0.5rem 0' }} onClick={() => {
          if (isExamMode) { setShowReview(true); } else { navigate(-1); }
        }}>
          {isExamMode ? 'Review' : '← Back'}
        </button>

        <div className="row" style={{ gap: '0.75rem' }}>
          {isSR && (
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              {srReviewCount} of {questions.length} reviewed
            </span>
          )}
          {isPractice && (
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              {runningScore.correct}/{runningScore.total}
            </span>
          )}
          {isTimed && examMeta.time_limit_seconds && (
            <Timer totalSeconds={examMeta.time_limit_seconds} onExpire={handleExpire} />
          )}
        </div>
      </div>

      {/* Progress dots for exam */}
      {isExamMode && (
        <ProgressDots
          questions={questions}
          answers={answers}
          flagged={flagged}
          current={current}
          onJump={setCurrent}
        />
      )}

      {/* Domain banner */}
      {domainBanner && (
        <div style={{
          padding: '0.5rem 0.75rem',
          backgroundColor: 'rgba(51,204,51,0.1)',
          borderRadius: 8,
          marginBottom: '0.75rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#22D3EE',
          fontWeight: 600,
        }}>
          Now: {domainBanner}
        </div>
      )}

      {/* Question */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: '0.5rem' }}>
          <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
            {isExamMode ? `Q${current + 1} of ${questions.length}` : `Question ${current + 1}`}
            {q.topic && ` · ${q.topic}`}
          </span>
          {isExamMode && (
            <button
              className="btn btn-ghost"
              style={{
                padding: '0.25rem 0.5rem',
                minHeight: 'auto',
                fontSize: '0.8125rem',
                color: flagged[current] ? '#F59E0B' : '#6B6B73',
              }}
              onClick={() => toggleFlag(current)}
            >
              {flagged[current] ? '⚑ Flagged' : '⚐ Flag'}
            </button>
          )}
        </div>

        <p style={{ fontSize: '1rem', lineHeight: 1.55, marginBottom: '1rem' }}>{q.text}</p>

        {/* Options */}
        <div className="stack-sm">
          {(q.options || []).map((opt) => {
            const isSelected = answers[current] === opt.key;
            const isRevealed = revealed[current] || (isSR && revealed[current]);
            const isCorrect = opt.key === q.correct_answer;

            // Study mode: not selectable until revealed
            const isStudyTestable = studyRevealed[current];
            const isDisabledStudy = isStudy && !isStudyTestable;

            let bg = 'transparent';
            let border = '#2A2A2E';

            if (isRevealed) {
              if (isCorrect) { bg = 'rgba(51,204,51,0.1)'; border = '#22D3EE'; }
              else if (isSelected && !isCorrect) { bg = 'rgba(239,68,68,0.1)'; border = '#EF4444'; }
            } else if (isSelected) {
              bg = 'rgba(51,204,51,0.08)'; border = '#22D3EE';
            }

            return (
              <button
                key={opt.key}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.75rem 1rem', borderRadius: 8,
                  border: `1px solid ${border}`, backgroundColor: bg,
                  color: '#F5F5F5', fontSize: '0.9375rem',
                  cursor: (isRevealed || isDisabledStudy) ? 'default' : 'pointer',
                  minHeight: 48,
                  transition: 'border-color 0.15s, background-color 0.15s',
                  opacity: isDisabledStudy ? 0.5 : 1,
                }}
                onClick={() => {
                  if (isDisabledStudy || isRevealed) return;
                  selectAnswer(current, opt.key);
                  if (isSR) setRevealed((prev) => ({ ...prev, [current]: true }));
                }}
                disabled={isRevealed || isDisabledStudy}
              >
                <strong>{opt.key}.</strong> {opt.text}
              </button>
            );
          })}
        </div>

        {/* Study mode: show explanation immediately + test-myself button */}
        {isStudy && !studyRevealed[current] && (
          <>
            {q.explanation && (
              <div style={{
                marginTop: '1rem', padding: '0.875rem',
                backgroundColor: 'rgba(51,204,51,0.05)', borderRadius: 8,
                borderLeft: '3px solid #22D3EE',
              }}>
                <p style={{ fontSize: '0.8125rem', color: '#A0A0A8', fontWeight: 600, marginBottom: '0.25rem' }}>Explanation</p>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.55, color: '#D4D4D8' }}>{q.explanation}</p>
              </div>
            )}
            <button
              className="btn btn-secondary btn-block"
              style={{ marginTop: '0.75rem' }}
              onClick={() => handleStudyReveal(current)}
            >
              I understand — test myself
            </button>
          </>
        )}

        {/* Feedback for practice/drill modes */}
        {isPractice && revealed[current] && q.explanation && (
          <div style={{
            marginTop: '1rem', padding: '0.875rem',
            backgroundColor: 'rgba(51,204,51,0.05)', borderRadius: 8,
            borderLeft: '3px solid #22D3EE',
          }}>
            <p style={{ fontSize: '0.8125rem', color: '#A0A0A8', fontWeight: 600, marginBottom: '0.25rem' }}>Explanation</p>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.55, color: '#D4D4D8' }}>{q.explanation}</p>
            {q.standard_reference && (
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.375rem' }}>Ref: {q.standard_reference}</p>
            )}
          </div>
        )}

        {/* SR confidence */}
        {isSR && revealed[current] && (
          <>
            {q.explanation && (
              <div style={{
                marginTop: '1rem', padding: '0.875rem',
                backgroundColor: 'rgba(51,204,51,0.05)', borderRadius: 8,
                borderLeft: '3px solid #22D3EE',
              }}>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.55, color: '#D4D4D8' }}>{q.explanation}</p>
              </div>
            )}
            <ConfidenceButtons onRate={handleSRConfidence} />
          </>
        )}

        {/* Practice "Got it" / "Still confused" */}
        {isPractice && revealed[current] && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePracticeGotIt}>
              Got it
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handlePracticeGotIt}>
              Still confused
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {!isSR && (
        <div className="row-between" style={{ marginTop: '1rem' }}>
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
          ) : isExamMode ? (
            <button className="btn btn-primary" onClick={() => setShowReview(true)}>
              Review & Submit
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate(`/training/${certLevel}/exam`)}>
              End Session
            </button>
          )}
        </div>
      )}

      {/* Study next */}
      {isStudy && (
        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={() => {
            if (current < questions.length - 1) setCurrent((c) => c + 1);
            else navigate(`/training/${certLevel}/exam`);
          }}>
            Next question &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
