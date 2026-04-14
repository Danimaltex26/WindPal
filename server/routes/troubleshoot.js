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
    var symptom = req.body.symptom;
    var environment = req.body.environment;
    var already_tried = req.body.already_tried || [];

    // SUBSCRIPTION GATE
    if (req.profile.subscription_tier === "free") {
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

    if (!symptom || typeof symptom !== "string" || !symptom.trim()) {
      return res.status(400).json({ error: "A symptom description is required" });
    }

    var userMessage = [
      "Turbine model: " + (turbine_model || "not specified"),
      "Component: " + (component || "not specified"),
      "Environment: " + (environment || "not specified"),
      "Symptom: " + symptom,
      already_tried.length > 0
        ? "Already tried: " + already_tried.join(", ")
        : "Already tried: nothing yet",
    ].join("\n");

    var messages = [{ role: "user", content: userMessage }];

    var aiResult = await callClaude({
      feature: 'troubleshoot',
      context: {
        conversationHistory: [],
        symptom: symptom || '',
      },
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

    var conversationRecord = [
      { role: "user", content: userMessage },
      { role: "assistant", content: rawText },
    ];

    var insertResult = await supabaseService
      .from("troubleshoot_sessions")
      .insert({
        user_id: userId,
        turbine_model: turbine_model,
        component: component,
        environment: environment,
        conversation_json: conversationRecord,
        resolved: false,
      })
      .select()
      .single();

    if (insertResult.error) {
      console.error("Save error:", insertResult.error);
      return res.json({ result: result, saved: false });
    }

    return res.json({ result: result, session_id: insertResult.data.id });
  } catch (err) {
    console.error("Troubleshoot error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
