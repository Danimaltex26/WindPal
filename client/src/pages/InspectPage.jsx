import { useState, useRef } from 'react';
import { apiUpload } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';

var AI_MESSAGES = [
  'Analyzing your turbine photo...',
  'Inspecting component condition...',
  'Identifying issues...',
  'Almost done...',
];

var COMPONENT_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'blade', label: 'Blade' },
  { value: 'gearbox', label: 'Gearbox' },
  { value: 'generator', label: 'Generator' },
  { value: 'tower', label: 'Tower' },
  { value: 'nacelle', label: 'Nacelle' },
];

function severityBadge(severity) {
  if (!severity) return 'badge badge-gray';
  var s = severity.toLowerCase();
  if (s === 'critical' || s === 'severe') return 'badge badge-red';
  if (s === 'moderate') return 'badge badge-amber';
  return 'badge badge-green';
}

function actionBadge(action) {
  if (!action) return 'badge badge-gray';
  var a = action.toLowerCase();
  if (a.indexOf('routine') >= 0 || a.indexOf('maintenance') >= 0) return 'badge badge-green';
  if (a.indexOf('repair') >= 0 || a.indexOf('replace') >= 0) return 'badge badge-amber';
  if (a.indexOf('immediate') >= 0 || a.indexOf('shutdown') >= 0) return 'badge badge-red';
  return 'badge badge-gray';
}

export default function InspectPage() {
  const [componentType, setComponentType] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  var fileInputRef = useRef(null);

  async function handleUpload(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setResult(null);
    setLoading(true);

    var formData = new FormData();
    for (var i = 0; i < Math.min(files.length, 4); i++) {
      formData.append('images', files[i]);
    }
    if (componentType) formData.append('component_type', componentType);

    try {
      var data = await apiUpload('/inspect', formData);
      setResult(data.result);
    } catch (err) {
      setError(err.message || 'Failed to analyze. Please try again.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleReset() {
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (loading) {
    return (
      <div className="page">
        <LoadingSpinner messages={AI_MESSAGES} />
      </div>
    );
  }

  if (result) {
    return (
      <div className="page">
        <div className="stack">
          <div className="page-header">
            <h2>Inspection Result</h2>
          </div>

          {result.plain_english_summary && (
            <div className="card">
              <p style={{ fontSize: '1.125rem', lineHeight: 1.6 }}>{result.plain_english_summary}</p>
            </div>
          )}

          {result.diagnosis && (
            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Diagnosis</h3>
              <p className="text-secondary">{result.diagnosis}</p>
            </div>
          )}

          {result.severity && (
            <div className="card">
              <div className="row-between">
                <strong>Severity</strong>
                <span className={severityBadge(result.severity)}>{result.severity}</span>
              </div>
            </div>
          )}

          {result.recommended_action && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '0.5rem' }}>
                <strong>Recommended Action</strong>
                <span className={actionBadge(result.recommended_action)}>
                  {result.recommended_action.replace(/_/g, ' ')}
                </span>
              </div>
              {result.confidence && (
                <div className="row" style={{ marginTop: '0.5rem' }}>
                  <span className="text-secondary" style={{ fontSize: '0.875rem' }}>Confidence:</span>
                  <span className={'badge ' + (result.confidence === 'high' ? 'badge-green' : result.confidence === 'medium' ? 'badge-amber' : 'badge-red')}>
                    {result.confidence}
                  </span>
                </div>
              )}
            </div>
          )}

          {result.safety_warning && (
            <div className="warning-box">{result.safety_warning}</div>
          )}

          {result.findings && result.findings.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Findings</h3>
              <div className="stack-sm">
                {result.findings.map(function (f, i) {
                  return (
                    <div key={i} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #2A2A2E' }}>
                      <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                        <strong>{f.issue}</strong>
                        <span className={severityBadge(f.severity)}>{f.severity}</span>
                      </div>
                      <p className="text-secondary" style={{ fontSize: '0.875rem' }}>{f.description}</p>
                      {f.probable_cause && (
                        <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                          <span className="text-secondary">Cause:</span> {f.probable_cause}
                        </p>
                      )}
                      {f.immediate_action && (
                        <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                          <span className="text-secondary">Action:</span> {f.immediate_action}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Recommendations</h3>
              <div className="stack-sm">
                {result.recommendations.map(function (r, i) {
                  return (
                    <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid #2A2A2E' }}>
                      <p>{r}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className="btn btn-secondary btn-block" onClick={handleReset}>
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="stack">
        <div className="page-header">
          <h2>Turbine Photo Inspection</h2>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
            Upload a photo of a wind turbine component for AI-powered analysis
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Component Type */}
        <div className="form-group">
          <label>Component Type (optional)</label>
          <select className="select" value={componentType} onChange={function (e) { setComponentType(e.target.value); }}>
            {COMPONENT_TYPES.map(function (ct) {
              return <option key={ct.value} value={ct.value}>{ct.label}</option>;
            })}
          </select>
        </div>

        {/* Upload Area */}
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            minHeight: 220,
            border: '2px dashed #2A2A2E',
            borderRadius: 16,
            cursor: 'pointer',
            padding: '2rem',
            textAlign: 'center',
            transition: 'border-color 0.15s',
          }}
          onDragOver={function (e) { e.preventDefault(); e.currentTarget.style.borderColor = '#22D3EE'; }}
          onDragLeave={function (e) { e.currentTarget.style.borderColor = '#2A2A2E'; }}
          onDrop={function (e) {
            e.preventDefault();
            e.currentTarget.style.borderColor = '#2A2A2E';
            if (e.dataTransfer.files.length) {
              var dt = new DataTransfer();
              for (var i = 0; i < e.dataTransfer.files.length; i++) {
                dt.items.add(e.dataTransfer.files[i]);
              }
              fileInputRef.current.files = dt.files;
              handleUpload({ target: { files: dt.files } });
            }
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div>
            <p style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Tap to upload or take a photo</p>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Photo of blades, gearbox, generator, tower, or nacelle (up to 4)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  );
}
