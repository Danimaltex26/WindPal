import { useState } from 'react';

export default function LearnPage() {
  const [expanded, setExpanded] = useState({});

  function toggle(id) {
    setExpanded(function (prev) {
      var next = Object.assign({}, prev);
      next[id] = !prev[id];
      return next;
    });
  }

  var topics = [
    {
      id: 'safety',
      title: 'Wind Turbine Safety',
      items: [
        'GWO BST (Basic Safety Training) overview',
        'Working at heights and fall protection',
        'Confined space entry procedures',
        'Lock-out / Tag-out (LOTO) for turbines',
        'Emergency rescue and evacuation',
        'PPE requirements for wind technicians',
      ],
    },
    {
      id: 'mechanical',
      title: 'Mechanical Systems',
      items: [
        'Gearbox operation and maintenance',
        'Main bearing inspection',
        'Brake system fundamentals',
        'Hydraulic system troubleshooting',
        'Torque procedures and bolt tensioning',
        'Yaw system maintenance',
      ],
    },
    {
      id: 'electrical',
      title: 'Electrical Systems',
      items: [
        'Generator types (DFIG, PMG, SCIG)',
        'Converter and power electronics',
        'Medium voltage switchgear',
        'Transformer maintenance',
        'Cable inspection and termination',
        'Grounding and lightning protection',
      ],
    },
    {
      id: 'blades',
      title: 'Blade Inspection & Repair',
      items: [
        'Visual blade inspection techniques',
        'Common blade defects and classification',
        'Leading edge erosion repair',
        'Composite repair fundamentals',
        'Lightning strike damage assessment',
        'Pitch system calibration',
      ],
    },
    {
      id: 'scada',
      title: 'Controls & SCADA',
      items: [
        'SCADA system overview',
        'Alarm management and fault codes',
        'Power curve analysis',
        'Condition monitoring systems',
        'Remote diagnostics',
        'Data logging and trend analysis',
      ],
    },
  ];

  return (
    <div className="page">
      <div className="stack">
        <div className="page-header">
          <h2>Learn</h2>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
            Training topics for wind turbine technicians
          </p>
        </div>

        <div className="info-box" style={{ fontSize: '0.875rem' }}>
          Training modules are coming soon. Browse topics below to see what will be available.
        </div>

        {topics.map(function (topic) {
          var isOpen = expanded[topic.id];
          return (
            <div key={topic.id} className="card">
              <div className="expandable-header" onClick={function () { toggle(topic.id); }}>
                <h3 style={{ margin: 0 }}>{topic.title}</h3>
                <span style={{ color: '#6B6B73', fontSize: '1.25rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>&#9662;</span>
              </div>
              {isOpen && (
                <div className="stack-sm" style={{ marginTop: '0.75rem' }}>
                  {topic.items.map(function (item, i) {
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #2A2A2E' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span style={{ fontSize: '0.9375rem' }}>{item}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
