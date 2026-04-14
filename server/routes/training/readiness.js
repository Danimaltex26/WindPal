import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { EXAM_BLUEPRINTS } from "../../config/examBlueprints.js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

const SESSION_WEIGHTS = {
  timed_exam: 3,
  untimed_exam: 2,
  weak_area_drill: 1.5,
  practice: 1,
  module_practice: 1,
  sr_review: 0.5,
};

/**
 * Recalculate readiness score for a user + certLevel.
 * Exported so other routes can call it directly.
 */
export async function recalculateReadiness(userId, certLevel, db) {
  const client = db || supabase;

  // Pull sessions from last 90 days
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions, error: sessErr } = await client
    .from("training_test_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("cert_level", certLevel)
    .gte("completed_at", cutoff)
    .order("completed_at", { ascending: false });

  if (sessErr) throw sessErr;

  if (!sessions || sessions.length === 0) {
    // No sessions — set readiness to 0
    await upsertReadiness(client, userId, certLevel, 0, {}, 0, 0, false);
    return { overallReadiness: 0, domainReadiness: {} };
  }

  const blueprint = EXAM_BLUEPRINTS[certLevel];
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  // Accumulate weighted scores per domain
  const domainWeightedScores = {};
  const domainWeightedTotals = {};
  let totalQuestions = 0;

  for (const sess of sessions) {
    const sessionWeight = SESSION_WEIGHTS[sess.session_type] || 1;
    const sessionAge = now - new Date(sess.completed_at).getTime();
    const timeDecay = sessionAge > fourteenDaysMs ? 0.5 : 1.0;
    const weight = sessionWeight * timeDecay;

    if (sess.domain_scores && typeof sess.domain_scores === "object") {
      for (const [domain, scores] of Object.entries(sess.domain_scores)) {
        if (!domainWeightedScores[domain]) {
          domainWeightedScores[domain] = 0;
          domainWeightedTotals[domain] = 0;
        }
        const pct = scores.total > 0 ? (scores.correct / scores.total) * 100 : 0;
        domainWeightedScores[domain] += pct * weight;
        domainWeightedTotals[domain] += weight;
      }
    } else {
      // No domain breakdown — apply to a general bucket
      const pct = sess.score_percent || 0;
      const domain = "_general";
      if (!domainWeightedScores[domain]) {
        domainWeightedScores[domain] = 0;
        domainWeightedTotals[domain] = 0;
      }
      domainWeightedScores[domain] += pct * weight;
      domainWeightedTotals[domain] += weight;
    }

    totalQuestions += sess.total_questions || 0;
  }

  // Calculate weighted average per domain
  const domainReadiness = {};
  for (const [domain, wScore] of Object.entries(domainWeightedScores)) {
    const wTotal = domainWeightedTotals[domain];
    domainReadiness[domain] = wTotal > 0 ? Math.round((wScore / wTotal) * 10) / 10 : 0;
  }

  // Apply exam blueprint weighting for overall readiness
  let overallReadiness = 0;
  if (blueprint && blueprint.domains) {
    let totalWeight = 0;
    for (const domain of blueprint.domains) {
      const domainScore = domainReadiness[domain.name] ?? domainReadiness["_general"] ?? 0;
      overallReadiness += domainScore * domain.weight;
      totalWeight += domain.weight;
    }
    if (totalWeight > 0) overallReadiness = Math.round((overallReadiness / totalWeight) * 10) / 10;
  } else {
    // No blueprint — simple average
    const values = Object.values(domainReadiness);
    overallReadiness = values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : 0;
  }

  const passPercent = blueprint?.passPercent || 70;
  const estimatedPass = overallReadiness >= passPercent;

  await upsertReadiness(client, userId, certLevel, overallReadiness, domainReadiness, totalQuestions, sessions.length, estimatedPass);

  return { overallReadiness, domainReadiness };
}

async function upsertReadiness(client, userId, certLevel, overall, domainReadiness, questionsAttempted, sessionsCount, estimatedPass) {
  const { data: existing } = await client
    .from("training_readiness")
    .select("id")
    .eq("user_id", userId)
    .eq("cert_level", certLevel)
    .maybeSingle();

  const payload = {
    overall_readiness_percent: overall,
    domain_readiness: domainReadiness,
    questions_attempted: questionsAttempted,
    sessions_count: sessionsCount,
    estimated_pass: estimatedPass,
    last_updated_at: new Date().toISOString(),
  };

  if (existing) {
    await client
      .from("training_readiness")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await client
      .from("training_readiness")
      .insert({
        user_id: userId,
        cert_level: certLevel,
        ...payload,
      });
  }
}

// GET /readiness/:certLevel
router.get("/readiness/:certLevel", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel } = req.params;

    const { data, error } = await supabase
      .from("training_readiness")
      .select("*")
      .eq("user_id", userId)
      .eq("cert_level", certLevel)
      .maybeSingle();

    if (error) throw error;

    res.json({
      readiness: data || {
        cert_level: certLevel,
        overall_readiness_percent: 0,
        domain_readiness: {},
        questions_attempted: 0,
        sessions_count: 0,
        estimated_pass: false,
      },
    });
  } catch (err) {
    console.error("GET /readiness/:certLevel error:", err);
    res.status(500).json({ error: "Failed to load readiness" });
  }
});

// POST /readiness/recalculate/:certLevel
router.post("/readiness/recalculate/:certLevel", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel } = req.params;

    const result = await recalculateReadiness(userId, certLevel);

    res.json(result);
  } catch (err) {
    console.error("POST /readiness/recalculate error:", err);
    res.status(500).json({ error: "Failed to recalculate readiness" });
  }
});

export default router;
