import { createClient } from "@supabase/supabase-js";

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseApp = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "windpal" } }
);

export { supabase, supabaseApp };

export default async function auth(req, res, next) {
  try {
    var header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }

    var token = header.replace("Bearer ", "");
    var result = await supabaseAuth.auth.getUser(token);

    if (result.error || !result.data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = result.data.user;

    var profileResult = await supabase
      .from("profiles")
      .select("*")
      .eq("id", result.data.user.id)
      .single();

    if (profileResult.error || !profileResult.data) {
      req.profile = { id: result.data.user.id, subscription_tier: "free" };
    } else {
      req.profile = profileResult.data;
    }

    // Read actual subscription tier from public.subscriptions
    var subResult = await supabase
      .from("subscriptions")
      .select("tier")
      .eq("user_id", result.data.user.id)
      .eq("app", "windpal")
      .maybeSingle();

    req.profile.subscription_tier = subResult.data?.tier || "free";

    // Team-tier override: if user is on an active team, grant Pro
    if (req.profile.team_id && req.profile.subscription_tier === "free") {
      var teamResult = await supabase
        .from("teams")
        .select("subscription_status")
        .eq("id", req.profile.team_id)
        .maybeSingle();

      if (teamResult.data?.subscription_status === "active") {
        req.profile.subscription_tier = "pro";
        req.profile.team_subscription = true;
      }
    }

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Authentication failed" });
  }
}
