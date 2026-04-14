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

// POST /exam/start — Starts a new exam
router.post("/exam/start", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel, examMode } = req.body;

    if (!certLevel || !examMode) {
      return res.status(400).json({ error: "certLevel and examMode are required" });
    }

    const blueprint = EXAM_BLUEPRINTS[certLevel];
    if (!blueprint) {
      return res.status(400).json({ error: `Unknown cert level: ${certLevel}` });
    }

    // Check for existing in-progress exam
    const { data: activeExam } = await supabase
      .from("training_exam_state")
      .select("id")
      .eq("user_id", userId)
      .eq("cert_level", certLevel)
      .eq("status", "in_progress")
      .maybeSingle();

    if (activeExam) {
      return res.status(409).json({ error: "An exam is already in progress for this cert level", examStateId: activeExam.id });
    }

    // Get all modules for this cert level
    const { data: modules, error: modErr } = await supabase
      .from("training_modules")
      .select("id, module_number")
      .eq("cert_level", certLevel)
      .eq("is_published", true)
      .order("module_number", { ascending: true });

    if (modErr) throw modErr;

    const moduleMap = {};
    for (const m of modules || []) {
      moduleMap[m.module_number] = m.id;
    }

    // Build question set per domain
    let allQuestions = [];
    for (const domain of blueprint.domains) {
      const moduleId = moduleMap[domain.moduleNumber];
      if (!moduleId) continue;

      const { data: domainQuestions, error: qErr } = await supabase
        .from("training_questions")
        .select("id, question_text, option_a, option_b, option_c, option_d, topic, difficulty, module_id, cert_level")
        .eq("module_id", moduleId)
        .eq("flagged_quality", false);

      if (qErr) throw qErr;

      const shuffled = shuffle(domainQuestions || []);
      const selected = shuffled.slice(0, domain.questions);

      // Tag each question with domain info
      const tagged = selected.map((q) => ({
        ...q,
        domainName: domain.name,
        moduleNumber: domain.moduleNumber,
      }));

      allQuestions = allQuestions.concat(tagged);
    }

    // Shuffle all questions
    shuffle(allQuestions);

    const now = new Date().toISOString();
    const timeRemaining = examMode === "timed" ? blueprint.timeMinutes * 60 : null;

    const { data: examState, error: insErr } = await supabase
      .from("training_exam_state")
      .insert({
        user_id: userId,
        cert_level: certLevel,
        exam_mode: examMode,
        questions_json: allQuestions,
        answers_json: {},
        current_question_index: 0,
        time_remaining_seconds: timeRemaining,
        started_at: now,
        last_activity_at: now,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (insErr) throw insErr;

    // Strip answers from questions for client
    const clientQuestions = allQuestions.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      optionD: q.option_d,
      topic: q.topic,
      difficulty: q.difficulty,
      domainName: q.domainName,
    }));

    res.json({
      examStateId: examState.id,
      questions: clientQuestions,
      timeRemaining,
    });
  } catch (err) {
    console.error("POST /exam/start error:", err);
    res.status(500).json({ error: "Failed to start exam" });
  }
});

// POST /exam/save-state — Saves exam progress
router.post("/exam/save-state", async (req, res) => {
  try {
    const userId = req.user.id;
    const { examStateId, answersJson, currentQuestionIndex, reviewFlaggedIds, timeRemainingSeconds } = req.body;

    if (!examStateId) {
      return res.status(400).json({ error: "examStateId is required" });
    }

    const { error } = await supabase
      .from("training_exam_state")
      .update({
        answers_json: answersJson || {},
        current_question_index: currentQuestionIndex ?? 0,
        review_flagged_ids: reviewFlaggedIds || [],
        time_remaining_seconds: timeRemainingSeconds ?? null,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", examStateId)
      .eq("user_id", userId);

    if (error) throw error;

    res.json({ saved: true });
  } catch (err) {
    console.error("POST /exam/save-state error:", err);
    res.status(500).json({ error: "Failed to save exam state" });
  }
});

// POST /exam/submit — Submits a completed exam
router.post("/exam/submit", async (req, res) => {
  try {
    const userId = req.user.id;
    const { examStateId } = req.body;

    if (!examStateId) {
      return res.status(400).json({ error: "examStateId is required" });
    }

    // Fetch exam state
    const { data: examState, error: fetchErr } = await supabase
      .from("training_exam_state")
      .select("*")
      .eq("id", examStateId)
      .eq("user_id", userId)
      .single();

    if (fetchErr || !examState) {
      return res.status(404).json({ error: "Exam state not found" });
    }

    if (examState.status !== "in_progress") {
      return res.status(400).json({ error: "Exam is not in progress" });
    }

    const blueprint = EXAM_BLUEPRINTS[examState.cert_level];
    const questions = examState.questions_json;
    const userAnswers = examState.answers_json || {};

    // Fetch correct answers for all questions
    const questionIds = questions.map((q) => q.id);
    const { data: questionData, error: qErr } = await supabase
      .from("training_questions")
      .select("id, correct_answer, explanation, topic, standard_reference")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const correctMap = {};
    for (const q of questionData || []) {
      correctMap[q.id] = q;
    }

    // Score per domain
    const domainScores = {};
    let totalCorrect = 0;
    const questionsDetail = [];

    for (const q of questions) {
      const correct = correctMap[q.id];
      if (!correct) continue;

      const userAnswer = userAnswers[q.id] || null;
      const isCorrect = userAnswer === correct.correct_answer;
      if (isCorrect) totalCorrect++;

      const domain = q.domainName || "Unknown";
      if (!domainScores[domain]) domainScores[domain] = { correct: 0, total: 0 };
      domainScores[domain].total++;
      if (isCorrect) domainScores[domain].correct++;

      questionsDetail.push({
        questionId: q.id,
        topic: q.topic,
        domain,
        userAnswer,
        correctAnswer: correct.correct_answer,
        explanation: correct.explanation,
        standardReference: correct.standard_reference,
        isCorrect,
      });
    }

    const totalQuestions = questions.length;
    const scorePercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const passPercent = blueprint?.passPercent || 70;
    const passed = scorePercent >= passPercent;

    // Calculate domain percentages
    const domainBreakdown = {};
    for (const [name, scores] of Object.entries(domainScores)) {
      domainBreakdown[name] = {
        correct: scores.correct,
        total: scores.total,
        percent: scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0,
      };
    }

    // Get attempt number
    const { count: prevAttempts } = await supabase
      .from("training_exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("cert_level", examState.cert_level);

    const attemptNumber = (prevAttempts || 0) + 1;
    const now = new Date().toISOString();

    const timeTaken = examState.started_at
      ? Math.round((new Date(now).getTime() - new Date(examState.started_at).getTime()) / 1000)
      : null;

    // Create exam attempt record
    await supabase
      .from("training_exam_attempts")
      .insert({
        user_id: userId,
        cert_level: examState.cert_level,
        exam_mode: examState.exam_mode,
        attempt_number: attemptNumber,
        total_questions: totalQuestions,
        correct_count: totalCorrect,
        score_percent: scorePercent,
        passed,
        pass_threshold: passPercent,
        domain_scores: domainBreakdown,
        time_taken_seconds: timeTaken,
        avg_seconds_per_question: totalQuestions > 0 && timeTaken ? Math.round((timeTaken / totalQuestions) * 10) / 10 : null,
        questions_detail: questionsDetail,
        started_at: examState.started_at,
        completed_at: now,
      });

    // Create test session record
    await supabase
      .from("training_test_sessions")
      .insert({
        user_id: userId,
        cert_level: examState.cert_level,
        session_type: examState.exam_mode === "timed" ? "timed_exam" : "untimed_exam",
        total_questions: totalQuestions,
        correct_count: totalCorrect,
        score_percent: scorePercent,
        domain_scores: domainScores,
        time_taken_seconds: timeTaken,
        started_at: examState.started_at,
        completed_at: now,
      });

    // Mark exam state as completed
    await supabase
      .from("training_exam_state")
      .update({ status: "completed", last_activity_at: now })
      .eq("id", examStateId);

    // Recalculate readiness
    try {
      await recalculateReadiness(userId, examState.cert_level, supabase);
    } catch (_) {
      // Non-fatal
    }

    res.json({
      attemptNumber,
      totalQuestions,
      correctCount: totalCorrect,
      scorePercent,
      passed,
      passThreshold: passPercent,
      domainBreakdown,
      questionsDetail,
      timeTakenSeconds: timeTaken,
    });
  } catch (err) {
    console.error("POST /exam/submit error:", err);
    res.status(500).json({ error: "Failed to submit exam" });
  }
});

// GET /exam/active/:certLevel — Checks for in-progress exam
router.get("/exam/active/:certLevel", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel } = req.params;

    const { data, error } = await supabase
      .from("training_exam_state")
      .select("*")
      .eq("user_id", userId)
      .eq("cert_level", certLevel)
      .eq("status", "in_progress")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.json({ examState: null });
    }

    // Strip correct answers from questions
    const clientQuestions = (data.questions_json || []).map((q) => ({
      id: q.id,
      questionText: q.question_text,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      optionD: q.option_d,
      topic: q.topic,
      difficulty: q.difficulty,
      domainName: q.domainName,
    }));

    res.json({
      examState: {
        id: data.id,
        certLevel: data.cert_level,
        examMode: data.exam_mode,
        questions: clientQuestions,
        answersJson: data.answers_json,
        currentQuestionIndex: data.current_question_index,
        reviewFlaggedIds: data.review_flagged_ids,
        timeRemainingSeconds: data.time_remaining_seconds,
        startedAt: data.started_at,
      },
    });
  } catch (err) {
    console.error("GET /exam/active/:certLevel error:", err);
    res.status(500).json({ error: "Failed to check for active exam" });
  }
});

// POST /exam/abandon — Abandons an in-progress exam
router.post("/exam/abandon", async (req, res) => {
  try {
    const userId = req.user.id;
    const { examStateId } = req.body;

    if (!examStateId) {
      return res.status(400).json({ error: "examStateId is required" });
    }

    const { error } = await supabase
      .from("training_exam_state")
      .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
      .eq("id", examStateId)
      .eq("user_id", userId);

    if (error) throw error;

    res.json({ abandoned: true });
  } catch (err) {
    console.error("POST /exam/abandon error:", err);
    res.status(500).json({ error: "Failed to abandon exam" });
  }
});

// GET /exam/history/:certLevel — Returns all exam attempts
router.get("/exam/history/:certLevel", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel } = req.params;

    const { data, error } = await supabase
      .from("training_exam_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("cert_level", certLevel)
      .order("completed_at", { ascending: false });

    if (error) throw error;

    res.json({ attempts: data || [] });
  } catch (err) {
    console.error("GET /exam/history/:certLevel error:", err);
    res.status(500).json({ error: "Failed to load exam history" });
  }
});

export default router;
