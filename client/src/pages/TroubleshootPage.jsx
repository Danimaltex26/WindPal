import { useState } from 'react';
import { apiPost } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';

var TURBINE_MODELS = [
  'Vestas V90',
  'Vestas V110',
  'Vestas V117',
  'Vestas V126',
  'Vestas V136',
  'Vestas V150',
  'Vestas V162',
  'Siemens Gamesa SG 3.4-132',
  'Siemens Gamesa SG 4.5-145',
  'Siemens Gamesa SG 5.0-145',
  'Siemens Gamesa SG 6.6-170',
  'Siemens Gamesa SG 8.0-167 DD',
  'Siemens Gamesa SG 11.0-200 DD',
  'Siemens Gamesa SG 14-222 DD',
  'GE 1.5sle',
  'GE 2.x-127',
  'GE 2.82-127',
  'GE 3.x-137',
  'GE 5.x-158',
  'GE Haliade-X 12',
  'GE Haliade-X 14',
  'Nordex N117',
  'Nordex N131',
  'Nordex N149',
  'Nordex N163',
  'Enercon E-82',
  'Enercon E-115',
  'Enercon E-126',
  'Enercon E-138',
  'Goldwind GW136',
  'Goldwind GW155',
  'Suzlon S128',
  'Other',
];

var COMPONENTS = [
  'Blade',
  'Pitch System',
  'Hub',
  'Main Bearing',
  'Gearbox',
  'Generator',
  'Yaw System',
  'Nacelle',
  'Tower',
  'Foundation',
  'Transformer',
  'Converter / Power Electronics',
  'Controller / SCADA',
  'Hydraulic System',
  'Cooling System',
  'Brake System',
  'Anemometer / Wind Vane',
  'Lightning Protection',
  'Cables / Slip Ring',
  'Other',
];

var ENVIRONMENTS = [
  'Onshore',
  'Offshore',
  'Cold Climate',
];

var AI_MESSAGES = [
  'Analyzing the issue...',
  'Checking common causes...',
  'Building diagnosis...',
];

export default function TroubleshootPage() {
  const [form, setForm] = useState({
    turbine_model: '',
    component: '',
    symptoms: '',
    environment: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [model, setModel] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [sessionId, setSessionId] = useState(null);

  function set(field, value) {
    setForm(function (prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  async function handleSubmit() {
    if (!form.symptoms.trim()) {
      setError('Please describe the symptoms.');
      return;
    }
    setError('');
    setLoading(true);
    setMessages([]);
    setSessionId(null);
    try {
      var data = await apiPost('/troubleshoot', form);
      var result = data.result || data;
      setModel(data.model || '');
      setSessionId(data.session_id || null);
      setMessages([
        { role: 'user', content: form.symptoms },
        { role: 'assistant', data: result },
      ]);
    } catch (err) {
      setError(err.message || 'Troubleshoot failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp() {
    if (!followUp.trim() || !sessionId) return;
    var userMsg = followUp;
    setFollowUp('');
    setError('');
    setLoading(true);
    var newMessages = messages.concat([{ role: 'user', content: userMsg }]);
    setMessages(newMessages);
    try {
      // Backend handles follow-ups via the main /troubleshoot route
      // using session_id + follow_up in the body.
      var data = await apiPost('/troubleshoot', {
        session_id: sessionId,
        follow_up: userMsg,
      });
      var result = data.result || data;
      setModel(data.model || '');
      setMessages(newMessages.concat([{ role: 'assistant', data: result }]));
    } catch (err) {
      setError(err.message || 'Follow-up failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setModel('');
    setError('');
    setFollowUp('');
    setSessionId(null);
    setForm({
      turbine_model: '',
      component: '',
      symptoms: '',
      environment: '',
    });
  }

  function renderResult(result) {
    if (!result) return null;
    var safeState = result.turbine_safe_state;
    var safeBg = safeState === 'locked' ? 'rgba(16,185,129,0.12)'
               : safeState === 'braked' ? 'rgba(245,158,11,0.12)'
               : safeState === 'operational_required' ? 'rgba(59,130,246,0.12)'
               : 'rgba(239,68,68,0.12)';
    var safeBorder = safeState === 'locked' ? '#10B981'
                   : safeState === 'braked' ? '#F59E0B'
                   : safeState === 'operational_required' ? '#3B82F6'
                   : '#EF4444';
    var safeLabel = safeState === 'locked' ? 'Rotor locked — safe for hub/nacelle entry'
                  : safeState === 'braked' ? 'Rotor braked — nacelle only, NOT hub'
                  : safeState === 'operational_required' ? 'Operational state required — remote monitoring first'
                  : safeState === 'unknown' ? 'Safe state NOT confirmed — verify before any work'
                  : safeState;

    return (
      <div className="stack">
        {/* Safety callout */}
        {(result.safety_callout || result.safety_warning) && (
          <div className="warning-box">
            <strong>Safety: </strong>{result.safety_callout || result.safety_warning}
          </div>
        )}

        {/* Turbine safe state banner */}
        {result.turbine_safe_state && (
          <div className="card" style={{ background: safeBg, borderLeft: '4px solid ' + safeBorder }}>
            <h3 style={{ marginBottom: '0.375rem', color: safeBorder }}>{safeLabel}</h3>
            {result.turbine_safe_state_note && (
              <p style={{ fontSize: '0.9375rem' }}>{result.turbine_safe_state_note}</p>
            )}
          </div>
        )}

        {/* LOTO & PPE — always populated, cyan accent */}
        {result.required_loto_and_ppe && (
          <div className="card" style={{ borderLeft: '4px solid #22D3EE' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#22D3EE' }}>LOTO & PPE</h3>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{result.required_loto_and_ppe}</p>
          </div>
        )}

        {/* Plain English Summary */}
        {result.plain_english_summary && (
          <div className="card">
            <p style={{ fontSize: '1.0625rem', lineHeight: 1.6 }}>{result.plain_english_summary}</p>
          </div>
        )}

        {/* Probable Causes */}
        {result.probable_causes && result.probable_causes.length > 0 && (
          <div className="stack">
            <h3>Probable Causes</h3>
            {result.probable_causes.map(function (c, i) {
              var rank = c.rank != null ? c.rank : i + 1;
              var fixSteps = c.fix_path || c.fix_steps || [];
              var parts = c.parts_to_check || [];
              var scadaCodes = c.scada_codes_to_review || [];
              var meas = c.measurement_expectations || {};
              var hasMeas = meas && Object.values(meas).some(Boolean);
              return (
                <div key={i} className="card">
                  <div className="row" style={{ marginBottom: '0.5rem', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#22D3EE',
                        color: '#0A0A0A',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                      }}>
                        {rank}
                      </div>
                      <strong style={{ lineHeight: 1.3 }}>{c.cause}</strong>
                    </div>
                    <div className="row" style={{ gap: '0.375rem', alignItems: 'center' }}>
                      {c.crane_required === true && (
                        <span className="badge badge-amber" style={{ fontSize: '0.6875rem' }}>Crane</span>
                      )}
                      {c.likelihood && (
                        <span className={'badge ' + (c.likelihood === 'high' ? 'badge-red' : c.likelihood === 'medium' ? 'badge-amber' : 'badge-gray')}>
                          {c.likelihood}
                        </span>
                      )}
                    </div>
                  </div>

                  {c.explanation && (
                    <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                      {c.explanation}
                    </p>
                  )}

                  {c.oem_procedure_reference && (
                    <p style={{ fontSize: '0.8125rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(34,211,238,0.1)', borderLeft: '3px solid #22D3EE', borderRadius: 4 }}>
                      <strong>OEM procedure: </strong>{c.oem_procedure_reference}
                    </p>
                  )}

                  {scadaCodes.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p className="text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
                        SCADA codes to review
                      </p>
                      <div className="row" style={{ gap: '0.375rem', flexWrap: 'wrap' }}>
                        {scadaCodes.map(function (code, ci) {
                          return (
                            <span key={ci} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.06)', borderRadius: 4, fontFamily: 'monospace' }}>
                              {code}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hasMeas && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p className="text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
                        Measurement Expectations
                      </p>
                      <div style={{ fontSize: '0.875rem' }}>
                        {Object.entries(meas).map(function (entry) {
                          var k = entry[0];
                          var v = entry[1];
                          return v ? (
                            <p key={k} style={{ marginBottom: '0.25rem' }}>
                              <strong style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</strong> {v}
                            </p>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {parts.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p className="text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
                        Parts to Check
                      </p>
                      <div className="stack-sm">
                        {parts.map(function (p, pi) {
                          return (
                            <div key={pi} style={{ padding: '0.5rem 0.625rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                              <div className="row-between" style={{ marginBottom: '0.25rem', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.9375rem' }}>{p.part}</strong>
                                {p.estimated_cost && <span className="text-secondary" style={{ fontSize: '0.8125rem', flexShrink: 0, marginLeft: '0.5rem' }}>{p.estimated_cost}</span>}
                              </div>
                              {p.symptom_if_failed && (
                                <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>
                                  <em>If failed:</em> {p.symptom_if_failed}
                                </p>
                              )}
                              {p.test_method && (
                                <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.125rem' }}>
                                  <em>Test:</em> {p.test_method}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {c.weather_window_required && (
                    <div style={{ marginBottom: fixSteps.length > 0 ? '0.75rem' : 0, padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #F59E0B', borderRadius: 4, fontSize: '0.8125rem' }}>
                      <strong>Weather window: </strong>{c.weather_window_required}
                    </div>
                  )}

                  {fixSteps.length > 0 && (
                    <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid #2A2A2E' }}>
                      <p className="text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                        Fix Path
                      </p>
                      <div className="stack-sm">
                        {fixSteps.map(function (step, si) {
                          return (
                            <div key={si} className="row" style={{ gap: '0.5rem', alignItems: 'flex-start' }}>
                              <span style={{ fontWeight: 600, color: '#22D3EE', minWidth: 18, fontSize: '0.875rem' }}>
                                {(step.step != null ? step.step : si + 1) + '.'}
                              </span>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.9375rem' }}>{step.action || step.instruction || step}</p>
                                {step.tip && (
                                  <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                    Tip: {step.tip}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SCADA context note */}
        {result.scada_context_note && (
          <div className="card">
            <p style={{ fontSize: '0.875rem' }}>
              <span className="text-secondary">SCADA context: </span>{result.scada_context_note}
            </p>
          </div>
        )}

        {/* OEM bulletin reference */}
        {result.oem_bulletin_reference && (
          <div className="card" style={{ borderLeft: '4px solid #22D3EE' }}>
            <strong style={{ color: '#22D3EE' }}>OEM bulletin: </strong>
            <span>{result.oem_bulletin_reference}</span>
          </div>
        )}

        {/* Cold climate considerations */}
        {result.cold_climate_considerations && (
          <div className="card" style={{ borderLeft: '4px solid #3B82F6' }}>
            <strong style={{ color: '#3B82F6' }}>Cold climate: </strong>
            <span>{result.cold_climate_considerations}</span>
          </div>
        )}

        {/* Do not restart until */}
        {result.do_not_restart_until && (
          <div className="warning-box">
            <strong>Do not restart until: </strong>{result.do_not_restart_until}
          </div>
        )}

        {/* Escalate */}
        {result.escalate_if && (
          <div className="warning-box">
            <strong>Escalate if: </strong>{result.escalate_if}
          </div>
        )}

        {/* Estimated Fix Time */}
        {result.estimated_fix_time && (
          <div className="card">
            <div className="row-between">
              <span className="text-secondary">Estimated fix time</span>
              <strong>{result.estimated_fix_time}</strong>
            </div>
          </div>
        )}

        {/* Confidence */}
        {result.confidence && (
          <div className="card">
            <div className="row-between" style={{ alignItems: 'center' }}>
              <span className="text-secondary">Confidence</span>
              <span className={'badge ' + (result.confidence === 'high' ? 'badge-green' : result.confidence === 'medium' ? 'badge-amber' : 'badge-red')}>
                {result.confidence}
              </span>
            </div>
            {result.confidence_reasoning && (
              <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                {result.confidence_reasoning}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className="page">
        <LoadingSpinner messages={AI_MESSAGES} />
      </div>
    );
  }

  // Conversation view
  if (messages.length > 0) {
    return (
      <div className="page">
        <div className="stack">
          <div className="page-header">
            <h2>Diagnosis</h2>
            {model && <div style={{ fontSize: '0.6875rem', color: '#6B6B73', marginTop: '0.25rem' }}>{model}</div>}
          </div>

          {messages.map(function (msg, i) {
            if (msg.role === 'user') {
              return (
                <div key={i} className="card" style={{ borderColor: '#22D3EE', borderWidth: 1 }}>
                  <p className="text-secondary" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>You</p>
                  <p>{msg.content}</p>
                </div>
              );
            }
            return (
              <div key={i}>
                {renderResult(msg.data)}
              </div>
            );
          })}

          {loading && (
            <div className="spinner-container" style={{ padding: '1rem' }}>
              <div className="spinner" />
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {/* Follow-up input */}
          <div className="card">
            <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Ask a follow-up question</p>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Ask more about this issue..."
                value={followUp}
                onChange={function (e) { setFollowUp(e.target.value); }}
                onKeyDown={function (e) { if (e.key === 'Enter') handleFollowUp(); }}
              />
              <button className="btn btn-primary" onClick={handleFollowUp} disabled={loading || !sessionId || !followUp.trim()}>
                Send
              </button>
            </div>
          </div>

          <button className="btn btn-secondary btn-block" onClick={handleReset}>
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // Initial form
  return (
    <div className="page">
      <div className="stack">
        <div className="page-header">
          <h2>Troubleshoot</h2>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
            Describe your issue and get an AI-powered diagnosis
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="form-group">
          <label>Turbine Model</label>
          <select className="select" value={form.turbine_model} onChange={function (e) { set('turbine_model', e.target.value); }}>
            <option value="">Select...</option>
            {TURBINE_MODELS.map(function (t) { return <option key={t} value={t}>{t}</option>; })}
          </select>
        </div>

        <div className="form-group">
          <label>Component</label>
          <select className="select" value={form.component} onChange={function (e) { set('component', e.target.value); }}>
            <option value="">Select...</option>
            {COMPONENTS.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
        </div>

        <div className="form-group">
          <label>Symptoms *</label>
          <textarea
            className="input"
            rows={4}
            style={{ resize: 'vertical' }}
            placeholder="Describe what's happening... (e.g., unusual vibration at high wind speeds, oil leak from gearbox)"
            value={form.symptoms}
            onChange={function (e) { set('symptoms', e.target.value); }}
          />
        </div>

        <div className="form-group">
          <label>Environment</label>
          <select className="select" value={form.environment} onChange={function (e) { set('environment', e.target.value); }}>
            <option value="">Select...</option>
            {ENVIRONMENTS.map(function (env) { return <option key={env} value={env}>{env}</option>; })}
          </select>
        </div>

        <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Analyzing...' : 'Get Diagnosis'}
        </button>
      </div>
    </div>
  );
}
