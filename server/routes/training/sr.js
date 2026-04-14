import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

// GET /sr/queue — Returns questions due for review
router.get("/sr/queue", async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();

    // Fetch due SR entries
    const { data: srEntries, error: srErr } = await supabase
      .from("training_spaced_repetition")
      .select("question_id, interval_days, ease_factor, repetitions, last_quality_rating")
      .eq("user_id", userId)
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(50);

    if (srErr) throw srErr;

    if (!srEntries || srEntries.length === 0) {
      return res.json({ questions: [] });
    }

    const questionIds = srEntries.map((e) => e.question_id);

    // Fetch full question data including answers
    const { data: questions, error: qErr } = await supabase
      .from("training_questions")
      .select("*")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const questionMap = {};
    for (const q of questions || []) {
      questionMap[q.id] = q;
    }

    const result = srEntries
      .map((entry) => {
        const q = questionMap[entry.question_id];
        if (!q) return null;
        return {
          id: q.id,
          moduleId: q.module_id,
          certLevel: q.cert_level,
          topic: q.topic,
          questionText: q.question_text,
          optionA: q.option_a,
          optionB: q.option_b,
          optionC: q.option_c,
          optionD: q.option_d,
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
          standardReference: q.standard_reference,
          difficulty: q.difficulty,
          intervalDays: entry.interval_days,
          easeFactor: entry.ease_factor,
          repetitions: entry.repetitions,
        };
      })
      .filter(Boolean);

    res.json({ questions: result });
  } catch (err) {
    console.error("GET /sr/queue error:", err);
    res.status(500).json({ error: "Failed to load review queue" });
  }
});

// POST /sr/review — Records a spaced repetition review
router.post("/sr/review", async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, qualityRating } = req.body;

    if (!questionId || qualityRating == null || qualityRating < 1 || qualityRating > 5) {
      return res.status(400).json({ error: "questionId and qualityRating (1-5) are required" });
    }

    // Fetch existing SR entry
    const { data: existing } = await supabase
      .from("training_spaced_repetition")
      .select("*")
      .eq("user_id", userId)
      .eq("question_id", questionId)
      .maybeSingle();

    let intervalDays;
    let easeFactor;
    let repetitions;

    if (!existing) {
      // First time — defaults
      easeFactor = 2.5;
      repetitions = 0;
      intervalDays = 1;
    } else {
      easeFactor = Number(existing.ease_factor) || 2.5;
      repetitions = existing.repetitions || 0;
      intervalDays = existing.interval_days || 1;
    }

    // SM-2 algorithm
    if (qualityRating <= 2) {
      // Reset
      intervalDays = 1;
      repetitions = 0;
      // ease unchanged
    } else if (qualityRating === 3) {
      intervalDays = Math.round(intervalDays * 1.0);
      easeFactor = Math.max(1.3, easeFactor - 0.14);
      repetitions++;
    } else if (qualityRating === 4) {
      intervalDays = Math.round(intervalDays * easeFactor);
      // ease unchanged
      repetitions++;
    } else {
      // qualityRating === 5
      intervalDays = Math.round(intervalDays * easeFactor);
      easeFactor = easeFactor + 0.10;
      repetitions++;
    }

    // After reset: first review 1 day, second 6 days, subsequent prev * ease
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    }
    // else: already calculated above

    // Minimum ease
    easeFactor = Math.max(1.3, easeFactor);

    // Minimum interval
    intervalDays = Math.max(1, intervalDays);

    const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      next_review_at: nextReviewAt,
      interval_days: intervalDays,
      ease_factor: Math.round(easeFactor * 100) / 100,
      repetitions,
      last_quality_rating: qualityRating,
    };

    if (existing) {
      await supabase
        .from("training_spaced_repetition")
        .update(payload)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("training_spaced_repetition")
        .insert({
          user_id: userId,
          question_id: questionId,
          ...payload,
        });
    }

    res.json({
      nextReviewAt,
      intervalDays,
      easeFactor: payload.ease_factor,
      repetitions,
    });
  } catch (err) {
    console.error("POST /sr/review error:", err);
    res.status(500).json({ error: "Failed to record review" });
  }
});

// GET /sr/count — Returns count of due questions (for badge)
router.get("/sr/count", async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();

    const { count, error } = await supabase
      .from("training_spaced_repetition")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("next_review_at", now);

    if (error) throw error;

    res.json({ dueCount: count || 0 });
  } catch (err) {
    console.error("GET /sr/count error:", err);
    res.status(500).json({ error: "Failed to get review count" });
  }
});

export default router;
