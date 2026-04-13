import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import auth from "../middleware/auth.js";

var router = Router();

var supabaseApp = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

var supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get("/", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var profile = req.profile;
    var startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    var results = await Promise.all([
      supabaseApp
        .from("turbine_analyses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth),
      supabaseApp
        .from("troubleshoot_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth),
      supabaseApp
        .from("reference_queries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth),
      supabaseApp
        .from("user_preferences")
        .select("turbine_models, certifications, specialties")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    return res.json({
      ...profile,
      turbine_models: (results[3].data && results[3].data.turbine_models) || [],
      certifications: (results[3].data && results[3].data.certifications) || [],
      specialties: (results[3].data && results[3].data.specialties) || [],
      usage: {
        analysis_count: results[0].count || 0,
        troubleshoot_count: results[1].count || 0,
        reference_count: results[2].count || 0,
      },
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var display_name = req.body.display_name;
    var turbine_models = req.body.turbine_models;
    var certifications = req.body.certifications;
    var specialties = req.body.specialties;

    if (display_name !== undefined) {
      var profileResult = await supabasePublic
        .from("profiles")
        .update({ display_name: display_name })
        .eq("id", userId);
      if (profileResult.error) return res.status(500).json({ error: profileResult.error.message });
    }

    if (turbine_models !== undefined || certifications !== undefined || specialties !== undefined) {
      var prefUpdates = { user_id: userId };
      if (turbine_models !== undefined) prefUpdates.turbine_models = turbine_models;
      if (certifications !== undefined) prefUpdates.certifications = certifications;
      if (specialties !== undefined) prefUpdates.specialties = specialties;
      var prefResult = await supabaseApp
        .from("user_preferences")
        .upsert(prefUpdates, { onConflict: "user_id" });
      if (prefResult.error) return res.status(500).json({ error: prefResult.error.message });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Profile patch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
