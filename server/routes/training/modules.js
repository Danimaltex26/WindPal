import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

// GET /modules/:certLevel — Returns all modules for a cert level with user progress
router.get("/modules/:certLevel", async (req, res) => {
  try {
    const userId = req.user.id;
    const { certLevel } = req.params;

    const { data: modules, error: modErr } = await supabase
      .from("training_modules")
      .select("*")
      .eq("cert_level", certLevel)
      .eq("is_published", true)
      .order("module_number", { ascending: true });

    if (modErr) throw modErr;
    if (!modules || modules.length === 0) {
      return res.json({ modules: [] });
    }

    const moduleIds = modules.map((m) => m.id);

    // Fetch user progress for these modules
    const { data: progressRows, error: progErr } = await supabase
      .from("training_progress")
      .select("*")
      .eq("user_id", userId)
      .in("module_id", moduleIds);

    if (progErr) throw progErr;

    const progressMap = {};
    for (const p of progressRows || []) {
      progressMap[p.module_id] = p;
    }

    // Get total section counts per module
    const { data: sectionCounts, error: secErr } = await supabase
      .from("training_content")
      .select("module_id")
      .in("module_id", moduleIds);

    if (secErr) throw secErr;

    const sectionCountMap = {};
    for (const s of sectionCounts || []) {
      sectionCountMap[s.module_id] = (sectionCountMap[s.module_id] || 0) + 1;
    }

    // Build response — determine locked status
    const result = modules.map((mod, idx) => {
      const progress = progressMap[mod.id] || {};
      const totalSections = sectionCountMap[mod.id] || 0;

      // First module always unlocked; subsequent unlock when previous has score >= 70
      let locked = false;
      if (idx > 0) {
        const prevMod = modules[idx - 1];
        const prevProgress = progressMap[prevMod.id];
        if (!prevProgress || (prevProgress.last_practice_score_percent || 0) < 70) {
          locked = true;
        }
      }

      return {
        id: mod.id,
        certLevel: mod.cert_level,
        moduleNumber: mod.module_number,
        title: mod.title,
        topicList: mod.topic_list,
        estimatedMinutes: mod.estimated_minutes,
        totalSections,
        locked,
        // Progress fields
        status: progress.status || "not_started",
        conceptSectionsRead: progress.concept_sections_read || 0,
        questionsAttempted: progress.questions_attempted || 0,
        lastPracticeScorePercent: progress.last_practice_score_percent ?? null,
      };
    });

    res.json({ modules: result });
  } catch (err) {
    console.error("GET /modules/:certLevel error:", err);
    res.status(500).json({ error: "Failed to load modules" });
  }
});

// GET /module/:moduleId — Returns full module content with progress
router.get("/module/:moduleId", async (req, res) => {
  try {
    const userId = req.user.id;
    const { moduleId } = req.params;

    // Fetch module info
    const { data: mod, error: modErr } = await supabase
      .from("training_modules")
      .select("id, cert_level, module_number, title, topic_list, estimated_minutes")
      .eq("id", moduleId)
      .single();

    if (modErr) throw modErr;

    // Fetch content sections
    const { data: sections, error: secErr } = await supabase
      .from("training_content")
      .select("*")
      .eq("module_id", moduleId)
      .order("section_number", { ascending: true });

    if (secErr) throw secErr;

    // Fetch user progress for this module
    const { data: progress } = await supabase
      .from("training_progress")
      .select("concept_sections_read")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .maybeSingle();

    const sectionsRead = progress?.concept_sections_read || 0;
    const sectionsTotal = (sections || []).length;

    // Mark sections as read based on progress count
    const enrichedSections = (sections || []).map((s, i) => ({
      ...s,
      is_read: i < sectionsRead,
    }));

    res.json({
      title: mod.title,
      cert_level: mod.cert_level,
      module_number: mod.module_number,
      estimated_minutes: mod.estimated_minutes,
      sections: enrichedSections,
      sections_read: sectionsRead,
      sections_total: sectionsTotal,
    });
  } catch (err) {
    console.error("GET /module/:moduleId error:", err);
    res.status(500).json({ error: "Failed to load module content" });
  }
});

// GET /module/:moduleId/questions — Returns a mixed question set for module practice
router.get("/module/:moduleId/questions", async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Fetch non-flagged seed questions for this module
    const { data: allQuestions, error } = await supabase
      .from("training_questions")
      .select("id, module_id, cert_level, topic, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, standard_reference")
      .eq("module_id", moduleId)
      .eq("flagged_quality", false);

    if (error) throw error;

    let questions = allQuestions || [];

    // Shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // Take up to 12 from seed bank
    const result = questions.slice(0, 12);

    res.json({ questions: result });
  } catch (err) {
    console.error("GET /module/:moduleId/questions error:", err);
    res.status(500).json({ error: "Failed to load questions" });
  }
});

// POST /module/:moduleId/complete-section — Marks a section as read
router.post("/module/:moduleId/complete-section", async (req, res) => {
  try {
    const userId = req.user.id;
    const { moduleId } = req.params;
    const { sectionNumber } = req.body;

    if (sectionNumber == null) {
      return res.status(400).json({ error: "sectionNumber is required" });
    }

    // Get the module's cert_level
    const { data: mod, error: modErr } = await supabase
      .from("training_modules")
      .select("cert_level")
      .eq("id", moduleId)
      .single();

    if (modErr) throw modErr;

    // Count total sections for this module
    const { count: totalSections, error: countErr } = await supabase
      .from("training_content")
      .select("id", { count: "exact", head: true })
      .eq("module_id", moduleId);

    if (countErr) throw countErr;

    // Check for existing progress
    const { data: existing, error: fetchErr } = await supabase
      .from("training_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (existing) {
      const newRead = Math.min((existing.concept_sections_read || 0) + 1, totalSections);
      const newStatus = existing.status === "not_started" ? "in_progress" : existing.status;

      const { error: upErr } = await supabase
        .from("training_progress")
        .update({
          concept_sections_read: newRead,
          total_sections: totalSections,
          status: newStatus,
          last_session_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (upErr) throw upErr;

      res.json({ conceptSectionsRead: newRead, totalSections, status: newStatus });
    } else {
      const { error: insErr } = await supabase
        .from("training_progress")
        .insert({
          user_id: userId,
          module_id: moduleId,
          cert_level: mod.cert_level,
          status: "in_progress",
          concept_sections_read: 1,
          total_sections: totalSections,
          last_session_at: new Date().toISOString(),
        });

      if (insErr) throw insErr;

      res.json({ conceptSectionsRead: 1, totalSections, status: "in_progress" });
    }
  } catch (err) {
    console.error("POST /module/:moduleId/complete-section error:", err);
    res.status(500).json({ error: "Failed to mark section complete" });
  }
});

// POST /module/test/submit — Records a module practice test result
router.post("/module/test/submit", async (req, res) => {
  try {
    const userId = req.user.id;
    const { moduleId, certLevel, answers, timeTakenSeconds } = req.body;

    if (!moduleId || !certLevel || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "moduleId, certLevel, and answers are required" });
    }

    // Fetch the questions with correct answers
    const questionIds = answers.map((a) => a.questionId).filter((id) => !id.startsWith("dynamic-"));
    const { data: questions, error: qErr } = await supabase
      .from("training_questions")
      .select("id, correct_answer, explanation, topic, standard_reference")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const questionMap = {};
    for (const q of questions || []) {
      questionMap[q.id] = q;
    }

    // Calculate score
    let correct = 0;
    let total = 0;
    const topicScores = {};
    const correctAnswers = [];

    for (const ans of answers) {
      if (ans.questionId.startsWith("dynamic-")) continue;

      const q = questionMap[ans.questionId];
      if (!q) continue;

      total++;
      const isCorrect = ans.selectedAnswer === q.correct_answer;
      if (isCorrect) correct++;

      // Track per-topic
      if (!topicScores[q.topic]) topicScores[q.topic] = { correct: 0, total: 0 };
      topicScores[q.topic].total++;
      if (isCorrect) topicScores[q.topic].correct++;

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
    const passed = percent >= 70;

    // Build per-topic breakdown
    const perTopicBreakdown = Object.entries(topicScores).map(([topic, s]) => ({
      topic,
      correct: s.correct,
      total: s.total,
      percent: Math.round((s.correct / s.total) * 100),
    }));

    // Update training_progress
    const { data: existing, error: fetchErr } = await supabase
      .from("training_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    const progressData = {
      questions_attempted: (existing?.questions_attempted || 0) + total,
      questions_correct: (existing?.questions_correct || 0) + correct,
      last_practice_score_percent: percent,
      last_session_at: new Date().toISOString(),
      status: passed ? "completed" : (existing?.status === "not_started" ? "in_progress" : (existing?.status || "in_progress")),
    };

    if (passed) progressData.completed_at = new Date().toISOString();

    if (existing) {
      await supabase
        .from("training_progress")
        .update(progressData)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("training_progress")
        .insert({
          user_id: userId,
          module_id: moduleId,
          cert_level: certLevel,
          ...progressData,
        });
    }

    // Update training_questions stats
    for (const ans of answers) {
      if (ans.questionId.startsWith("dynamic-")) continue;
      const q = questionMap[ans.questionId];
      if (!q) continue;

      const isCorrect = ans.selectedAnswer === q.correct_answer;
      await supabase.rpc("increment_question_stats", {
        qid: ans.questionId,
        answered: 1,
        was_correct: isCorrect ? 1 : 0,
      }).catch(() => {
        // Fallback: direct update if RPC not available
        return supabase
          .from("training_questions")
          .update({
            times_answered: (q.times_answered || 0) + 1,
            times_correct: (q.times_correct || 0) + (isCorrect ? 1 : 0),
          })
          .eq("id", ans.questionId);
      });
    }

    // Create training_test_sessions record
    const now = new Date().toISOString();
    await supabase
      .from("training_test_sessions")
      .insert({
        user_id: userId,
        module_id: moduleId,
        cert_level: certLevel,
        session_type: "module_practice",
        total_questions: total,
        correct_count: correct,
        score_percent: percent,
        domain_scores: topicScores,
        time_taken_seconds: timeTakenSeconds || null,
        started_at: new Date(Date.now() - (timeTakenSeconds || 0) * 1000).toISOString(),
        completed_at: now,
      });

    // Recalculate readiness (fire and forget, imported inline to avoid circular deps)
    try {
      const { recalculateReadiness } = await import("./readiness.js");
      await recalculateReadiness(userId, certLevel, supabase);
    } catch (_) {
      // Non-fatal
    }

    res.json({
      score: correct,
      total,
      percent,
      passed,
      perTopicBreakdown,
      correctAnswers,
    });
  } catch (err) {
    console.error("POST /module/test/submit error:", err);
    res.status(500).json({ error: "Failed to submit test" });
  }
});

export default router;
