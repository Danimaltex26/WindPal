export const EXAM_BLUEPRINTS = {
  GWO_BST: {
    totalQuestions: 50, timeMinutes: 75, passPercent: 70,
    domains: [
      { moduleNumber: 1, name: 'Working at Heights', weight: 0.25, questions: 13 },
      { moduleNumber: 2, name: 'First Aid and Emergency Response', weight: 0.25, questions: 13 },
      { moduleNumber: 3, name: 'Fire Awareness and Prevention', weight: 0.20, questions: 10 },
      { moduleNumber: 4, name: 'Manual Handling and Ergonomics', weight: 0.15, questions: 7 },
      { moduleNumber: 5, name: 'Sea Survival (Offshore)', weight: 0.15, questions: 7 },
    ]
  },
  GWO_BTT: {
    totalQuestions: 60, timeMinutes: 90, passPercent: 70,
    domains: [
      { moduleNumber: 1, name: 'Mechanical Systems', weight: 0.25, questions: 15 },
      { moduleNumber: 2, name: 'Electrical Systems', weight: 0.25, questions: 15 },
      { moduleNumber: 3, name: 'Hydraulic Systems', weight: 0.25, questions: 15 },
      { moduleNumber: 4, name: 'Composite and Blade Basics', weight: 0.25, questions: 15 },
    ]
  },
  ACP_TECH: {
    totalQuestions: 80, timeMinutes: 120, passPercent: 72,
    domains: [
      { moduleNumber: 1, name: 'Turbine Operations and Control', weight: 0.20, questions: 16 },
      { moduleNumber: 2, name: 'Preventive Maintenance Procedures', weight: 0.25, questions: 20 },
      { moduleNumber: 3, name: 'Corrective Maintenance', weight: 0.25, questions: 20 },
      { moduleNumber: 4, name: 'Blade Inspection and Repair', weight: 0.15, questions: 12 },
      { moduleNumber: 5, name: 'Safety Management Systems', weight: 0.15, questions: 12 },
    ]
  },
  SENIOR_TECH: {
    totalQuestions: 100, timeMinutes: 150, passPercent: 75,
    domains: [
      { moduleNumber: 1, name: 'Advanced Diagnostics', weight: 0.25, questions: 25 },
      { moduleNumber: 2, name: 'Major Component Management', weight: 0.25, questions: 25 },
      { moduleNumber: 3, name: 'Fleet Performance Optimization', weight: 0.25, questions: 25 },
      { moduleNumber: 4, name: 'Team Leadership and Project Management', weight: 0.25, questions: 25 },
    ]
  },
};
