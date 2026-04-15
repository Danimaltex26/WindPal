import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import auth from "../middleware/auth.js";
import { callClaude } from "../utils/claudeClient.js";
import { WIND_TROUBLESHOOT_SYSTEM_PROMPT } from "../prompts/troubleshoot.js";

var router = Router();

var supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

router.post("/", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var turbine_model = req.body.turbine_model;
    var component = req.body.component;
    // Accept symptom | symptoms | symptomDescription — frontend sends "symptoms"
    var symptom = req.body.symptom || req.body.symptoms || req.body.symptomDescription;
    var environment = req.body.environment;
    var already_tried = req.body.already_tried || [];
    var follow_up = req.body.follow_up;
    var session_id = req.body.session_id;

    // SUBSCRIPTION GATE — only counts NEW sessions; follow-ups are free
    if (!session_id && req.profile.subscription_tier === "free") {
      var startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      var countRes = await supabaseService
        .from("troubleshoot_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth);
      if (countRes.count >= 5) {
        return res.status(403).json({
          error: "Monthly limit reached",
          message: "Free tier allows 5 troubleshoot sessions per month. Upgrade to Pro for unlimited.",
          limit: 5,
          used: countRes.count,
        });
      }
    }

    // Load existing session for follow-up
    var existingSession = null;
    var existingHistory = [];
    if (session_id) {
      var sessionRes = await supabaseService
        .from("troubleshoot_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();
      if (sessionRes.error || !sessionRes.data) {
        return res.status(404).json({ error: "Session not found" });
      }
      existingSession = sessionRes.data;
      existingHistory = existingSession.conversation_json || [];
    }

    if (!session_id && (!symptom || typeof symptom !== "string" || !symptom.trim())) {
      return res.status(400).json({ error: "A symptom description is required" });
    }

    var userMessage = session_id && follow_up
      ? follow_up + "\n\nRespond with a JSON object exactly matching the schema in your instructions. No prose before or after, no markdown code fences."
      : buildTroubleshootMessage(req.body, { turbine_model, component, symptom, environment, already_tried });

    var messages = existingHistory.length > 0
      ? existingHistory.concat([{ role: "user", content: userMessage }])
      : [{ role: "user", content: userMessage }];

    // CLAUDE API CALL: WindPal troubleshoot diagnosis
    // Wind turbine troubleshoot always routes to Sonnet — all signals
    // that matter for wind are complexity signals.
    // See utils/modelRouter.js classifyTroubleshoot()
    var troubleshootContext = {
      // Prior conversation turns — multi-turn escalates to Sonnet
      conversationHistory: existingHistory,

      // Symptom for safety keyword detection
      symptom: symptom || req.body.scadaAlarmCodes || req.body.scada_alarm_codes || '',

      // SCADA alarm codes present = platform-specific interpretation = Sonnet
      hasScadaAlarms: !!(
        (req.body.scadaAlarmCodes || req.body.scada_alarm_codes) &&
        String(req.body.scadaAlarmCodes || req.body.scada_alarm_codes).trim()
      ),

      // Turbine manufacturer identified = platform-specific knowledge = Sonnet
      hasManufacturer: !!(
        (req.body.turbineManufacturer || req.body.turbine_manufacturer || turbine_model) &&
        (req.body.turbineManufacturer || req.body.turbine_manufacturer || turbine_model) !== 'Unknown'
      ),

      // Offshore = additional marine safety, environmental factors = Sonnet
      isOffshore: [req.body.turbineClass, req.body.turbine_class, environment]
        .some(v => (v || '').toLowerCase().includes('offshore')),

      // Drivetrain components = vibration, oil analysis, bearing knowledge = Sonnet
      isDrivetrainComponent: ['gearbox', 'generator', 'main_bearing', 'main bearing',
        'converter', 'drivetrain'].some(
        k => (req.body.componentSystem || req.body.component_system || component || '')
          .toLowerCase().includes(k)
      ),

      // 2+ already-tried steps = beyond basic reset/inspection = Sonnet
      alreadyTriedMultiple: (already_tried?.length || 0) >= 2,

      // Code/standard compliance — IEC, DNV-GL
      requiresCodeCompliance: false,
      isSpecialtyMaterial: false,
    };

    var aiResult = await callClaude({
      feature: 'troubleshoot',
      context: troubleshootContext,
      systemPrompt: WIND_TROUBLESHOOT_SYSTEM_PROMPT,
      messages: messages,
    });
    var rawText = aiResult.content;
    var result;
    try {
      var stripped = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      try {
        result = JSON.parse(stripped);
      } catch (e) {
        var start = stripped.indexOf("{");
        if (start === -1) throw new Error("No JSON found");
        var depth = 0;
        var end = -1;
        for (var j = start; j < stripped.length; j++) {
          if (stripped[j] === "{") depth++;
          else if (stripped[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
        }
        if (end === -1) throw new Error("Unbalanced JSON");
        result = JSON.parse(stripped.slice(start, end + 1));
      }
    } catch (parseErr) {
      console.error("Parse error:", parseErr.message, rawText);
      return res.status(500).json({ error: "Failed to parse troubleshoot result", raw: rawText });
    }

    var updatedHistory = messages.concat([{ role: "assistant", content: rawText }]);

    var sessionPayload = {
      user_id: userId,
      turbine_model: turbine_model || (existingSession && existingSession.turbine_model),
      component: component || (existingSession && existingSession.component),
      environment: environment || (existingSession && existingSession.environment),
      conversation_json: updatedHistory,
      resolved: (existingSession && existingSession.resolved) || false,
    };

    var savedSession;
    if (session_id && existingSession) {
      var updateRes = await supabaseService
        .from("troubleshoot_sessions")
        .update(sessionPayload)
        .eq("id", session_id)
        .select()
        .single();
      if (updateRes.error) {
        console.error("Session update error:", updateRes.error);
        return res.json({ result: result, session_id: session_id, saved: false, model: aiResult.model });
      }
      savedSession = updateRes.data;
    } else {
      var insertRes = await supabaseService
        .from("troubleshoot_sessions")
        .insert(sessionPayload)
        .select()
        .single();
      if (insertRes.error) {
        console.error("Session insert error:", insertRes.error);
        return res.json({ result: result, saved: false, model: aiResult.model });
      }
      savedSession = insertRes.data;
    }

    return res.json({ result: result, session_id: savedSession.id, model: aiResult.model });
  } catch (err) {
    console.error("Troubleshoot error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Builds the user message from form fields.
// Supports current WindPal fields (turbine_model, component, symptoms,
// environment, already_tried) plus additional spec fields
// (turbineManufacturer, turbinePlatform, turbineClass, componentSystem,
// scadaAlarmCodes, operatingConditions, hubHeight) if the frontend is
// extended later.
function buildTroubleshootMessage(body, baseline) {
  var lines = [];
  var b = body || {};
  var base = baseline || {};

  var manufacturer = b.turbineManufacturer || b.turbine_manufacturer;
  var platform = b.turbinePlatform || b.turbine_platform || base.turbine_model;
  var turbineClass = b.turbineClass || b.turbine_class;
  var hubHeight = b.hubHeight || b.hub_height;
  var componentSystem = b.componentSystem || b.component_system || base.component;
  var scadaCodes = b.scadaAlarmCodes || b.scada_alarm_codes;
  var operating = b.operatingConditions || b.operating_conditions;

  if (manufacturer && manufacturer !== 'Unknown') {
    lines.push('Turbine manufacturer: ' + manufacturer);
  }
  if (platform && String(platform).trim()) {
    lines.push('Turbine platform/model: ' + String(platform).trim());
  }
  if (turbineClass) lines.push('Turbine class: ' + turbineClass);
  if (hubHeight && String(hubHeight).trim()) {
    lines.push('Hub height: ' + String(hubHeight).trim() + ' meters');
  }
  if (componentSystem) {
    var componentLabels = {
      blade: 'Rotor blade',
      gearbox: 'Gearbox',
      generator: 'Generator',
      pitch: 'Pitch system',
      yaw: 'Yaw system',
      electrical: 'Electrical / converter cabinet',
      tower: 'Tower',
      main_bearing: 'Main bearing',
      converter: 'Power converter',
      other: 'Other',
    };
    lines.push('Component/system: ' + (componentLabels[componentSystem] || componentSystem));
  }
  if (scadaCodes && String(scadaCodes).trim()) {
    lines.push('SCADA alarm codes: ' + String(scadaCodes).trim());
  }
  if (operating && String(operating).trim()) {
    lines.push('Operating conditions: ' + String(operating).trim());
  }
  if (base.environment) lines.push('Environment: ' + base.environment);
  if (base.already_tried && base.already_tried.length > 0) {
    lines.push('Already tried: ' + base.already_tried.join(', '));
  }
  if (base.symptom && String(base.symptom).trim()) {
    lines.push('Technician description: ' + String(base.symptom).trim());
  }

  var contextBlock = lines.length > 0
    ? lines.join('\n')
    : 'No additional context provided.';

  return contextBlock + '\n\nDiagnose this wind turbine problem and return your complete assessment as a JSON object exactly matching the schema in your instructions. State required safe state before any diagnosis.';
}

export default router;
