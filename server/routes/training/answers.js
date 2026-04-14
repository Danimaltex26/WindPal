import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

// POST /answers/reveal — Reveals correct answer for a single question
router.post("/answers/reveal", async (req, res) => {
  try {
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ error: "questionId is required" });
    }

    const { data: question, error } = await supabase
      .from("training_questions")
      .select("correct_answer, explanation, standard_reference")
      .eq("id", questionId)
      .single();

    if (error || !question) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      standardReference: question.standard_reference,
    });
  } catch (err) {
    console.error("POST /answers/reveal error:", err);
    res.status(500).json({ error: "Failed to reveal answer" });
  }
});

export default router;
