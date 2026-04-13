import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import auth from "../middleware/auth.js";
import { WIND_ANALYSIS_SYSTEM_PROMPT } from "../prompts/analysis.js";
import { sendAnalysisReadyEmail } from "../utils/email.js";

var router = Router();
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

var supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

var anthropic = new Anthropic();

router.post("/", auth, upload.array("images", 4), async function (req, res) {
  try {
    var userId = req.user.id;
    var analysis_type = req.body.analysis_type;

    // SUBSCRIPTION GATE
    if (req.profile.subscription_tier === "free") {
      var startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      var countRes = await supabaseService
        .from("turbine_analyses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth);
      if (countRes.count >= 2) {
        return res.status(403).json({
          error: "Monthly limit reached",
          message: "Free tier allows 2 turbine analyses per month. Upgrade to Pro for unlimited.",
          limit: 2,
          used: countRes.count,
        });
      }
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    var imageContent = [];
    var publicUrls = [];

    for (var i = 0; i < req.files.length; i++) {
      var file = req.files[i];
      var timestamp = Date.now();
      var safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      var storagePath = userId + "/" + timestamp + "_" + safeName;

      var uploadResult = await supabaseService.storage
        .from("windpal-uploads")
        .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (uploadResult.error) {
        console.error("Upload error:", uploadResult.error);
        return res.status(500).json({ error: "Failed to upload image" });
      }

      var urlData = supabaseService.storage
        .from("windpal-uploads")
        .getPublicUrl(storagePath);
      publicUrls.push(urlData.data.publicUrl);

      imageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.mimetype || "image/jpeg",
          data: file.buffer.toString("base64"),
        },
      });
    }

    imageContent.push({
      type: "text",
      text: "Analyze this wind turbine component photo. Analysis type hint: " + (analysis_type || "general") + ". Return your analysis as the specified JSON object.",
    });

    var message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: WIND_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: imageContent }],
    });

    if (message.stop_reason === "max_tokens") {
      console.error("Analysis response truncated (max_tokens)");
      return res.status(500).json({ error: "AI response was too long. Please try again." });
    }

    var rawText = message.content[0].text;
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
      return res.status(500).json({ error: "Failed to parse analysis result", raw: rawText });
    }

    var insertResult = await supabaseService
      .from("turbine_analyses")
      .insert({
        user_id: userId,
        image_urls: publicUrls,
        analysis_type: result.analysis_type || analysis_type || "general",
        diagnosis: result.overall_diagnosis || result.plain_english_summary,
        recommended_action: result.recommended_action,
        confidence: result.confidence,
        severity: result.severity || "observation",
        full_response_json: result,
        saved: false,
      })
      .select()
      .single();

    if (insertResult.error) {
      console.error("Save error:", insertResult.error);
      return res.json({ result: result, saved: false, save_error: insertResult.error.message });
    }

    // Send email notification (fire-and-forget, don't block response)
    sendAnalysisReadyEmail({
      to: req.user.email,
      appKey: "windpal",
      displayName: req.profile.display_name,
      analysisType: result.analysis_type || analysis_type || "general",
    }).catch(function () {});

    return res.json({ result: result, record_id: insertResult.data.id });
  } catch (err) {
    console.error("Turbine analysis error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
