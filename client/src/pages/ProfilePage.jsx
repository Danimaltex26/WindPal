import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

var SPECIALTIES = [
  'Blade Repair',
  'Mechanical',
  'Electrical',
  'Hydraulics',
  'Controls/SCADA',
  'Composite Repair',
  'Tower/Foundation',
  'Offshore',
];

var CERTIFICATIONS = [
  'GWO BST',
  'GWO BTT',
  'ACP Wind Tech',
  'OSHA 10',
  'OSHA 30',
  'Other',
];

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
  'GE 1.5sle',
  'GE 2.x-127',
  'GE 3.x-137',
  'GE 5.x-158',
  'Nordex N117',
  'Nordex N131',
  'Nordex N149',
  'Enercon E-82',
  'Enercon E-115',
  'Enercon E-126',
  'Other',
];

export default function ProfilePage() {
  var auth = useAuth();
  var user = auth.user;
  var signOut = auth.signOut;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  async function fetchProfile() {
    try {
      var data = await apiGet('/profile');
      setProfile(data);
      setNameValue(data.display_name || '');
    } catch (err) {
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () { fetchProfile(); }, []);

  async function saveName() {
    try {
      await apiPatch('/profile', { display_name: nameValue });
      setEditingName(false);
      fetchProfile();
    } catch (err) {
      setError(err.message || 'Save failed.');
    }
  }

  async function toggleSpecialty(s) {
    var current = (profile && profile.specialties) || [];
    var updated = current.indexOf(s) >= 0 ? current.filter(function (x) { return x !== s; }) : current.concat([s]);
    try {
      await apiPatch('/profile', { specialties: updated });
      fetchProfile();
    } catch (err) {
      setError(err.message || 'Update failed.');
    }
  }

  async function toggleCert(c) {
    var current = (profile && profile.certifications) || [];
    var updated = current.indexOf(c) >= 0 ? current.filter(function (x) { return x !== c; }) : current.concat([c]);
    try {
      await apiPatch('/profile', { certifications: updated });
      fetchProfile();
    } catch (err) {
      setError(err.message || 'Update failed.');
    }
  }

  async function toggleTurbineModel(m) {
    var current = (profile && profile.turbine_models) || [];
    var updated = current.indexOf(m) >= 0 ? current.filter(function (x) { return x !== m; }) : current.concat([m]);
    try {
      await apiPatch('/profile', { turbine_models: updated });
      fetchProfile();
    } catch (err) {
      setError(err.message || 'Update failed.');
    }
  }

  function subBadge(tier) {
    var map = { pro: 'badge-green', premium: 'badge-blue', free: 'badge-gray' };
    return map[(tier || '').toLowerCase()] || 'badge-gray';
  }

  function usageBar(used, limit) {
    var pct = Math.min((used / limit) * 100, 100);
    return (
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: pct + '%', height: '100%', background: '#10B981', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    );
  }

  if (loading) return <div className="page"><p className="text-center text-secondary">Loading...</p></div>;

  var p = profile || {};
  var usage = p.usage || {};
  var isFree = !p.subscription || p.subscription === 'free';

  return (
    <div className="page">
      <h2 className="page-header">Profile</h2>

      {error && <div className="error-banner">{error}</div>}

      {/* Name / Email / Subscription */}
      <div className="card">
        <div className="row-between" style={{ alignItems: 'center' }}>
          {editingName ? (
            <div className="row" style={{ gap: 8, flex: 1 }}>
              <input className="input" style={{ flex: 1 }} value={nameValue} onChange={function (e) { setNameValue(e.target.value); }} />
              <button className="btn btn-primary" onClick={saveName}>Save</button>
              <button className="btn btn-ghost" onClick={function () { setEditingName(false); }}>Cancel</button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{p.display_name || (user && user.email) || 'User'}</h3>
              <button className="btn btn-ghost" onClick={function () { setNameValue(p.display_name || ''); setEditingName(true); }} style={{ padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <p className="text-secondary" style={{ margin: '4px 0 0' }}>{(user && user.email) || p.email}</p>
        <div style={{ marginTop: 8 }}>
          <span className={'badge ' + subBadge(p.subscription)}>{(p.subscription || 'Free').toUpperCase()}</span>
        </div>
      </div>

      {/* Usage -- free tier only */}
      {isFree && (
        <div className="card">
          <h4 style={{ margin: '0 0 12px' }}>Usage</h4>
          <div className="stack-sm">
            <div>
              <div className="row-between"><span>Inspections</span><span>{(usage.inspections || 0) + '/2'}</span></div>
              {usageBar(usage.inspections || 0, 2)}
            </div>
            <div>
              <div className="row-between"><span>Troubleshoot</span><span>{(usage.troubleshoot || 0) + '/2'}</span></div>
              {usageBar(usage.troubleshoot || 0, 2)}
            </div>
            <div>
              <div className="row-between"><span>AI Reference</span><span>{(usage.ai_reference || 0) + '/5'}</span></div>
              {usageBar(usage.ai_reference || 0, 5)}
            </div>
          </div>
        </div>
      )}

      {/* Turbine Models */}
      <div className="card">
        <h4 style={{ margin: '0 0 12px' }}>Turbine Models</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TURBINE_MODELS.map(function (m) {
            var active = ((p.turbine_models) || []).indexOf(m) >= 0;
            return (
              <button
                key={m}
                className={'btn ' + (active ? 'btn-primary' : 'btn-secondary')}
                style={{ fontSize: 13 }}
                onClick={function () { toggleTurbineModel(m); }}
              >
                {active ? '- ' + m : '+ ' + m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Certifications */}
      <div className="card">
        <h4 style={{ margin: '0 0 12px' }}>Certifications</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CERTIFICATIONS.map(function (c) {
            var active = ((p.certifications) || []).indexOf(c) >= 0;
            return (
              <button
                key={c}
                className={'btn ' + (active ? 'btn-primary' : 'btn-secondary')}
                style={{ fontSize: 13 }}
                onClick={function () { toggleCert(c); }}
              >
                {active ? '- ' + c : '+ ' + c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Specialties */}
      <div className="card">
        <h4 style={{ margin: '0 0 12px' }}>Specialties</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SPECIALTIES.map(function (s) {
            var active = ((p.specialties) || []).indexOf(s) >= 0;
            return (
              <button
                key={s}
                className={'btn ' + (active ? 'btn-primary' : 'btn-secondary')}
                style={{ fontSize: 13 }}
                onClick={function () { toggleSpecialty(s); }}
              >
                {active ? '- ' + s : '+ ' + s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="divider" />

      <button className="btn btn-danger btn-block" onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}
