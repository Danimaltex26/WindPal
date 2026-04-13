import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import auth from "../middleware/auth.js";

var router = Router();

var supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

router.get("/", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var limit = req.profile.subscription_tier === "free" ? 10 : 100;

    var results = await Promise.all([
      supabaseService
        .from("turbine_analyses")
        .select("id, created_at, image_urls, analysis_type, diagnosis, recommended_action, confidence, severity, saved, title, notes, full_response_json")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseService
        .from("troubleshoot_sessions")
        .select("id, created_at, turbine_model, component, environment, resolved, title, notes, conversation_json")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    return res.json({
      turbine_analyses: results[0].data || [],
      troubleshoot_sessions: results[1].data || [],
    });
  } catch (err) {
    console.error("History error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /history/analysis/:id
router.patch("/analysis/:id", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var update = {};
    if (req.body.title !== undefined) update.title = req.body.title;
    if (req.body.notes !== undefined) update.notes = req.body.notes;
    if (req.body.saved !== undefined) update.saved = req.body.saved;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "No valid fields" });
    var result = await supabaseService
      .from("turbine_analyses")
      .update(update)
      .eq("id", req.params.id)
      .eq("user_id", userId);
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true });
  } catch (err) {
    console.error("History patch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /history/troubleshoot/:id
router.patch("/troubleshoot/:id", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var update = {};
    if (req.body.title !== undefined) update.title = req.body.title;
    if (req.body.notes !== undefined) update.notes = req.body.notes;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "No valid fields" });
    var result = await supabaseService
      .from("troubleshoot_sessions")
      .update(update)
      .eq("id", req.params.id)
      .eq("user_id", userId);
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true });
  } catch (err) {
    console.error("Troubleshoot patch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /history/troubleshoot/:id/resolve
router.patch("/troubleshoot/:id/resolve", auth, async function (req, res) {
  try {
    var result = await supabaseService
      .from("troubleshoot_sessions")
      .update({ resolved: true })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true });
  } catch (err) {
    console.error("Resolve error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /history/analysis/:id
router.delete("/analysis/:id", auth, async function (req, res) {
  try {
    var result = await supabaseService
      .from("turbine_analyses")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /history/troubleshoot/:id
router.delete("/troubleshoot/:id", auth, async function (req, res) {
  try {
    var result = await supabaseService
      .from("troubleshoot_sessions")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
