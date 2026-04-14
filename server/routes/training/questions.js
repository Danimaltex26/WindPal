import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { callClaude } from "../../utils/claudeClient.js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

const QUESTION_GEN_SYSTEM_PROMPT = `You are an expert wind energy certification instructor with 20+ years of experience training and examining wind turbine technicians at all levels from GWO Basic Safety Training through Senior Wind Turbine Technician. You have deep knowledge of GWO, ACP, OSHA, IEC 61400, and NFPA 70E standards as applied in real field conditions on onshore and offshore wind farms.

Generate multiple choice exam questions for the {cert_level} certification exam.

Module: {module_title}
Topic: {specific_topic}
Difficulty level: {difficulty}
Number of questions needed: {count}

DIFFICULTY DEFINITIONS:
foundation — recall of key facts, definitions, and specifications.
applied — applying knowledge to a realistic field scenario or performing a calculation.
analysis — interpreting test results, diagnosing a problem, or evaluating competing options.

Return ONLY a valid JSON array. No preamble, no markdown, no explanation outside the JSON. Each element:
{
  "question_text": "string",
  "option_a": "string",
  "option_b": "string",
  "option_c": "string",
  "option_d": "string",
  "correct_answer": "A | B | C | D",
  "explanation": "string — min 80 words, explains correct AND why each wrong answer is wrong",
  "standard_reference": "string or null",
  "difficulty": "foundation | applied | analysis",
  "topic": "string"
}`;

function buildSystemPrompt(certLevel, moduleTitle, topic, difficulty, count) {
  return QUESTION_GEN_SYSTEM_PROMPT
    .replace("{cert_level}", certLevel)
    .replace("{module_title}", moduleTitle)
    .replace("{specific_topic}", topic)
    .replace("{difficulty}", difficulty)
    .replace("{count}", String(count));
}

function parseJsonFromResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const start = cleaned.indexOf("[");
    if (start === -1) throw new Error("No JSON array found in response");

    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "[") depth++;
      else if (cleaned[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) throw new Error("Unbalanced JSON array in response");

    return JSON.parse(cleaned.substring(start, end + 1));
  }
}

function validateQuestion(q) {
  const required = ["question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "difficulty", "topic"];
  for (const field of required) {
    if (!q[field]) return false;
  }
  if (!["A", "B", "C", "D"].includes(q.correct_answer)) return false;
  if (!["foundation", "applied", "analysis"].includes(q.difficulty)) return false;
  return true;
}

// POST /questions/generate — Dynamic question generation via Claude
router.post("/questions/generate", async (req, res) => {
  try {
    const { certLevel, moduleTitle, topic, difficulty, count } = req.body;

    if (!certLevel || !moduleTitle || !topic || !difficulty || !count) {
      return res.status(400).json({ error: "certLevel, moduleTitle, topic, difficulty, and count are required" });
    }

    const { data: mod } = await supabase
      .from("training_modules")
      .select("id")
      .eq("cert_level", certLevel)
      .eq("title", moduleTitle)
      .maybeSingle();

    const moduleId = mod?.id;

    const systemPrompt = buildSystemPrompt(certLevel, moduleTitle, topic, difficulty, count);

    var aiResult = await callClaude({
      feature: 'question_generation',
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate ${count} ${difficulty}-level questions about "${topic}" for the ${certLevel} certification exam, module "${moduleTitle}".`,
        },
      ],
    });

    const responseText = aiResult.content;
    const parsed = parseJsonFromResponse(responseText);

    if (!Array.isArray(parsed)) {
      return res.status(500).json({ error: "AI response was not a valid question array" });
    }

    const validQuestions = parsed.filter(validateQuestion);

    if (validQuestions.length === 0) {
      return res.status(500).json({ error: "No valid questions generated" });
    }

    const insertRows = validQuestions.map((q) => ({
      module_id: moduleId,
      cert_level: certLevel,
      topic: q.topic,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      standard_reference: q.standard_reference || null,
      difficulty: q.difficulty,
      is_dynamic: true,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("training_questions")
      .insert(insertRows)
      .select("id, question_text, option_a, option_b, option_c, option_d, topic, difficulty, standard_reference");

    if (insErr) throw insErr;

    res.json({ questions: inserted || [], generated: validQuestions.length });
  } catch (err) {
    console.error("POST /questions/generate error:", err);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// POST /questions/flag — Flag a question for quality issues
router.post("/questions/flag", async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, flagReason, flagDetail } = req.body;

    if (!questionId || !flagReason) {
      return res.status(400).json({ error: "questionId and flagReason are required" });
    }

    const { error: flagErr } = await supabase
      .from("training_flags")
      .insert({
        user_id: userId,
        question_id: questionId,
        flag_reason: flagReason,
        flag_detail: flagDetail || null,
      });

    if (flagErr) throw flagErr;

    const { error: upErr } = await supabase
      .from("training_questions")
      .update({ flagged_quality: true })
      .eq("id", questionId);

    if (upErr) throw upErr;

    res.json({ flagged: true });
  } catch (err) {
    console.error("POST /questions/flag error:", err);
    res.status(500).json({ error: "Failed to flag question" });
  }
});

export default router;
