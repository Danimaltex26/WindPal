import { useState, useEffect } from 'react';
import { apiGet, apiPatch, apiDelete } from '../utils/api';

export default function HistoryPage() {
  const [tab, setTab] = useState('inspections');
  const [inspections, setInspections] = useState([]);
  const [troubleshoots, setTroubleshoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState({});
  const [editValues, setEditValues] = useState({});

  async function fetchHistory() {
    setLoading(true);
    setError('');
    try {
      var data = await apiGet('/history');
      setInspections(data.inspections || []);
      setTroubleshoots(data.troubleshoot_sessions || []);
    } catch (err) {
      setError(err.message || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () { fetchHistory(); }, []);

  function toggle(id) {
    setExpanded(function (prev) {
      var next = Object.assign({}, prev);
      next[id] = !prev[id];
      return next;
    });
  }

  function startEdit(item) {
    setEditing(function (prev) {
      var next = Object.assign({}, prev);
      next[item.id] = true;
      return next;
    });
    setEditValues(function (prev) {
      var next = Object.assign({}, prev);
      next[item.id] = { title: item.title || '', notes: item.notes || '' };
      return next;
    });
  }

  function cancelEdit(id) {
    setEditing(function (prev) {
      var next = Object.assign({}, prev);
      next[id] = false;
      return next;
    });
  }

  async function saveEdit(id, type) {
    try {
      var endpoint = type === 'inspection' ? '/history/inspection/' + id : '/history/troubleshoot/' + id;
      await apiPatch(endpoint, editValues[id]);
      setEditing(function (prev) {
        var next = Object.assign({}, prev);
        next[id] = false;
        return next;
      });
      fetchHistory();
    } catch (err) {
      setError(err.message || 'Save failed.');
    }
  }

  async function handleDelete(id, type) {
    if (!confirm('Delete this entry?')) return;
    try {
      var endpoint = type === 'inspection' ? '/history/inspection/' + id : '/history/troubleshoot/' + id;
      await apiDelete(endpoint);
      fetchHistory();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  }

  async function markResolved(id) {
    try {
      await apiPatch('/history/troubleshoot/' + id + '/resolve', {});
      fetchHistory();
    } catch (err) {
      setError(err.message || 'Update failed.');
    }
  }

  function formatDate(d) {
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch (e) { return d; }
  }

  function renderInspection(item) {
    var isOpen = expanded[item.id];
    var isEditing = editing[item.id];

    return (
      <div key={item.id} className="card">
        <div className="expandable-header" onClick={function () { toggle(item.id); }}>
          <div style={{ flex: 1 }}>
            <div className="row-between">
              <strong>{item.title || 'Turbine Inspection'}</strong>
              <span className="text-secondary" style={{ fontSize: 13 }}>{formatDate(item.created_at)}</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {item.component_type && <span className="badge badge-blue">{item.component_type}</span>}
              {item.severity && <span className={'badge ' + (item.severity === 'critical' ? 'badge-red' : item.severity === 'moderate' ? 'badge-amber' : 'badge-green')}>{item.severity}</span>}
            </div>
          </div>
          <span style={{ color: '#6B6B73', fontSize: '1.25rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', marginLeft: 8 }}>&#9662;</span>
        </div>

        {isOpen && (
          <div style={{ marginTop: 12 }}>
            {isEditing ? (
              <div className="stack-sm">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    className="input"
                    value={(editValues[item.id] && editValues[item.id].title) || ''}
                    placeholder="e.g. Site A blade crack"
                    onChange={function (e) {
                      var val = e.target.value;
                      setEditValues(function (prev) {
                        var next = Object.assign({}, prev);
                        next[item.id] = Object.assign({}, prev[item.id], { title: val });
                        return next;
                      });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Add notes about this inspection..."
                    value={(editValues[item.id] && editValues[item.id].notes) || ''}
                    onChange={function (e) {
                      var val = e.target.value;
                      setEditValues(function (prev) {
                        var next = Object.assign({}, prev);
                        next[item.id] = Object.assign({}, prev[item.id], { notes: val });
                        return next;
                      });
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={function () { saveEdit(item.id, 'inspection'); }}>Save</button>
                  <button className="btn btn-ghost" onClick={function () { cancelEdit(item.id); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {item.diagnosis && (
                  <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: 8 }}>{item.diagnosis}</p>
                )}
                {item.recommended_action && (
                  <div className="info-box" style={{ fontSize: '0.875rem', marginBottom: 8 }}>
                    <strong>Recommended:</strong> {item.recommended_action}
                  </div>
                )}
                {item.notes && (
                  <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 8 }}>
                    <strong style={{ color: '#F5F5F5' }}>Notes:</strong> {item.notes}
                  </p>
                )}
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={function () { startEdit(item); }}>Edit</button>
                  <button className="btn btn-danger" onClick={function () { handleDelete(item.id, 'inspection'); }}>Delete</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderTroubleshoot(item) {
    var isOpen = expanded[item.id];
    var isEditing = editing[item.id];

    return (
      <div key={item.id} className="card">
        <div className="expandable-header" onClick={function () { toggle(item.id); }}>
          <div style={{ flex: 1 }}>
            <div className="row-between">
              <strong>{item.title || item.symptom || 'Troubleshoot Session'}</strong>
              <span className="text-secondary" style={{ fontSize: 13 }}>{formatDate(item.created_at)}</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {item.turbine_model && <span className="badge badge-blue">{item.turbine_model}</span>}
              {item.component && <span className="badge badge-gray">{item.component}</span>}
              {item.resolved ? <span className="badge badge-green">Resolved</span> : <span className="badge badge-amber">Open</span>}
            </div>
          </div>
          <span style={{ color: '#6B6B73', fontSize: '1.25rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', marginLeft: 8 }}>&#9662;</span>
        </div>

        {isOpen && (
          <div style={{ marginTop: 12 }}>
            {isEditing ? (
              <div className="stack-sm">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    className="input"
                    value={(editValues[item.id] && editValues[item.id].title) || ''}
                    placeholder="e.g. Gearbox vibration issue"
                    onChange={function (e) {
                      var val = e.target.value;
                      setEditValues(function (prev) {
                        var next = Object.assign({}, prev);
                        next[item.id] = Object.assign({}, prev[item.id], { title: val });
                        return next;
                      });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Add notes about this session..."
                    value={(editValues[item.id] && editValues[item.id].notes) || ''}
                    onChange={function (e) {
                      var val = e.target.value;
                      setEditValues(function (prev) {
                        var next = Object.assign({}, prev);
                        next[item.id] = Object.assign({}, prev[item.id], { notes: val });
                        return next;
                      });
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={function () { saveEdit(item.id, 'troubleshoot'); }}>Save</button>
                  <button className="btn btn-ghost" onClick={function () { cancelEdit(item.id); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {item.symptom && (
                  <div style={{ marginBottom: 8, padding: '8px 0', borderBottom: '1px solid #2A2A2E' }}>
                    <span className="text-secondary" style={{ fontSize: '0.8125rem' }}>Symptom:</span>
                    <p style={{ fontSize: '0.9375rem' }}>{item.symptom}</p>
                  </div>
                )}
                {item.notes && (
                  <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 8 }}>
                    <strong style={{ color: '#F5F5F5' }}>Notes:</strong> {item.notes}
                  </p>
                )}
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={function () { startEdit(item); }}>Edit</button>
                  {!item.resolved && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={function () { markResolved(item.id); }}>Resolve</button>
                  )}
                  <button className="btn btn-danger" onClick={function () { handleDelete(item.id, 'troubleshoot'); }}>Delete</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-header">History</h2>

      {error && <div className="error-banner">{error}</div>}

      <div className="toggle-group" style={{ marginBottom: '1rem' }}>
        <button className={'toggle-option' + (tab === 'inspections' ? ' active' : '')} onClick={function () { setTab('inspections'); }}>
          {'Inspections (' + inspections.length + ')'}
        </button>
        <button className={'toggle-option' + (tab === 'troubleshoot' ? ' active' : '')} onClick={function () { setTab('troubleshoot'); }}>
          {'Troubleshoot (' + troubleshoots.length + ')'}
        </button>
      </div>

      {loading && (
        <div className="spinner-container">
          <div className="spinner" />
          <p className="spinner-message">Loading history...</p>
        </div>
      )}

      {!loading && tab === 'inspections' && (
        inspections.length === 0
          ? <p className="text-center text-secondary" style={{ padding: '2rem 0' }}>No turbine inspections yet.</p>
          : <div className="stack">{inspections.map(renderInspection)}</div>
      )}

      {!loading && tab === 'troubleshoot' && (
        troubleshoots.length === 0
          ? <p className="text-center text-secondary" style={{ padding: '2rem 0' }}>No troubleshoot sessions yet.</p>
          : <div className="stack">{troubleshoots.map(renderTroubleshoot)}</div>
      )}
    </div>
  );
}
