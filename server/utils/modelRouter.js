/**
 * TradePals AI Model Router
 *
 * Selects between Sonnet and Haiku based on feature type.
 * All Claude API calls must use this router — never hardcode model names.
 *
 * Cost guidance (approximate):
 *   Sonnet: ~$3/M input, ~$15/M output
 *   Haiku:  ~$0.25/M input, ~$1.25/M output
 */

export const MODELS = {
  SONNET: 'claude-sonnet-4-20250514',
  HAIKU: 'claude-haiku-4-5-20251001',
};

/**
 * SONNET — accuracy-critical:
 *   photo_diagnosis, complex_troubleshoot, code_citation,
 *   question_generation, wps_interpretation, ndt_guidance
 *
 * HAIKU — volume-optimized:
 *   simple_troubleshoot, reference_lookup, cert_prep_delivery,
 *   parameter_lookup, content_formatting, session_summary
 */
const FEATURE_MODEL_MAP = {
  photo_diagnosis:      MODELS.SONNET,
  complex_troubleshoot: MODELS.SONNET,
  code_citation:        MODELS.SONNET,
  question_generation:  MODELS.SONNET,
  wps_interpretation:   MODELS.SONNET,
  ndt_guidance:         MODELS.SONNET,

  simple_troubleshoot:  MODELS.HAIKU,
  reference_lookup:     MODELS.HAIKU,
  cert_prep_delivery:   MODELS.HAIKU,
  parameter_lookup:     MODELS.HAIKU,
  content_formatting:   MODELS.HAIKU,
  session_summary:      MODELS.HAIKU,
};

const SAFETY_KEYWORDS = [
  'crack', 'fracture', 'break', 'fail', 'collapse',
  'arc flash', 'electrocution', 'gas leak', 'fire',
  'explosion', 'pressure', 'high voltage', 'structural',
  'fall', 'crush', 'entrap', 'interlock', 'governor',
];

function classifyTroubleshoot(params) {
  var {
    conversationHistory = [],
    symptom = '',
    requiresCodeCompliance = false,
    isSpecialtyMaterial = false,
  } = params;

  var symptomLower = symptom.toLowerCase();
  var isSafetyCritical = SAFETY_KEYWORDS.some(function (kw) {
    return symptomLower.includes(kw);
  });
  var isMultiTurn = conversationHistory.length > 0;
  var isComplex = isMultiTurn || requiresCodeCompliance ||
                  isSpecialtyMaterial || isSafetyCritical;

  return isComplex ? 'complex_troubleshoot' : 'simple_troubleshoot';
}

const CITATION_KEYWORDS = [
  'acceptance criteria', 'reject', 'accept', 'maximum', 'minimum',
  'per code', 'code require', 'what does', 'compliant', 'violation',
  'allowed', 'permitted', 'prohibited', 'shall', 'must', 'required',
  'wps', 'procedure', 'specification', 'nec article', 'asme',
  'aws d1', 'api 1104', 'ipc', 'upc', 'nfpa', 'a17.1', 'iec',
];

export function requiresSpecificClause(query) {
  var queryLower = (query || '').toLowerCase();
  return CITATION_KEYWORDS.some(function (kw) {
    return queryLower.includes(kw);
  });
}

function logModelSelection(feature, model) {
  var shouldLog = process.env.NODE_ENV === 'development' ||
                  process.env.TRADEPAL_MODEL_LOGGING === 'true';
  if (shouldLog) {
    var label = model === MODELS.SONNET ? 'SONNET' : 'HAIKU';
    console.log('[ModelRouter] ' + feature + ' → ' + label);
  }
}

export function getModel(feature, context) {
  if (!context) context = {};

  if (feature === 'troubleshoot') {
    var classified = classifyTroubleshoot(context);
    var model = FEATURE_MODEL_MAP[classified];
    logModelSelection(classified, model);
    return model;
  }

  var m = FEATURE_MODEL_MAP[feature];
  if (!m) {
    console.warn('[ModelRouter] Unknown feature: "' + feature + '". Defaulting to Haiku.');
    m = MODELS.HAIKU;
  }

  logModelSelection(feature, m);
  return m;
}

export function getModelConfig(feature, context) {
  if (!context) context = {};
  var model = getModel(feature, context);

  var configs = {
    photo_diagnosis:      { max_tokens: 4096, temperature: 0.2 },
    complex_troubleshoot: { max_tokens: 4096, temperature: 0.3 },
    code_citation:        { max_tokens: 4096, temperature: 0.1 },
    question_generation:  { max_tokens: 8192, temperature: 0.7 },
    wps_interpretation:   { max_tokens: 4096, temperature: 0.1 },
    ndt_guidance:         { max_tokens: 4096, temperature: 0.2 },
    simple_troubleshoot:  { max_tokens: 4096, temperature: 0.3 },
    reference_lookup:     { max_tokens: 4096, temperature: 0.1 },
    cert_prep_delivery:   { max_tokens: 2048, temperature: 0.2 },
    parameter_lookup:     { max_tokens: 2048, temperature: 0.1 },
    content_formatting:   { max_tokens: 2048, temperature: 0.1 },
    session_summary:      { max_tokens: 2048, temperature: 0.3 },
  };

  var featureKey = feature === 'troubleshoot'
    ? classifyTroubleshoot(context)
    : feature;

  var config = configs[featureKey] || { max_tokens: 4096, temperature: 0.3 };

  return { model: model, max_tokens: config.max_tokens, temperature: config.temperature };
}
