/**
 * Content Guard — pre-screens uploaded images before analysis.
 *
 * Rejects:
 * - NSFW / explicit / inappropriate content
 * - Images unrelated to the app's domain
 *
 * Uses Claude Haiku for fast, cheap classification.
 * Call this AFTER multer but BEFORE storage upload.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DOMAIN_DESCRIPTIONS = {
  splicepal:
    "fiber optic splicing, OTDR traces, fusion splicer screens, fiber connectors, cable infrastructure, or telecom equipment",
  weldpal:
    "welding work, weld beads, weld joints, welding equipment, metal fabrication, or weld inspection",
  poolpal:
    "swimming pools, pool equipment, water chemistry, pool plumbing, spa systems, or pool service work",
  voltpal:
    "electrical panels, wiring, circuits, conduit, electrical equipment, motors, switchgear, or electrical installations",
  pipepal:
    "plumbing, pipes, fittings, valves, water heaters, drains, gas piping, or plumbing fixtures",
  windpal:
    "wind turbines, turbine blades, nacelles, towers, gearboxes, wind farm components, or turbine inspection",
  liftpal:
    "elevators, escalators, hoistways, elevator controllers, elevator machine rooms, guide rails, or lift equipment",
};

/**
 * Screen an image buffer for appropriateness and domain relevance.
 *
 * @param {Buffer} imageBuffer - raw image bytes
 * @param {string} mimeType - e.g. "image/jpeg"
 * @param {string} appKey - e.g. "splicepal"
 * @returns {{ allowed: boolean, reason?: string }}
 */
export async function screenImage(imageBuffer, mimeType, appKey) {
  const domain = DOMAIN_DESCRIPTIONS[appKey] || "skilled trade work";

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: `You are a content moderator. Classify this image in two dimensions:

1. APPROPRIATE: Is this image free of nudity, explicit content, violence, or other inappropriate material? (yes/no)
2. DOMAIN: Could this image plausibly relate to ${domain}? (yes/no)

Respond with ONLY a JSON object, no other text:
{"appropriate": true/false, "domain": true/false, "reason": "brief explanation if either is false"}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      // If we can't parse the response, allow the image (fail open)
      console.warn("[Content Guard] Could not parse response, allowing image");
      return { allowed: true };
    }

    const result = JSON.parse(match[0]);

    if (result.appropriate === false) {
      return {
        allowed: false,
        reason:
          "This image contains inappropriate content and cannot be analyzed.",
      };
    }

    if (result.domain === false) {
      return {
        allowed: false,
        reason: `This image does not appear to be related to ${domain.split(",")[0]}. Please upload a relevant photo.`,
      };
    }

    return { allowed: true };
  } catch (err) {
    // Fail open on API errors — don't block users if moderation is down
    console.error("[Content Guard] Screening error:", err.message);
    return { allowed: true };
  }
}
