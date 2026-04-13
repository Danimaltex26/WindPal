// Shared email notification utility -- works across all Pal apps.
// Uses Resend API directly (no extra deps).

var RESEND_API_KEY = process.env.RESEND_API_KEY;
var FROM_EMAIL = "noreply@tradepals.net";
var FROM_NAME = "TradePals";

// App config -- each app passes its key, the rest is derived
var APP_CONFIG = {
  splicepal: { name: "SplicePal", color: "#33cc33", url: "https://splicepal.tradepals.net" },
  weldpal:   { name: "WeldPal",   color: "#F97316", url: "https://weldpal.tradepals.net" },
  poolpal:   { name: "PoolPal",   color: "#14B8A6", url: "https://poolpal.tradepals.net" },
  voltpal:   { name: "VoltPal",   color: "#FACC15", url: "https://voltpal.tradepals.net" },
  windpal:   { name: "WindPal",   color: "#60A5FA", url: "https://windpal.tradepals.net" },
  pipepal:   { name: "PipePal",   color: "#3B82F6", url: "https://pipepal.tradepals.net" },
};

function buildAnalysisReadyEmail(opts) {
  var appKey = opts.appKey;
  var displayName = opts.displayName;
  var analysisType = opts.analysisType;
  var app = APP_CONFIG[appKey] || APP_CONFIG.windpal;
  var logoUrl = "https://tradepals.net/" + appKey + "-logo.png";
  var historyUrl = app.url + "/history";
  var firstName = (displayName || "").split(" ")[0] || "there";
  var typeLabel = (analysisType || "photo").replace(/_/g, " ");
  // Use dark text for yellow buttons (VoltPal), white for others
  var btnTextColor = appKey === "voltpal" ? "#0f0f10" : "#ffffff";

  return "<!DOCTYPE html>\n" +
"<html>\n" +
"<head>\n" +
"  <meta charset=\"utf-8\">\n" +
"  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
"  <title>Your " + app.name + " analysis is ready</title>\n" +
"</head>\n" +
"<body style=\"margin:0;padding:0;background:#0f0f10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e7;\">\n" +
"  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#0f0f10;padding:32px 16px;\">\n" +
"    <tr>\n" +
"      <td align=\"center\">\n" +
"        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:480px;background:#17171a;border:1px solid #2a2a2e;border-radius:12px;overflow:hidden;\">\n" +
"          <tr>\n" +
"            <td align=\"center\" style=\"padding:32px 32px 16px;\">\n" +
"              <img src=\"" + logoUrl + "\" alt=\"" + app.name + "\" width=\"200\" style=\"display:block;max-width:200px;height:auto;\">\n" +
"            </td>\n" +
"          </tr>\n" +
"          <tr>\n" +
"            <td style=\"padding:8px 32px 0;\">\n" +
"              <h1 style=\"margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;text-align:center;\">Your analysis is ready</h1>\n" +
"              <p style=\"margin:0 0 24px;font-size:15px;line-height:1.6;color:#a0a0a8;text-align:center;\">\n" +
"                Hey " + firstName + ", your <strong style=\"color:#ffffff;\">" + typeLabel + "</strong> analysis has been processed and is ready to view in " + app.name + ".\n" +
"              </p>\n" +
"            </td>\n" +
"          </tr>\n" +
"          <tr>\n" +
"            <td align=\"center\" style=\"padding:0 32px 24px;\">\n" +
"              <a href=\"" + historyUrl + "\" style=\"display:inline-block;background:" + app.color + ";color:" + btnTextColor + ";font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:8px;\">View in " + app.name + "</a>\n" +
"            </td>\n" +
"          </tr>\n" +
"          <tr>\n" +
"            <td style=\"padding:16px 32px 24px;border-top:1px solid #2a2a2e;\">\n" +
"              <p style=\"margin:0;font-size:12px;color:#6b6b73;text-align:center;line-height:1.6;\">\n" +
"                This notification was sent because a queued photo was processed while you were offline.<br>\n" +
"                " + app.name + " is a TradePals, LLC product &middot; <a href=\"https://tradepals.net\" style=\"color:#6b6b73;text-decoration:underline;\">tradepals.net</a>\n" +
"              </p>\n" +
"            </td>\n" +
"          </tr>\n" +
"        </table>\n" +
"      </td>\n" +
"    </tr>\n" +
"  </table>\n" +
"</body>\n" +
"</html>";
}

export async function sendAnalysisReadyEmail(opts) {
  var to = opts.to;
  var appKey = opts.appKey;
  var displayName = opts.displayName;
  var analysisType = opts.analysisType;

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set -- skipping email notification");
    return;
  }

  var app = APP_CONFIG[appKey] || APP_CONFIG.windpal;
  var html = buildAnalysisReadyEmail({ appKey: appKey, displayName: displayName, analysisType: analysisType });

  try {
    var res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_NAME + " <" + FROM_EMAIL + ">",
        to: [to],
        subject: "Your " + app.name + " analysis is ready",
        html: html,
      }),
    });

    if (!res.ok) {
      var err = await res.text();
      console.error("Resend email error:", res.status, err);
    }
  } catch (err) {
    console.error("Email send failed:", err.message);
  }
}
