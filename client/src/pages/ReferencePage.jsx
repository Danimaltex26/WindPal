import { useState } from 'react';
import { apiPost } from '../utils/api';

var QUICK_RANGES = [
  { param: 'Cut-in Wind Speed', ideal: '3-4 m/s (typical)', note: 'IEC 61400' },
  { param: 'Rated Wind Speed', ideal: '11-15 m/s (typical)', note: '' },
  { param: 'Cut-out Wind Speed', ideal: '25 m/s (typical)', note: '' },
  { param: 'Survival Wind Speed', ideal: '52.5-70 m/s', note: 'IEC Class I-III' },
  { param: 'Gearbox Oil Temp', ideal: '45-65 C normal', note: 'Alarm >80 C' },
  { param: 'Generator Bearing Temp', ideal: '<95 C', note: 'Alarm >110 C' },
  { param: 'Main Bearing Temp', ideal: '<70 C', note: 'Alarm >85 C' },
  { param: 'Hydraulic Pressure', ideal: '180-250 bar (typical)', note: 'System dependent' },
];

function QuickRanges() {
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 12px' }}>Quick Reference Ranges</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <th style={{ textAlign: 'left', padding: 6 }}>Parameter</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Value</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Ref</th>
          </tr>
        </thead>
        <tbody>
          {QUICK_RANGES.map(function (r) {
            return (
              <tr key={r.param} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: 6, fontWeight: 500 }}>{r.param}</td>
                <td style={{ padding: 6, color: '#22D3EE' }}>{r.ideal}</td>
                <td style={{ padding: 6, color: '#aaa' }}>{r.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ReferencePage() {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [model, setModel] = useState('');

  async function handleSearch() {
    if (!query.trim()) return;
    setError('');
    setLoading(true);
    setResults(null);
    try {
      var data = await apiPost('/reference/query', { query: query });
      setResults(data.results || data.result || data);
      setModel(data.model || '');
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  var TABS = [
    { id: 'search', label: 'AI Search' },
    { id: 'ranges', label: 'Quick Ranges' },
  ];

  return (
    <div className="page">
      <h2 className="page-header">Reference</h2>

      {/* Top-level tabs */}
      <div className="toggle-group" style={{ marginBottom: '1rem' }}>
        {TABS.map(function (t) {
          return (
            <button
              key={t.id}
              className={'toggle-option' + (tab === t.id ? ' active' : '')}
              onClick={function () { setTab(t.id); }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* AI Search */}
      {tab === 'search' && (
        <div className="stack">
          {error && <div className="error-banner">{error}</div>}

          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask a wind turbine question..."
              value={query}
              onChange={function (e) { setQuery(e.target.value); }}
              onKeyDown={function (e) { if (e.key === 'Enter') handleSearch(); }}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {loading && (
            <div className="spinner-container" style={{ padding: '1.5rem' }}>
              <div className="spinner" />
            </div>
          )}

          {results && model && <div style={{ fontSize: '0.6875rem', color: '#6B6B73', marginBottom: '-0.5rem' }}>{model}</div>}

          {results && (Array.isArray(results) ? results : [results]).map(function (r, i) {
            var content = r.content_json || {};
            return (
              <div key={i} className="card">
                <div className="row-between" style={{ marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>{r.title}</h4>
                  <div className="row" style={{ gap: 6 }}>
                    {r.category && <span className="badge badge-blue">{r.category}</span>}
                    {r.source && <span className="badge badge-gray">{r.source}</span>}
                  </div>
                </div>
                {content.summary && <p style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>{content.summary}</p>}
                {content.key_values && content.key_values.length > 0 && (
                  <div style={{ margin: '8px 0' }}>
                    {content.key_values.map(function (kv, j) {
                      return (
                        <div key={j} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, auto) 1fr', gap: '0.25rem 0.75rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-secondary" style={{ fontSize: '0.8125rem' }}>{kv.label}</span>
                          <span style={{ fontSize: '0.8125rem', color: '#22D3EE' }}>{kv.value}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {content.important_notes && content.important_notes.length > 0 && (
                  <div className="warning-box" style={{ marginTop: 8, fontSize: '0.8125rem' }}>
                    <ul style={{ margin: '0 0 0 16px', listStyle: 'disc' }}>
                      {content.important_notes.map(function (note, j) { return <li key={j}>{note}</li>; })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Ranges */}
      {tab === 'ranges' && (
        <div className="stack">
          <QuickRanges />
        </div>
      )}
    </div>
  );
}
