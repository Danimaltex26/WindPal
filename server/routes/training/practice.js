import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { EXAM_BLUEPRINTS } from "../../config/examBlueprints.js";
import { recalculateReadiness } from "./readiness.js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// POST /practice/start — Starts a practice/drill/study session
router.post("/practice/start", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel, sessionType, moduleId, topic, questionCount, difficulty, includeAI } = req.body;

    if (!certLevel || !sessionType) {
      return res.status(400).json({ error: "certLevel and sessionType are required" });
    }

    const limit = questionCount || 20;
    let query = supabase
      .from("training_questions")
      .select("id, module_id, cert_level, topic, question_text, option_a, option_b, option_c, option_d, difficulty, standard_reference, correct_answer, explanation")
      .eq("cert_level", certLevel)
      .eq("flagged_quality", false);

    if (moduleId) query = query.eq("module_id", moduleId);
    if (topic) query = query.eq("topic", topic);
    if (difficulty) query = query.eq("difficulty", difficulty);

    const { data: allQuestions, error: qErr } = await query;
    if (qErr) throw qErr;

    let questions = allQuestions || [];

    if (sessionType === "weak_area_drill") {
      // Read readiness to identify weak domains
      const { data: readiness } = await supabase
        .from("training_readiness")
        .select("domain_readiness")
        .eq("user_id", userId)
        .eq("cert_level", certLevel)
        .maybeSingle();

      const domainReadiness = readiness?.domain_readiness || {};
      const weakDomains = Object.entries(domainReadiness)
        .filter(([_, score]) => score < 70)
        .sort(([, a], [, b]) => a - b);

      if (weakDomains.length > 0) {
        // Allocate questions proportionally to weakness (lower score = more questions)
        const totalDeficit = weakDomains.reduce((sum, [, score]) => sum + (70 - score), 0);
        const domainAllocations = {};
        for (const [domain, score] of weakDomains) {
          domainAllocations[domain] = Math.max(1, Math.round(((70 - score) / totalDeficit) * limit));
        }

        // Filter questions to weak topics and allocate
        const weakQuestions = [];
        for (const [domain, count] of Object.entries(domainAllocations)) {
          const matching = questions.filter((q) => q.topic === domain);
          shuffle(matching);
          weakQuestions.push(...matching.slice(0, count));
        }

        questions = weakQuestions;
      }
    }

    shuffle(questions);
    questions = questions.slice(0, limit);

    // For study sessions, include answers; for practice, strip them
    const showAnswers = sessionType === "study" || sessionType === "flashcard";
    const clientQuestions = questions.map((q) => {
      const base = {
        id: q.id,
        topic: q.topic,
        questionText: q.question_text,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        difficulty: q.difficulty,
        standardReference: q.standard_reference,
      };
      if (showAnswers) {
        base.correctAnswer = q.correct_answer;
        base.explanation = q.explanation;
      }
      return base;
    });

    res.json({ questions: clientQuestions, sessionType, certLevel });
  } catch (err) {
    console.error("POST /practice/start error:", err);
    res.status(500).json({ error: "Failed to start practice session" });
  }
});

// POST /practice/submit — Submits practice session results
router.post("/practice/submit", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel, sessionType, moduleId, answers, timeTakenSeconds } = req.body;

    if (!certLevel || !sessionType || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "certLevel, sessionType, and answers are required" });
    }

    // Fetch correct answers
    const questionIds = answers.map((a) => a.questionId);
    const { data: questions, error: qErr } = await supabase
      .from("training_questions")
      .select("id, correct_answer, explanation, topic, standard_reference")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const questionMap = {};
    for (const q of questions || []) {
      questionMap[q.id] = q;
    }

    let correct = 0;
    let total = 0;
    const domainScores = {};
    const correctAnswers = [];

    for (const ans of answers) {
      const q = questionMap[ans.questionId];
      if (!q) continue;

      total++;
      const isCorrect = ans.selectedAnswer === q.correct_answer;
      if (isCorrect) correct++;

      if (!domainScores[q.topic]) domainScores[q.topic] = { correct: 0, total: 0 };
      domainScores[q.topic].total++;
      if (isCorrect) domainScores[q.topic].correct++;

      correctAnswers.push({
        questionId: q.id,
        correctAnswer: q.correct_answer,
        explanation: q.explanation,
        standardReference: q.standard_reference,
        userAnswer: ans.selectedAnswer,
        isCorrect,
      });
    }

    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const now = new Date().toISOString();

    // Record test session
    await supabase
      .from("training_test_sessions")
      .insert({
        user_id: userId,
        module_id: moduleId || null,
        cert_level: certLevel,
        session_type: sessionType,
        total_questions: total,
        correct_count: correct,
        score_percent: percent,
        domain_scores: domainScores,
        time_taken_seconds: timeTakenSeconds || null,
        started_at: new Date(Date.now() - (timeTakenSeconds || 0) * 1000).toISOString(),
        completed_at: now,
      });

    // Recalculate readiness
    try {
      await recalculateReadiness(userId, certLevel, supabase);
    } catch (_) {
      // Non-fatal
    }

    const perTopicBreakdown = Object.entries(domainScores).map(([topic, s]) => ({
      topic,
      correct: s.correct,
      total: s.total,
      percent: Math.round((s.correct / s.total) * 100),
    }));

    res.json({
      score: correct,
      total,
      percent,
      perTopicBreakdown,
      correctAnswers,
    });
  } catch (err) {
    console.error("POST /practice/submit error:", err);
    res.status(500).json({ error: "Failed to submit practice results" });
  }
});

export default router;
