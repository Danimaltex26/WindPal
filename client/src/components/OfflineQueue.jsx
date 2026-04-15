import { useState } from 'react';

function statusIcon(status) {
  switch (status) {
    case 'pending': return '\u23F3'; // hourglass
    case 'processing': return '\u2699'; // gear
    case 'completed': return '\u2705'; // check
    case 'failed': return '\u274C'; // x
    default: return '\u2753';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'pending': return 'Waiting for connection';
    case 'processing': return 'Processing...';
    case 'completed': return 'Ready to view';
    case 'failed': return 'Failed';
    default: return status;
  }
}

function statusColor(status) {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'processing': return '#14B8A6';
    case 'completed': return '#22C55E';
    case 'failed': return '#EF4444';
    default: return '#A0A0A8';
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function OfflineQueue({ queue, onRetry, onDismiss, onViewResult, onClearCompleted, processing }) {
  const [expanded, setExpanded] = useState(true);

  if (queue.length === 0) return null;

  const pendingOrProcessing = queue.filter(q => q.status === 'pending' || q.status === 'processing');
  const completed = queue.filter(q => q.status === 'completed');
  const failed = queue.filter(q => q.status === 'failed');
  const isOnline = navigator.onLine;

  return (
    <div className="card" style={{ padding: '0.75rem' }}>
      <div
        className="row-between"
        style={{ cursor: 'pointer', marginBottom: expanded ? '0.5rem' : 0 }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="row" style={{ gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>
            {!isOnline ? '\uD83D\uDEAB' : processing ? '\u2699' : '\uD83D\uDCF7'}
          </span>
          <strong style={{ fontSize: '0.9375rem' }}>
            Offline Queue ({queue.length})
          </strong>
          {!isOnline && (
            <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>OFFLINE</span>
          )}
        </div>
        <span style={{ color: '#6B6B73', fontSize: '1.25rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          &#9662;
        </span>
      </div>

      {expanded && (
        <div className="stack-sm">
          {/* Pending / Processing */}
          {pendingOrProcessing.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem', backgroundColor: '#0D0D0F', borderRadius: 8,
              border: '1px solid #2A2A2E',
            }}>
              <span style={{ fontSize: '1.25rem' }}>{statusIcon(item.status)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {item.analysis_type || 'Auto-detect'} — {item.files?.length || 0} photo{item.files?.length !== 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: '0.75rem', color: statusColor(item.status) }}>
                  {statusLabel(item.status)} — {formatTime(item.created_at)}
                </p>
              </div>
              {item.status === 'processing' && (
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              )}
            </div>
          ))}

          {/* Completed */}
          {completed.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: 8,
              border: '1px solid rgba(34, 197, 94, 0.2)', cursor: 'pointer',
            }}
            onClick={() => onViewResult && onViewResult(item)}
            >
              <span style={{ fontSize: '1.25rem' }}>{statusIcon(item.status)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {item.analysis_type || 'Auto-detect'} — {item.files?.length || 0} photo{item.files?.length !== 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#22C55E' }}>
                  Ready — tap to view
                </p>
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', minHeight: 'auto', fontSize: '0.75rem' }}
                onClick={(e) => { e.stopPropagation(); onDismiss(item.id); }}
              >
                Dismiss
              </button>
            </div>
          ))}

          {/* Failed */}
          {failed.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}>
              <span style={{ fontSize: '1.25rem' }}>{statusIcon(item.status)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {item.analysis_type || 'Auto-detect'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#EF4444' }}>
                  {item.error || 'Failed'} — {formatTime(item.created_at)}
                </p>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', minHeight: 'auto', fontSize: '0.75rem', color: '#14B8A6' }}
                  onClick={() => onRetry(item.id)}
                >
                  Retry
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', minHeight: 'auto', fontSize: '0.75rem' }}
                  onClick={() => onDismiss(item.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}

          {/* Clear completed button */}
          {completed.length > 1 && (
            <button
              className="btn btn-ghost btn-block"
              style={{ fontSize: '0.8125rem', minHeight: 36 }}
              onClick={onClearCompleted}
            >
              Clear all completed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
