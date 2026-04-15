import { useState, useRef } from 'react';
import { apiUpload } from '../utils/api';
import { compressImage } from '../utils/compressImage';
import LoadingSpinner from '../components/LoadingSpinner';
import OfflineQueue from '../components/OfflineQueue';
import useOfflineQueue from '../hooks/useOfflineQueue';

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
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [queued, setQueued] = useState(false);
  var fileInputRef = useRef(null);
  const offlineQueue = useOfflineQueue();

  async function handleUpload(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setResult(null);
    setQueued(false);

    // If offline, queue it
    if (!navigator.onLine) {
      await offlineQueue.enqueue(files, componentType);
      setQueued(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Online — upload directly
    setLoading(true);

    var formData = new FormData();
    for (var i = 0; i < Math.min(files.length, 4); i++) {
      var compressed = await compressImage(files[i]);
      formData.append('images', compressed);
    }
    if (componentType) formData.append('component_type', componentType);

    try {
      var data = await apiUpload('/inspect', formData);
      setResult(data.result);
      setModel(data.model || '');
    } catch (err) {
      // If upload fails (network dropped mid-request), queue it
      if (!navigator.onLine || err.message?.includes('fetch') || err.message?.includes('network')) {
        await offlineQueue.enqueue(files, componentType);
        setQueued(true);
      } else {
        setError(err.message || 'Failed to analyze. Please try again.');
      }
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleReset() {
    setResult(null);
    setModel('');
    setError('');
    setQueued(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleViewQueueResult(item) {
    if (item.result) {
      setResult(item.result);
      offlineQueue.dismiss(item.id);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <LoadingSpinner messages={AI_MESSAGES} />
      </div>
    );
  }

  if (result) {
    var imageUsable = result.is_wind_turbine_image !== false && result.image_quality?.usable !== false;
    var ctx = result.turbine_context;
    var blade = result.blade_analysis;
    var nacelle = result.nacelle_analysis;
    var gearbox = result.gearbox_analysis;
    var generator = result.generator_analysis;
    var tower = result.tower_analysis;
    var electrical = result.electrical_analysis;
    var pitchYaw = result.pitch_yaw_analysis;
    var faultDisplay = result.fault_display_analysis;

    function assessmentBadgeClass(a) {
      if (!a) return 'badge badge-gray';
      var s = a.toLowerCase();
      if (s.indexOf('immediate_shutdown') >= 0) return 'badge badge-red';
      if (s.indexOf('shutdown') >= 0) return 'badge badge-red';
      if (s.indexOf('schedule') >= 0) return 'badge badge-amber';
      if (s.indexOf('monitor') >= 0) return 'badge badge-amber';
      if (s.indexOf('safe') >= 0) return 'badge badge-green';
      return 'badge badge-gray';
    }

    function urgencyBadgeClass(u) {
      if (!u) return 'badge badge-gray';
      var s = u.toLowerCase();
      if (s === 'immediate' || s === 'immediate_shutdown' || s === 'before_climb') return 'badge badge-red';
      if (s === 'before_restart' || s === 'today' || s === 'next_scheduled_maintenance') return 'badge badge-amber';
      if (s === 'this_week') return 'badge badge-amber';
      if (s === 'next_pm' || s === 'routine' || s === 'monitor' || s === 'informational') return 'badge badge-green';
      return 'badge badge-gray';
    }

    function confidenceBadgeClass(c) {
      if (!c) return 'badge badge-gray';
      var s = c.toLowerCase();
      if (s.indexOf('high') >= 0) return 'badge badge-green';
      if (s.indexOf('medium') >= 0) return 'badge badge-amber';
      return 'badge badge-red';
    }

    return (
      <div className="page">
        <div className="stack">
          <div className="page-header">
            <h2>Inspection Result</h2>
            {model && <div style={{ fontSize: '0.6875rem', color: '#6B6B73', marginTop: '0.25rem' }}>{model}</div>}
          </div>

          {/* Unusable image warning */}
          {!imageUsable && (
            <div className="warning-box">
              <strong>Image could not be analyzed.</strong>
              {result.image_quality?.quality_note && (
                <p style={{ marginTop: '0.25rem' }}>{result.image_quality.quality_note}</p>
              )}
            </div>
          )}

          {/* Overall Assessment Badge */}
          {imageUsable && result.overall_assessment && (
            <div className="card" style={{ textAlign: 'center' }}>
              <span className={assessmentBadgeClass(result.overall_assessment)} style={{ fontSize: '1.25rem', padding: '0.5rem 1.5rem' }}>
                {result.overall_assessment.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          )}

          {/* Assessment Reasoning */}
          {result.assessment_reasoning && (
            <div className="card">
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.6 }}>{result.assessment_reasoning}</p>
            </div>
          )}

          {/* Immediate Safety Hazards */}
          {result.immediate_safety_hazards && result.immediate_safety_hazards.length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid #22D3EE' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Immediate Safety Hazards</h3>
              <div className="stack-sm">
                {result.immediate_safety_hazards.map(function (h, i) {
                  return (
                    <div key={i} className="warning-box">
                      <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                        <strong>{h.hazard_type ? h.hazard_type.replace(/_/g, ' ') : 'Hazard'}</strong>
                        {h.severity && <span className={severityBadge(h.severity)}>{h.severity}</span>}
                      </div>
                      {h.description && <p style={{ marginTop: '0.25rem' }}>{h.description}</p>}
                      {h.immediate_action && (
                        <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          <span className="text-secondary">Action:</span> {h.immediate_action}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detected Context */}
          {ctx && (ctx.turbine_manufacturer_detected || ctx.turbine_platform_detected || ctx.turbine_class_detected || ctx.approximate_capacity_mw || ctx.component_location) && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Detected</h3>
              <div className="stack-sm">
                {ctx.turbine_manufacturer_detected && ctx.turbine_manufacturer_detected !== 'Unknown' && ctx.turbine_manufacturer_detected !== 'Other' && (
                  <div className="row-between">
                    <span className="text-secondary">Manufacturer</span>
                    <span className="badge badge-blue">{ctx.turbine_manufacturer_detected}</span>
                  </div>
                )}
                {ctx.turbine_platform_detected && (
                  <div className="row-between">
                    <span className="text-secondary">Platform</span>
                    <span style={{ fontWeight: 600 }}>{ctx.turbine_platform_detected}</span>
                  </div>
                )}
                {ctx.turbine_class_detected && ctx.turbine_class_detected !== 'unknown' && (
                  <div className="row-between">
                    <span className="text-secondary">Class</span>
                    <span style={{ fontWeight: 600 }}>{ctx.turbine_class_detected}</span>
                  </div>
                )}
                {ctx.approximate_capacity_mw && (
                  <div className="row-between">
                    <span className="text-secondary">Capacity</span>
                    <span style={{ fontWeight: 600 }}>{ctx.approximate_capacity_mw}</span>
                  </div>
                )}
                {ctx.component_location && (
                  <div className="row-between">
                    <span className="text-secondary">Location</span>
                    <span style={{ fontWeight: 600 }}>{ctx.component_location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blade Analysis */}
          {blade?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Blade Analysis</h3>
              <div className="stack-sm">
                {blade.blade_position && blade.blade_position !== 'unknown' && (
                  <div className="row-between">
                    <span className="text-secondary">Position</span>
                    <span style={{ fontWeight: 600 }}>{blade.blade_position.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {blade.surface_condition && (
                  <div className="row-between">
                    <span className="text-secondary">Surface Condition</span>
                    <span className={severityBadge(blade.surface_condition)}>{blade.surface_condition}</span>
                  </div>
                )}
                {blade.repair_category && (
                  <div className="row-between">
                    <span className="text-secondary">Repair Category</span>
                    <span>{blade.repair_category.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {blade.continue_operation_recommendation && (
                  <div className="row-between">
                    <span className="text-secondary">Continue Operation</span>
                    <span className={assessmentBadgeClass(blade.continue_operation_recommendation)}>
                      {blade.continue_operation_recommendation.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>

              {blade.defects_found && blade.defects_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Defects Found</h4>
                  <div className="stack-sm">
                    {blade.defects_found.map(function (d, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{d.defect_type ? d.defect_type.replace(/_/g, ' ') : 'Defect'}</strong>
                            {d.severity && <span className={severityBadge(d.severity)}>{d.severity}</span>}
                          </div>
                          {d.location && <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>Location: {d.location}</p>}
                          {d.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{d.description}</p>}
                          {d.probable_cause && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Cause:</span> {d.probable_cause}
                            </p>
                          )}
                          {d.recommended_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {d.recommended_action}
                            </p>
                          )}
                          {d.urgency && (
                            <div style={{ marginTop: '0.375rem' }}>
                              <span className={urgencyBadgeClass(d.urgency)}>{d.urgency.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nacelle Analysis */}
          {nacelle?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Nacelle Analysis</h3>
              {nacelle.nacelle_condition && (
                <div className="row-between">
                  <span className="text-secondary">Condition</span>
                  <span className={severityBadge(nacelle.nacelle_condition)}>{nacelle.nacelle_condition}</span>
                </div>
              )}
              {nacelle.issues_found && nacelle.issues_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Issues</h4>
                  <div className="stack-sm">
                    {nacelle.issues_found.map(function (iss, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{iss.component || (iss.issue_type ? iss.issue_type.replace(/_/g, ' ') : 'Issue')}</strong>
                            {iss.severity && <span className={severityBadge(iss.severity)}>{iss.severity}</span>}
                          </div>
                          {iss.issue_type && iss.component && (
                            <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>{iss.issue_type.replace(/_/g, ' ')}</p>
                          )}
                          {iss.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{iss.description}</p>}
                          {iss.corrective_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {iss.corrective_action}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gearbox Analysis */}
          {gearbox?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Gearbox Analysis</h3>
              <div className="stack-sm">
                {gearbox.oil_level_visible != null && (
                  <div className="row-between">
                    <span className="text-secondary">Oil Level Visible</span>
                    <span>{gearbox.oil_level_visible ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {gearbox.oil_level_reading && (
                  <div className="row-between">
                    <span className="text-secondary">Oil Level Reading</span>
                    <span style={{ fontWeight: 600 }}>{gearbox.oil_level_reading}</span>
                  </div>
                )}
                {gearbox.oil_condition_visual && (
                  <div className="row-between">
                    <span className="text-secondary">Oil Condition</span>
                    <span className={gearbox.oil_condition_visual === 'normal' ? 'badge badge-green' : 'badge badge-amber'}>
                      {gearbox.oil_condition_visual.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {gearbox.leak_evidence != null && (
                  <div className="row-between">
                    <span className="text-secondary">Leak Evidence</span>
                    <span>{gearbox.leak_evidence ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {gearbox.leak_location && (
                  <div className="row-between">
                    <span className="text-secondary">Leak Location</span>
                    <span>{gearbox.leak_location}</span>
                  </div>
                )}
                {gearbox.oil_sample_recommended === true && (
                  <div className="warning-box" style={{ marginTop: '0.5rem' }}>
                    <strong>Oil sample recommended.</strong>
                  </div>
                )}
              </div>
              {gearbox.issues_found && gearbox.issues_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Issues</h4>
                  <div className="stack-sm">
                    {gearbox.issues_found.map(function (iss, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{iss.issue_type ? iss.issue_type.replace(/_/g, ' ') : 'Issue'}</strong>
                            {iss.severity && <span className={severityBadge(iss.severity)}>{iss.severity}</span>}
                          </div>
                          {iss.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{iss.description}</p>}
                          {iss.corrective_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {iss.corrective_action}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generator Analysis */}
          {generator?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Generator Analysis</h3>
              <div className="stack-sm">
                {generator.generator_type && generator.generator_type !== 'unknown' && (
                  <div className="row-between">
                    <span className="text-secondary">Generator Type</span>
                    <span style={{ fontWeight: 600 }}>{generator.generator_type}</span>
                  </div>
                )}
                {generator.thermal_evidence && (
                  <div className="row-between">
                    <span className="text-secondary">Thermal Evidence</span>
                    <span>{generator.thermal_evidence}</span>
                  </div>
                )}
              </div>
              {generator.issues_found && generator.issues_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Issues</h4>
                  <div className="stack-sm">
                    {generator.issues_found.map(function (iss, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{iss.issue_type ? iss.issue_type.replace(/_/g, ' ') : 'Issue'}</strong>
                            {iss.severity && <span className={severityBadge(iss.severity)}>{iss.severity}</span>}
                          </div>
                          {iss.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{iss.description}</p>}
                          {iss.corrective_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {iss.corrective_action}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tower Analysis */}
          {tower?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Tower Analysis</h3>
              <div className="stack-sm">
                {tower.tower_section && tower.tower_section !== 'unknown' && (
                  <div className="row-between">
                    <span className="text-secondary">Tower Section</span>
                    <span style={{ fontWeight: 600 }}>{tower.tower_section}</span>
                  </div>
                )}
                {tower.corrosion_assessment && (
                  <div className="row-between">
                    <span className="text-secondary">Corrosion</span>
                    <span className={tower.corrosion_assessment === 'none' ? 'badge badge-green' : tower.corrosion_assessment === 'surface' ? 'badge badge-amber' : 'badge badge-red'}>
                      {tower.corrosion_assessment.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
              {tower.issues_found && tower.issues_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Issues</h4>
                  <div className="stack-sm">
                    {tower.issues_found.map(function (iss, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{iss.issue_type ? iss.issue_type.replace(/_/g, ' ') : 'Issue'}</strong>
                            {iss.severity && <span className={severityBadge(iss.severity)}>{iss.severity}</span>}
                          </div>
                          {iss.location && <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>Location: {iss.location}</p>}
                          {iss.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{iss.description}</p>}
                          {iss.corrective_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {iss.corrective_action}
                            </p>
                          )}
                          {iss.bolt_torque_check_required === true && (
                            <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem', color: '#F59E0B' }}>
                              Bolt torque check required
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Electrical Analysis */}
          {electrical?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Electrical Analysis</h3>
              <div className="stack-sm">
                {electrical.cabinet_type && electrical.cabinet_type !== 'unknown' && (
                  <div className="row-between">
                    <span className="text-secondary">Cabinet Type</span>
                    <span style={{ fontWeight: 600 }}>{electrical.cabinet_type.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {electrical.fault_indicators_visible != null && (
                  <div className="row-between">
                    <span className="text-secondary">Fault Indicators</span>
                    <span>{electrical.fault_indicators_visible ? 'Active' : 'None visible'}</span>
                  </div>
                )}
              </div>
              {electrical.issues_found && electrical.issues_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Issues</h4>
                  <div className="stack-sm">
                    {electrical.issues_found.map(function (iss, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{iss.issue_type ? iss.issue_type.replace(/_/g, ' ') : 'Issue'}</strong>
                            {iss.severity && <span className={severityBadge(iss.severity)}>{iss.severity}</span>}
                          </div>
                          {iss.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{iss.description}</p>}
                          {iss.corrective_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {iss.corrective_action}
                            </p>
                          )}
                          {iss.de_energize_required === true && (
                            <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem', color: '#EF4444' }}>
                              De-energize required before inspection
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pitch / Yaw Analysis */}
          {pitchYaw?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Pitch / Yaw Analysis</h3>
              <div className="stack-sm">
                {pitchYaw.system_type && (
                  <div className="row-between">
                    <span className="text-secondary">System Type</span>
                    <span style={{ fontWeight: 600 }}>{pitchYaw.system_type}</span>
                  </div>
                )}
                {pitchYaw.grease_condition_visible && (
                  <div className="row-between">
                    <span className="text-secondary">Grease Condition</span>
                    <span>{pitchYaw.grease_condition_visible}</span>
                  </div>
                )}
                {pitchYaw.lubrication_required === true && (
                  <div className="warning-box" style={{ marginTop: '0.5rem' }}>
                    Lubrication required.
                  </div>
                )}
              </div>
              {pitchYaw.issues_found && pitchYaw.issues_found.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Issues</h4>
                  <div className="stack-sm">
                    {pitchYaw.issues_found.map(function (iss, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{iss.component ? iss.component.replace(/_/g, ' ') : 'Component'}</strong>
                            {iss.severity && <span className={severityBadge(iss.severity)}>{iss.severity}</span>}
                          </div>
                          {iss.issue_type && (
                            <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>{iss.issue_type.replace(/_/g, ' ')}</p>
                          )}
                          {iss.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{iss.description}</p>}
                          {iss.corrective_action && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Fix:</span> {iss.corrective_action}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fault Display Analysis */}
          {faultDisplay?.applicable && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Fault Display</h3>
              <div className="stack-sm">
                {faultDisplay.display_type && faultDisplay.display_type !== 'unknown' && (
                  <div className="row-between">
                    <span className="text-secondary">Display Type</span>
                    <span style={{ fontWeight: 600 }}>{faultDisplay.display_type}</span>
                  </div>
                )}
                {faultDisplay.manufacturer_platform && (
                  <div className="row-between">
                    <span className="text-secondary">Platform</span>
                    <span style={{ fontWeight: 600 }}>{faultDisplay.manufacturer_platform}</span>
                  </div>
                )}
                {faultDisplay.alarm_count != null && (
                  <div className="row-between">
                    <span className="text-secondary">Alarm Count</span>
                    <span style={{ fontWeight: 600 }}>{faultDisplay.alarm_count}</span>
                  </div>
                )}
                {faultDisplay.turbine_status_visible && (
                  <div className="row-between">
                    <span className="text-secondary">Turbine Status</span>
                    <span>{faultDisplay.turbine_status_visible}</span>
                  </div>
                )}
                {faultDisplay.power_output_visible && (
                  <div className="row-between">
                    <span className="text-secondary">Power Output</span>
                    <span>{faultDisplay.power_output_visible}</span>
                  </div>
                )}
                {faultDisplay.wind_speed_visible && (
                  <div className="row-between">
                    <span className="text-secondary">Wind Speed</span>
                    <span>{faultDisplay.wind_speed_visible}</span>
                  </div>
                )}
                {faultDisplay.other_readings_visible && (
                  <div className="row-between">
                    <span className="text-secondary">Other Readings</span>
                    <span>{faultDisplay.other_readings_visible}</span>
                  </div>
                )}
              </div>

              {faultDisplay.active_faults && faultDisplay.active_faults.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>Active Faults</h4>
                  <div className="stack-sm">
                    {faultDisplay.active_faults.map(function (f, i) {
                      return (
                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <div className="row-between" style={{ marginBottom: '0.25rem' }}>
                            <strong>{f.fault_code || 'Fault'}</strong>
                            {f.urgency && <span className={urgencyBadgeClass(f.urgency)}>{f.urgency.replace(/_/g, ' ')}</span>}
                          </div>
                          {f.fault_description && <p style={{ fontSize: '0.875rem' }}>{f.fault_description}</p>}
                          {f.fault_category && (
                            <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                              Category: {f.fault_category}
                            </p>
                          )}
                          {f.probable_causes && f.probable_causes.length > 0 && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span className="text-secondary" style={{ fontSize: '0.8125rem' }}>Probable causes:</span>
                              <ul style={{ margin: '0.25rem 0 0 1.25rem', fontSize: '0.875rem' }}>
                                {f.probable_causes.map(function (pc, j) {
                                  return <li key={j}>{pc}</li>;
                                })}
                              </ul>
                            </div>
                          )}
                          {f.reset_procedure && (
                            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                              <span className="text-secondary">Reset:</span> {f.reset_procedure}
                            </p>
                          )}
                          {f.requires_physical_inspection === true && (
                            <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem', color: '#F59E0B' }}>
                              Physical inspection required
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prioritized Actions */}
          {result.prioritized_actions && result.prioritized_actions.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Prioritized Actions</h3>
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {result.prioritized_actions.map(function (a, i) {
                  return (
                    <li key={i} style={{ marginBottom: '0.75rem' }}>
                      <div className="row" style={{ gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                        {a.urgency && (
                          <span className={urgencyBadgeClass(a.urgency)} style={{ fontSize: '0.6875rem' }}>
                            {a.urgency.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      {a.action && <p style={{ fontSize: '0.9375rem' }}>{a.action}</p>}
                      {a.reason && (
                        <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.125rem' }}>{a.reason}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Standards References */}
          {result.standards_references && result.standards_references.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Standards</h3>
              <div className="stack-sm">
                {result.standards_references.map(function (s, i) {
                  return (
                    <div key={i} style={{ fontSize: '0.875rem' }}>
                      <strong>{s.standard}</strong>
                      {s.section && <span className="text-secondary"> · {s.section}</span>}
                      {s.requirement_summary && (
                        <p className="text-secondary" style={{ marginTop: '0.125rem' }}>{s.requirement_summary}</p>
                      )}
                      {s.applies_to && (
                        <p className="text-muted" style={{ fontSize: '0.75rem' }}>Applies to: {s.applies_to}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended Next Steps */}
          {result.recommended_next_steps && (
            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Next Steps</h3>
              <p>{result.recommended_next_steps}</p>
            </div>
          )}

          {/* Confidence */}
          {result.confidence && (
            <div className="card">
              <div className="row-between">
                <span className="text-secondary">Confidence</span>
                <span className={confidenceBadgeClass(result.confidence)}>{result.confidence}</span>
              </div>
              {result.confidence_reasoning && (
                <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  {result.confidence_reasoning}
                </p>
              )}
            </div>
          )}

          {/* Scope Disclaimer */}
          {result.scope_disclaimer && (
            <p className="text-muted" style={{ fontSize: '0.75rem', fontStyle: 'italic', padding: '0 0.5rem' }}>
              {result.scope_disclaimer}
            </p>
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

        {/* Offline indicator */}
        {!navigator.onLine && (
          <div className="warning-box" style={{ fontSize: '0.875rem' }}>
            You are offline. Photos will be queued and processed automatically when you reconnect.
          </div>
        )}

        {/* Queued confirmation */}
        {queued && (
          <div className="info-box" style={{ fontSize: '0.875rem' }}>
            Photo queued! It will be processed automatically when you're back online.
          </div>
        )}

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

        {/* Offline Queue */}
        <OfflineQueue
          queue={offlineQueue.queue}
          processing={offlineQueue.processing}
          onRetry={offlineQueue.retry}
          onDismiss={offlineQueue.dismiss}
          onViewResult={handleViewQueueResult}
          onClearCompleted={offlineQueue.clearCompleted}
        />
      </div>
    </div>
  );
}
