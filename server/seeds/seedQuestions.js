// Generate and seed training questions for WindPal via Claude API
// Run: node seeds/seedQuestions.js [CERT_LEVEL]

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

const anthropic = new Anthropic();

const SYSTEM_PROMPT = "You are an expert wind turbine certification instructor with 20+ years of experience training and examining wind turbine technicians at all levels from wind tech through master and IEC 61400. You have deep knowledge of the GWO and ACP standards, IEC 61400, OSHA electrical standards, and state licensing exams.\n\nGenerate multiple choice exam questions for the {cert_level} certification exam.\n\nModule: {module_title}\nTopic: {specific_topic}\nDifficulty level: {difficulty}\nNumber of questions needed: {count}\n\nDIFFICULTY DEFINITIONS:\nfoundation — recall of key facts, standard sections, and specifications.\napplied — applying knowledge to a realistic field scenario or performing a calculation.\nanalysis — interpreting test results, diagnosing a problem, or evaluating competing options.\n\nReturn ONLY a valid JSON array. No preamble, no markdown, no explanation outside the JSON. Each element:\n{\n  \"question_text\": \"string\",\n  \"option_a\": \"string\",\n  \"option_b\": \"string\",\n  \"option_c\": \"string\",\n  \"option_d\": \"string\",\n  \"correct_answer\": \"A | B | C | D\",\n  \"explanation\": \"string — min 80 words, explains correct AND why each wrong answer is wrong\",\n  \"standard_reference\": \"string or null\",\n  \"difficulty\": \"foundation | applied | analysis\",\n  \"topic\": \"string\"\n}\n\nCRITICAL RULES:\n- Wrong answers must be plausible — use common misconceptions, close numerical values, or real alternatives\n- Never use \"none of the above\" as a filler\n- Applied/analysis questions must describe realistic field scenarios\n- Use actual standard sections, table values, and IEC 61400 references\n- Each question must be independently answerable\n- Do not duplicate questions — vary the scenario or angle";

async function generateQuestions(certLevel, moduleTitle, topics, count) {
  var foundation = Math.round(count * 0.4);
  var applied = Math.round(count * 0.4);
  var analysis = count - foundation - applied;
  var allQuestions = [];

  var diffs = [["foundation", foundation], ["applied", applied], ["analysis", analysis]];
  for (var d = 0; d < diffs.length; d++) {
    var difficulty = diffs[d][0];
    var diffCount = diffs[d][1];
    if (diffCount <= 0) continue;
    var topicStr = topics.slice(0, 5).join(", ");
    var prompt = SYSTEM_PROMPT
      .replace("{cert_level}", certLevel).replace("{module_title}", moduleTitle)
      .replace("{specific_topic}", topicStr).replace("{difficulty}", difficulty).replace("{count}", String(diffCount));

    var retries = 0;
    while (retries < 2) {
      try {
        var response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514", max_tokens: 4096,
          system: prompt,
          messages: [{ role: "user", content: "Generate " + diffCount + " " + difficulty + "-level questions for " + moduleTitle + ". Topics: " + topicStr }],
        });
        var rawText = response.content[0].text;
        var stripped = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        var parsed;
        try { parsed = JSON.parse(stripped); } catch (_e) {
          var start = stripped.indexOf("["); var end = stripped.lastIndexOf("]");
          if (start === -1 || end === -1) throw new Error("No JSON array");
          parsed = JSON.parse(stripped.slice(start, end + 1));
        }
        if (!Array.isArray(parsed)) throw new Error("Not an array");
        for (var qi = 0; qi < parsed.length; qi++) {
          var q = parsed[qi];
          if (!q.question_text || !q.option_a || !q.correct_answer || !q.explanation) continue;
          if (["A","B","C","D"].indexOf(q.correct_answer) === -1) continue;
          allQuestions.push({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_answer: q.correct_answer, explanation: q.explanation, standard_reference: q.standard_reference || null, difficulty: q.difficulty || difficulty, topic: q.topic || topicStr });
        }
        break;
      } catch (err) {
        retries++;
        if (retries >= 2) console.error("    [FAIL] " + difficulty + " for " + moduleTitle + ": " + err.message);
        else console.log("    [retry] " + difficulty + " attempt " + retries + "...");
      }
    }
  }
  return allQuestions;
}

async function main() {
  console.log("=== Seeding WindPal Training Questions ===\n");
  var targetLevel = process.argv[2] || null;

  var query = supabase.from("training_modules")
    .select("id, cert_level, module_number, title, topic_list")
    .order("cert_level").order("module_number");
  if (targetLevel) query.eq("cert_level", targetLevel);

  var result = await query;
  if (result.error || !result.data) { console.error("Failed:", result.error?.message); return; }
  var modules = result.data;

  var totalSeeded = 0;
  for (var i = 0; i < modules.length; i++) {
    var mod = modules[i];
    var countResult = await supabase.from("training_questions").select("*", { count: "exact", head: true }).eq("module_id", mod.id);
    var existingCount = countResult.count || 0;
    if (existingCount >= 20) { console.log("[skip] " + mod.cert_level + " M" + mod.module_number + ": " + mod.title + " — " + existingCount + " questions"); continue; }

    var needed = 20 - existingCount;
    console.log("[gen] " + mod.cert_level + " M" + mod.module_number + ": " + mod.title + " — " + needed + " questions...");
    var questions = await generateQuestions(mod.cert_level, mod.title, mod.topic_list, needed);
    if (questions.length === 0) { console.log("  [WARN] None generated"); continue; }

    var rows = questions.map(function(q) { return {
      module_id: mod.id, cert_level: mod.cert_level, topic: q.topic,
      question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c, option_d: q.option_d, correct_answer: q.correct_answer,
      explanation: q.explanation, standard_reference: q.standard_reference,
      difficulty: q.difficulty, is_dynamic: false,
    }; });
    var insertResult = await supabase.from("training_questions").insert(rows);
    if (insertResult.error) console.error("  [ERROR] " + insertResult.error.message);
    else { console.log("  [ok] " + questions.length + " questions"); totalSeeded += questions.length; }
  }
  console.log("\n=== Done — " + totalSeeded + " questions seeded ===");
}

main().catch(console.error);
