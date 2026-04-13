// Seed WindPal training modules into Supabase
// Run: node seeds/seedTraining.js

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { MODULES } from "./trainingModules.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

async function main() {
  console.log("=== WindPal Training Seed ===\n");
  for (const mod of MODULES) {
    const { data: existing } = await supabase
      .from("training_modules").select("id")
      .eq("cert_level", mod.cert_level).eq("module_number", mod.module_number)
      .maybeSingle();
    if (existing) { console.log("  [skip] " + mod.cert_level + " M" + mod.module_number + ": " + mod.title); continue; }

    const { error } = await supabase.from("training_modules").insert({
      cert_level: mod.cert_level, module_number: mod.module_number, title: mod.title,
      topic_list: mod.topic_list, estimated_minutes: mod.estimated_minutes, exam_domain_weight: mod.exam_domain_weight,
    });
    if (error) console.error("  [ERROR] " + mod.cert_level + " M" + mod.module_number + ": " + error.message);
    else console.log("  [ok] " + mod.cert_level + " M" + mod.module_number + ": " + mod.title);
  }
  console.log("\n=== Done ===");
}

main().catch(console.error);
