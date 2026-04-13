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
  const [followUp, setFollowUp] = useState('');

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
    try {
      var data = await apiPost('/troubleshoot', form);
      var result = data.result || data;
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
    if (!followUp.trim()) return;
    var userMsg = followUp;
    setFollowUp('');
    setError('');
    setLoading(true);
    var newMessages = messages.concat([{ role: 'user', content: userMsg }]);
    setMessages(newMessages);
    try {
      var data = await apiPost('/troubleshoot/followup', {
        conversation: newMessages,
        message: userMsg,
        turbine_model: form.turbine_model,
        component: form.component,
        environment: form.environment,
      });
      var result = data.result || data;
      setMessages(newMessages.concat([{ role: 'assistant', data: result }]));
    } catch (err) {
      setError(err.message || 'Follow-up failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setError('');
    setFollowUp('');
    setForm({
      turbine_model: '',
      component: '',
      symptoms: '',
      environment: '',
    });
  }

  function renderResult(result) {
    if (!result) return null;
    return (
      <div className="stack">
        {result.plain_english_summary && (
          <div className="card">
            <p style={{ fontSize: '1.125rem', lineHeight: 1.6 }}>{result.plain_english_summary}</p>
          </div>
        )}

        {result.probable_causes && result.probable_causes.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Probable Causes</h3>
            <div className="stack-sm">
              {result.probable_causes.map(function (c, i) {
                return (
                  <div key={i} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #2A2A2E' }}>
                    <div className="row" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: '#10B981', minWidth: 24 }}>{'#' + (c.rank || i + 1)}</span>
                      <strong>{c.cause}</strong>
                      {c.likelihood && (
                        <span className={'badge ' + (c.likelihood === 'high' ? 'badge-red' : c.likelihood === 'medium' ? 'badge-amber' : 'badge-gray')}>
                          {c.likelihood}
                        </span>
                      )}
                    </div>
                    {c.explanation && <p className="text-secondary" style={{ fontSize: '0.875rem', marginLeft: 32 }}>{c.explanation}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result.step_by_step_fix && result.step_by_step_fix.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Step-by-Step Fix</h3>
            <div className="stack-sm">
              {result.step_by_step_fix.map(function (s, i) {
                return (
                  <div key={i} className="row" style={{ gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 700, color: '#10B981', minWidth: 24 }}>{s.step || i + 1}</span>
                    <div>
                      <p>{s.action}</p>
                      {s.tip && <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>{'Tip: ' + s.tip}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result.parts_to_check && result.parts_to_check.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Parts to Check</h3>
            <div className="stack-sm">
              {result.parts_to_check.map(function (p, i) {
                return (
                  <div key={i} className="row-between" style={{ padding: '0.5rem 0', borderBottom: '1px solid #2A2A2E' }}>
                    <div>
                      <strong>{p.part}</strong>
                      {p.symptom_if_failed && <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>{p.symptom_if_failed}</p>}
                    </div>
                    {p.estimated_cost && <span className="text-secondary" style={{ fontSize: '0.875rem' }}>{p.estimated_cost}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result.safety_warning && (
          <div className="warning-box">
            <strong>Safety Warning:</strong> {result.safety_warning}
          </div>
        )}

        {result.escalate_if && (
          <div className="warning-box">
            <strong>Escalate if:</strong> {result.escalate_if}
          </div>
        )}

        {result.estimated_fix_time && (
          <div className="info-box">
            <strong>Estimated Fix Time:</strong> {result.estimated_fix_time}
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
            <h2>Troubleshoot</h2>
          </div>

          {messages.map(function (msg, i) {
            if (msg.role === 'user') {
              return (
                <div key={i} className="card" style={{ borderColor: '#10B981', borderWidth: 1 }}>
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
              <button className="btn btn-primary" onClick={handleFollowUp} disabled={loading}>
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
