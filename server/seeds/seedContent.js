// Generate and seed training content for WindPal via Claude API
// Run: node seeds/seedContent.js [CERT_LEVEL]

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

const anthropic = new Anthropic();

const SYSTEM_PROMPT = "You are an expert wind turbine certification instructor with 20+ years of experience training wind turbine technicians at all levels from wind tech through master wind turbine technician and IEC 61400 qualified persons. You have deep knowledge of the GWO and ACP standards, IEC 61400, OSHA electrical standards, IEEE 1584, and state licensing requirements.\n\nGenerate learning content sections for a training module. Each section should teach a specific concept in depth — written for working wind turbine technicians, not academics. Use real-world examples, actual standard section references, and practical field context.\n\nReturn ONLY a valid JSON array with 5 sections. No preamble, no markdown fences, no explanation outside the JSON. Each element:\n{\n  \"section_number\": 1,\n  \"section_title\": \"string — clear, descriptive title\",\n  \"content_type\": \"concept | example | formula | tip\",\n  \"content_text\": \"string — 150-300 words of instructional content. Use real standard sections, actual values, and practical explanations. Write in a direct, professional tone.\",\n  \"standard_reference\": \"string or null — e.g. NEC Article 210.8, IEC 61400 Table 130.7(C)(15)\"\n}\n\nCONTENT TYPE GUIDELINES:\n- concept: Core instructional material explaining how something works, why it matters, and key code values\n- example: A realistic field scenario showing the concept in practice — include specific wire sizes, breaker ratings, or load calculations\n- formula: Mathematical relationships with worked examples using real values (Ohms law, load calcs, voltage drop, conduit fill)\n- tip: Practical field advice that comes from experience — things an wind tech might not know\n\nRULES:\n- Every section must be independently useful — no \"as we discussed\" references\n- Use actual standard section numbers and table references from the current code cycle\n- Include specific torque specs, component data, turbine models, or equipment where relevant\n- Write for comprehension, not memorization — explain the WHY behind each code requirement\n- Section 1 should introduce the core concept\n- Section 5 should be a practical tip or field example that ties everything together\n- Vary content_type across sections — don't make all 5 the same type";

async function generateContent(certLevel, moduleTitle, topicList) {
  const topicStr = topicList.join(", ");
  const userPrompt = "Generate 5 learning content sections for the " + certLevel + " certification module: \"" + moduleTitle + "\"\n\nTopics to cover: " + topicStr + "\n\nWrite content that would prepare an wind turbine technician for the " + certLevel + " certification exam while giving them practical field knowledge.";

  let retries = 0;
  while (retries < 3) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const rawText = response.content[0].text;
      const stripped = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(stripped);
      } catch {
        const start = stripped.indexOf("[");
        const end = stripped.lastIndexOf("]");
        if (start === -1 || end === -1) throw new Error("No JSON array found");
        parsed = JSON.parse(stripped.slice(start, end + 1));
      }

      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array");

      return parsed.filter(s => s.section_number && s.section_title && s.content_type && s.content_text);
    } catch (err) {
      retries++;
      if (retries >= 3) { console.error("    [FAIL] " + moduleTitle + ": " + err.message); return []; }
      console.log("    [retry " + retries + "] " + err.message);
    }
  }
  return [];
}

async function main() {
  console.log("=== Seeding WindPal Training Content ===\n");
  const targetLevel = process.argv[2] || null;

  const query = supabase
    .from("training_modules")
    .select("id, cert_level, module_number, title, topic_list")
    .eq("is_published", true)
    .order("cert_level").order("module_number");
  if (targetLevel) query.eq("cert_level", targetLevel);

  const { data: modules, error } = await query;
  if (error || !modules) { console.error("Failed:", error?.message); return; }

  let totalSeeded = 0;
  for (const mod of modules) {
    const { count } = await supabase.from("training_content").select("*", { count: "exact", head: true }).eq("module_id", mod.id);
    if (count >= 4) { console.log("[skip] " + mod.cert_level + " M" + mod.module_number + ": " + mod.title + " — " + count + " sections"); continue; }

    console.log("[gen] " + mod.cert_level + " M" + mod.module_number + ": " + mod.title + "...");
    const sections = await generateContent(mod.cert_level, mod.title, mod.topic_list);
    if (sections.length === 0) { console.log("  [WARN] No content"); continue; }

    let inserted = 0;
    for (const s of sections) {
      const { data: ex } = await supabase.from("training_content").select("id").eq("module_id", mod.id).eq("section_number", s.section_number).maybeSingle();
      if (ex) continue;
      const { error: ie } = await supabase.from("training_content").insert({
        module_id: mod.id, section_number: s.section_number, section_title: s.section_title,
        content_type: s.content_type, content_text: s.content_text, standard_reference: s.standard_reference || null,
      });
      if (!ie) inserted++;
    }
    console.log("  [ok] " + inserted + " sections");
    totalSeeded += inserted;
  }
  console.log("\n=== Done — " + totalSeeded + " sections seeded ===");
}

main().catch(console.error);
