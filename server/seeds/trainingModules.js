// WindPal training module definitions
// Wind tech certification path: GWO_BST → GWO_BTT → ACP_TECH → SENIOR_TECH

export const MODULES = [
  // ── GWO_BST (GWO Basic Safety Training) ───────────────────
  {
    cert_level: 'GWO_BST', module_number: 1, title: 'Working at Heights',
    estimated_minutes: 50, exam_domain_weight: 0.25,
    topic_list: ['Fall protection systems', 'Harness inspection and fit', 'Anchor points and tie-off', 'Ladder safety — internal and external', 'Self-rescue techniques', 'Evacuation procedures', 'PPE inspection and maintenance', 'Height rescue equipment'],
  },
  {
    cert_level: 'GWO_BST', module_number: 2, title: 'First Aid and Emergency Response',
    estimated_minutes: 45, exam_domain_weight: 0.25,
    topic_list: ['CPR and AED use', 'Wound management', 'Fracture and spinal injury', 'Burns — electrical and thermal', 'Hypothermia and heat stress', 'Confined space rescue', 'Emergency action plans', 'Communication in emergencies'],
  },
  {
    cert_level: 'GWO_BST', module_number: 3, title: 'Fire Awareness and Prevention',
    estimated_minutes: 40, exam_domain_weight: 0.20,
    topic_list: ['Fire triangle and classes', 'Extinguisher types and use', 'Fire risks in nacelle and hub', 'Electrical fire response', 'Hydraulic oil fire risks', 'Evacuation routes — tower and nacelle', 'Fire detection systems', 'Hot work procedures'],
  },
  {
    cert_level: 'GWO_BST', module_number: 4, title: 'Manual Handling and Ergonomics',
    estimated_minutes: 35, exam_domain_weight: 0.15,
    topic_list: ['Lifting techniques', 'Carrying loads in confined spaces', 'Tower climbing ergonomics', 'Repetitive motion prevention', 'Tool handling at height', 'Crane and hoist signals', 'Load weight limits', 'Musculoskeletal injury prevention'],
  },
  {
    cert_level: 'GWO_BST', module_number: 5, title: 'Sea Survival (Offshore)',
    estimated_minutes: 40, exam_domain_weight: 0.15,
    topic_list: ['Helicopter underwater escape training', 'Personal survival techniques', 'Life raft deployment', 'CTV transfer procedures', 'Cold water immersion', 'EPIRB and PLB use', 'Offshore PPE requirements', 'Weather limitations for transfer'],
  },

  // ── GWO_BTT (GWO Basic Technical Training) ────────────────
  {
    cert_level: 'GWO_BTT', module_number: 1, title: 'Mechanical Systems',
    estimated_minutes: 55, exam_domain_weight: 0.25,
    topic_list: ['Drivetrain components', 'Gearbox types and operation', 'Main bearing inspection', 'Yaw system mechanics', 'Pitch system — hydraulic and electric', 'Brake systems', 'Torque procedures and specifications', 'Bolt tensioning and tightening'],
  },
  {
    cert_level: 'GWO_BTT', module_number: 2, title: 'Electrical Systems',
    estimated_minutes: 55, exam_domain_weight: 0.25,
    topic_list: ['Generator types — DFIG, PMSG, squirrel cage', 'Power converter basics', 'Transformer connections', 'MV switchgear safety', 'Cable routing in tower', 'Grounding and lightning protection', 'Electrical safety — lockout/tagout', 'Basic electrical testing'],
  },
  {
    cert_level: 'GWO_BTT', module_number: 3, title: 'Hydraulic Systems',
    estimated_minutes: 45, exam_domain_weight: 0.25,
    topic_list: ['Hydraulic principles — pressure, flow, force', 'Pitch hydraulics', 'Brake hydraulics', 'Yaw hydraulics', 'Hydraulic fluid types and compatibility', 'Filter and contamination control', 'Hose and fitting inspection', 'Accumulator pre-charge'],
  },
  {
    cert_level: 'GWO_BTT', module_number: 4, title: 'Composite and Blade Basics',
    estimated_minutes: 45, exam_domain_weight: 0.25,
    topic_list: ['Blade construction — spar cap, shear web, shell', 'Fiberglass and carbon fiber basics', 'Common blade damage types', 'Leading edge erosion', 'Lightning damage assessment', 'Structural vs cosmetic damage', 'Blade inspection procedures', 'Basic repair materials'],
  },

  // ── ACP_TECH (ACP Wind Turbine Service Technician) ────────
  {
    cert_level: 'ACP_TECH', module_number: 1, title: 'Turbine Operations and Control',
    estimated_minutes: 55, exam_domain_weight: 0.20,
    topic_list: ['SCADA systems overview', 'Alarm codes and priorities', 'Start/stop procedures', 'Power curve and performance', 'Cut-in/rated/cut-out wind speeds', 'Grid synchronization', 'Curtailment and de-rating', 'Remote monitoring'],
  },
  {
    cert_level: 'ACP_TECH', module_number: 2, title: 'Preventive Maintenance Procedures',
    estimated_minutes: 55, exam_domain_weight: 0.25,
    topic_list: ['Annual inspection checklists', 'Semi-annual maintenance tasks', 'Oil sampling and analysis', 'Grease lubrication schedules', 'Filter replacement', 'Bolt torque verification', 'Visual blade inspection from ground', 'Up-tower inspection procedures'],
  },
  {
    cert_level: 'ACP_TECH', module_number: 3, title: 'Corrective Maintenance',
    estimated_minutes: 55, exam_domain_weight: 0.25,
    topic_list: ['Fault finding methodology', 'Gearbox oil replacement', 'Pitch motor and battery replacement', 'Yaw motor and brake pad replacement', 'Generator brush replacement', 'Sensor calibration and replacement', 'Cooling system maintenance', 'Major component replacement planning'],
  },
  {
    cert_level: 'ACP_TECH', module_number: 4, title: 'Blade Inspection and Repair',
    estimated_minutes: 50, exam_domain_weight: 0.15,
    topic_list: ['Rope access and platform inspection', 'Damage classification systems', 'Leading edge protection repair', 'Shell crack repair basics', 'Gel coat repair procedures', 'UV-cured composite repair', 'Inspection documentation', 'Repair quality verification'],
  },
  {
    cert_level: 'ACP_TECH', module_number: 5, title: 'Safety Management Systems',
    estimated_minutes: 45, exam_domain_weight: 0.15,
    topic_list: ['Job hazard analysis', 'Permit to work systems', 'LOTO energy isolation', 'Confined space entry', 'Environmental compliance', 'Incident reporting and investigation', 'Safety culture and behavior', 'Regulatory requirements OSHA'],
  },

  // ── SENIOR_TECH (Senior Wind Turbine Technician) ──────────
  {
    cert_level: 'SENIOR_TECH', module_number: 1, title: 'Advanced Diagnostics',
    estimated_minutes: 60, exam_domain_weight: 0.25,
    topic_list: ['Vibration analysis fundamentals', 'Oil analysis interpretation', 'Thermographic inspection', 'Borescope gearbox inspection', 'Electrical signature analysis', 'Condition monitoring systems', 'Trend analysis and prediction', 'Root cause analysis methodology'],
  },
  {
    cert_level: 'SENIOR_TECH', module_number: 2, title: 'Major Component Management',
    estimated_minutes: 55, exam_domain_weight: 0.25,
    topic_list: ['Gearbox replacement planning', 'Generator replacement procedures', 'Main bearing replacement', 'Blade replacement logistics', 'Crane selection and rigging', 'Heavy lift planning', 'Component lifecycle management', 'Warranty claim documentation'],
  },
  {
    cert_level: 'SENIOR_TECH', module_number: 3, title: 'Fleet Performance Optimization',
    estimated_minutes: 50, exam_domain_weight: 0.25,
    topic_list: ['Fleet-wide data analysis', 'Availability and capacity factor', 'Power curve analysis', 'Yaw misalignment detection', 'Pitch optimization', 'Site-specific environmental factors', 'Downtime root cause analysis', 'Performance benchmarking'],
  },
  {
    cert_level: 'SENIOR_TECH', module_number: 4, title: 'Team Leadership and Project Management',
    estimated_minutes: 45, exam_domain_weight: 0.25,
    topic_list: ['Work crew supervision', 'Task planning and scheduling', 'Subcontractor management', 'Quality assurance procedures', 'Technical report writing', 'Customer interface and reporting', 'Budget management', 'Training and mentoring'],
  },
];
