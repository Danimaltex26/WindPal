import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import auth from "../middleware/auth.js";
import { sendAnalysisReadyEmail } from "../utils/email.js";
import { analyzeWindPhoto } from "../utils/windAnalyzer.js";

var router = Router();
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

var supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

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
    }

    // CLAUDE API CALL: wind turbine photo analysis — see /server/utils/windAnalyzer.js
    var analysisResult;
    try {
      analysisResult = await analyzeWindPhoto({
        imageBase64: req.files[0].buffer.toString("base64"),
        imageMediaType: req.files[0].mimetype || "image/jpeg",
        analysisType: analysis_type,
        turbineManufacturer: req.body.turbine_manufacturer,
        turbinePlatform: req.body.turbine_platform,
        turbineClass: req.body.turbine_class,
        componentHeight: req.body.component_height,
        symptoms: req.body.symptoms,
        userNotes: req.body.user_notes,
        userId: userId,
      });
    } catch (error) {
      if (error.type === 'api_error' || error.type === 'parse_error' || error.type === 'validation_error') {
        return res.status(error.status || 500).json({
          error: error.userMessage || 'Analysis failed. Please try again.'
        });
      }
      throw error;
    }

    var result = analysisResult.analysis;

    var insertResult = await supabaseService
      .from("turbine_analyses")
      .insert({
        user_id: userId,
        image_urls: publicUrls,
        analysis_type: result.analysis_type || analysis_type || "general",
        diagnosis: result.assessment_reasoning || result.overall_assessment,
        recommended_action: result.prioritized_actions && result.prioritized_actions[0] ? result.prioritized_actions[0].action : null,
        confidence: result.confidence,
        severity: result.overall_assessment || "observation",
        full_response_json: result,
        saved: false,
      })
      .select()
      .single();

    if (insertResult.error) {
      console.error("Save error:", insertResult.error);
      return res.json({ result: result, saved: false, save_error: insertResult.error.message, model: analysisResult.model });
    }

    // Only send email for offline-queued analyses
    if (req.body.queued) {
      sendAnalysisReadyEmail({
        to: req.user.email,
        appKey: "windpal",
        displayName: req.profile.display_name,
        analysisType: result.analysis_type || analysis_type || "general",
      }).catch(function () {});
    }

    return res.json({ result: result, record_id: insertResult.data.id, model: analysisResult.model });
  } catch (err) {
    console.error("Turbine analysis error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
