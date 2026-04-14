import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import auth from "../middleware/auth.js";
import { callClaude } from "../utils/claudeClient.js";
import { requiresSpecificClause } from "../utils/modelRouter.js";

var router = Router();

var supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

var WIND_REFERENCE_SYSTEM_PROMPT = "You are a wind turbine technical reference database specializing in IEC 61400 standards, turbine specifications, component specs, torque values, fluid specifications, safety standards, and electrical systems for wind energy. Answer questions about turbine models, maintenance procedures, torque specifications, lubricant types, safety requirements, and electrical configurations.\n" +
"\n" +
"Return ONLY a valid JSON object:\n" +
"\n" +
"{\n" +
"  \"category\": \"turbine_specs | component_specs | torque_values | fluid_specs | safety | electrical\",\n" +
"  \"title\": \"string -- concise title for this reference entry\",\n" +
"  \"equipment_type\": \"string or null\",\n" +
"  \"system_type\": \"string or null -- pitch, yaw, gearbox, generator, converter, hydraulic, cooling, etc.\",\n" +
"  \"specification\": \"string or null -- IEC standard, GL guideline, manufacturer service bulletin reference\",\n" +
"  \"content\": {\n" +
"    \"summary\": \"string -- plain English answer\",\n" +
"    \"key_values\": [\n" +
"      { \"label\": \"string\", \"value\": \"string\" }\n" +
"    ],\n" +
"    \"important_notes\": [\"string\"],\n" +
"    \"related_references\": [\"string\"]\n" +
"  },\n" +
"  \"source_confidence\": \"high | medium | low\",\n" +
"  \"disclaimer\": \"string or null\"\n" +
"}\n" +
"\n" +
"RULES:\n" +
"- Turbine specs must cite rated power, rotor diameter, hub height range, cut-in/cut-out/rated wind speeds, and drivetrain type when known.\n" +
"- Torque values must specify bolt size, grade, lubrication condition (dry/oiled/with thread-lock), and applicable standard.\n" +
"- Fluid specs must include viscosity grade, operating temperature range, change intervals, and compatible brands.\n" +
"- Safety references must cite GWO (Global Wind Organisation) training modules, IEC 61400-1 design requirements, and site-specific considerations.\n" +
"- Electrical references must cover generator type (DFIG, PMG, full converter), voltage levels, transformer specs, and grid code requirements.\n" +
"- Always reference IEC 61400 series standards where applicable (61400-1 design, 61400-2 small turbines, 61400-25 communications).\n" +
"- Note manufacturer-specific requirements when the turbine platform is identified (Vestas, Siemens Gamesa, GE, Nordex, Enercon, Goldwind).\n" +
"- Differentiate between onshore and offshore requirements where applicable.\n" +
"- Always note when values may vary by turbine variant or serial number range.";

router.post("/query", auth, async function (req, res) {
  try {
    var userId = req.user.id;
    var query = req.body.query;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "A query string is required" });
    }
    var searchTerm = query.trim();

    // Step 1 -- fuzzy match existing reference
    var matches = [];
    var byTitle = await supabaseService
      .from("wind_reference")
      .select("*")
      .ilike("title", "%" + searchTerm + "%")
      .limit(5);
    if (byTitle.data && byTitle.data.length) matches = byTitle.data;

    if (!matches.length) {
      var byCategory = await supabaseService
        .from("wind_reference")
        .select("*")
        .ilike("category", "%" + searchTerm + "%")
        .limit(5);
      if (byCategory.data && byCategory.data.length) matches = byCategory.data;
    }

    if (!matches.length) {
      var byEquip = await supabaseService
        .from("wind_reference")
        .select("*")
        .ilike("equipment_type", "%" + searchTerm + "%")
        .limit(5);
      if (byEquip.data && byEquip.data.length) matches = byEquip.data;
    }

    if (matches.length > 0) {
      var match = matches[0];
      await supabaseService
        .from("wind_reference")
        .update({ query_count: (match.query_count || 0) + 1 })
        .eq("id", match.id);
      return res.json({ result: match, source: "database" });
    }

    // Gate AI calls only
    if (req.profile.subscription_tier === "free") {
      var startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      var countRes = await supabaseService
        .from("reference_queries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth);
      if (countRes.count >= 5) {
        return res.status(403).json({
          error: "Monthly limit reached",
          message: "Free tier allows 5 AI reference lookups per month. Upgrade to Pro for unlimited.",
          limit: 5,
          used: countRes.count,
        });
      }
    }

    // Step 2 -- Claude
    var feature = requiresSpecificClause(searchTerm) ? 'code_citation' : 'reference_lookup';
    var aiResult = await callClaude({
      feature: feature,
      systemPrompt: WIND_REFERENCE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: query }],
    });
    var rawText = aiResult.content;
    var result;
    try {
      var stripped = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      try {
        result = JSON.parse(stripped);
      } catch (e) {
        var start = stripped.indexOf("{");
        if (start === -1) throw new Error("No JSON found");
        var depth = 0;
        var end = -1;
        for (var j = start; j < stripped.length; j++) {
          if (stripped[j] === "{") depth++;
          else if (stripped[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
        }
        if (end === -1) throw new Error("Unbalanced JSON");
        result = JSON.parse(stripped.slice(start, end + 1));
      }
    } catch (parseErr) {
      console.error("Reference parse error:", parseErr.message, rawText);
      return res.status(500).json({ error: "Failed to parse reference result", raw: rawText });
    }

    // Write back to DB
    var insertResult = await supabaseService
      .from("wind_reference")
      .insert({
        category: result.category,
        title: result.title,
        equipment_type: result.equipment_type,
        system_type: result.system_type,
        specification: result.specification,
        content_json: result.content,
        source: "ai_generated",
        query_count: 1,
      })
      .select()
      .single();

    if (insertResult.error) console.error("Reference insert error:", insertResult.error);

    await supabaseService.from("reference_queries").insert({ user_id: userId, query: searchTerm, source: "ai" });
    return res.json({ result: insertResult.data || result, source: "ai", model: aiResult.model });
  } catch (err) {
    console.error("Reference query error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/browse", auth, async function (req, res) {
  try {
    var category = req.query.category;
    var equipment_type = req.query.equipment_type;
    var q = supabaseService.from("wind_reference").select("*").order("query_count", { ascending: false }).limit(50);
    if (category) q = q.eq("category", category);
    if (equipment_type) q = q.ilike("equipment_type", "%" + equipment_type + "%");
    var queryResult = await q;
    if (queryResult.error) return res.status(500).json({ error: queryResult.error.message });
    return res.json({ results: queryResult.data });
  } catch (err) {
    console.error("Reference browse error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
