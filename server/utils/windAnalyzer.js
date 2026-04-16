/**
 * WindPal Photo Analyzer — API Call Handler
 *
 * Wraps the Anthropic API call with:
 * - Correct model selection (always Sonnet for photo diagnosis)
 * - Structured JSON parsing and validation
 * - Retry logic for transient API errors
 * - Usage logging to Supabase ai_usage_log
 * - Consistent error format for route handlers
 *
 * USAGE in route handler:
 *   import { analyzeWindPhoto } from '../utils/windAnalyzer.js';
 *
 *   const { analysis, usage } = await analyzeWindPhoto({
 *     imageBase64: req.files[0].buffer.toString("base64"),
 *     analysisType: req.body.analysis_type,
 *     turbineManufacturer: req.body.turbine_manufacturer,
 *     turbinePlatform: req.body.turbine_platform,
 *     turbineClass: req.body.turbine_class,
 *     componentHeight: req.body.component_height,
 *     symptoms: req.body.symptoms,
 *     userNotes: req.body.user_notes,
 *     userId: req.user.id
 *   });
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { WINDPAL_SYSTEM_PROMPT, buildWindAnalysisMessage } from '../prompts/windAnalysis.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Supabase client for usage logging (public schema, service role)
var supabaseLog = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseLog = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

var APP_NAME = process.env.APP_NAME || 'windpal';

/**
 * Analyzes a wind turbine photograph using Claude Sonnet vision.
 * Handles blades, nacelle, gearbox, generator, tower, electrical,
 * pitch/yaw systems, and fault displays.
 *
 * @param {object} params - See buildWindAnalysisMessage for full param list
 * @returns {Promise<{analysis: object, usage: object, model: string}>}
 * @throws {object} Structured error object — check error.type for handling
 */
export async function analyzeWindPhoto(params) {
  const {
    imageBase64,
    imageMediaType = 'image/jpeg',
    analysisType,
    turbineManufacturer,
    turbinePlatform,
    turbineClass,
    componentHeight,
    symptoms,
    userNotes,
    userId
  } = params;

  if (!imageBase64) {
    throw {
      type: 'validation_error',
      message: 'No image provided',
      userMessage: 'Please attach a photo before submitting.'
    };
  }

  const messages = buildWindAnalysisMessage({
    imageBase64,
    imageMediaType,
    analysisType,
    turbineManufacturer,
    turbinePlatform,
    turbineClass,
    componentHeight,
    symptoms,
    userNotes
  });

  // MODEL: claude-sonnet-4-20250514
  // Photo diagnosis always uses Sonnet — vision quality matters here.
  // temperature: 0.2 — consistent, precise safety-critical diagnosis
  // max_tokens: 1800 — blade defect analysis with multiple defects
  // at different locations, plus fault code interpretation, needs
  // more token budget than simpler single-component analysis

  let response;
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      attempt++;

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        temperature: 0.2,
        // PROMPT CACHING: system prompt cached at Anthropic for 5min window
        // Cache hits cost $0.30/M vs $3.00/M — ~90% reduction on system prompt tokens
        // cache_control: ephemeral is the correct type for this use case
        system: [
          {
            type: 'text',
            text: WINDPAL_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: messages
      });

      break;

    } catch (apiError) {
      const isRetryable = apiError.status === 529 || apiError.status === 500;
      const isLastAttempt = attempt >= maxAttempts;

      if (isRetryable && !isLastAttempt) {
        console.warn(`[WindPal Analyzer] API attempt ${attempt} failed (${apiError.status}). Retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      console.error('[WindPal Analyzer] Anthropic API error:', {
        name: apiError.name,
        status: apiError.status,
        message: apiError.message,
        cause: apiError.cause?.message || apiError.cause,
        error: apiError.error,
        body: apiError.response?.data || apiError.body,
        stringified: String(apiError)
      });

      throw {
        type: 'api_error',
        status: apiError.status || 500,
        message: apiError.message || 'Claude API call failed',
        userMessage: apiError.status === 529
          ? 'Analysis service is temporarily busy. Please try again in a moment.'
          : 'Analysis failed. Please check your connection and try again.',
        isOverloaded: apiError.status === 529,
        isRateLimit: apiError.status === 429
      };
    }
  }

  let analysis;
  const rawText = response.content[0].text.trim();

  try {
    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    analysis = JSON.parse(cleanText);

  } catch (parseError) {
    console.error('[WindPal Analyzer] JSON parse failed:', rawText);
    throw {
      type: 'parse_error',
      message: 'Analysis response could not be processed',
      userMessage: 'The analysis could not be completed. Please try again.',
      raw: rawText
    };
  }

  if (typeof analysis.is_wind_turbine_image === 'undefined') {
    console.error('[WindPal Analyzer] Missing is_wind_turbine_image field:', analysis);
    throw {
      type: 'validation_error',
      message: 'Incomplete analysis returned — missing required fields',
      userMessage: 'The analysis was incomplete. Please try again.'
    };
  }

  // Log usage for cost tracking
  const isSonnet = response.model.includes('sonnet');
  const inputCost = (response.usage.input_tokens / 1_000_000) * (isSonnet ? 3.00 : 0.25);
  const outputCost = (response.usage.output_tokens / 1_000_000) * (isSonnet ? 15.00 : 1.25);
  const totalCost = inputCost + outputCost;

  if (process.env.NODE_ENV === 'development' || process.env.TRADEPAL_MODEL_LOGGING === 'true') {
    console.log(
      `[WindPal Analyzer] ${isSonnet ? 'SONNET' : 'HAIKU'} | ` +
      `in:${response.usage.input_tokens} out:${response.usage.output_tokens} | ` +
      `~$${totalCost.toFixed(5)}`
    );
  }

  // Write to Supabase ai_usage_log (fire-and-forget)
  if (supabaseLog) {
    supabaseLog.from('ai_usage_log').insert({
      app_name: APP_NAME,
      feature: 'photo_diagnosis',
      model: response.model,
      is_sonnet: isSonnet,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      estimated_cost_usd: totalCost,
      user_id: userId || null,
    }).then(function (res) {
      if (res.error) console.error('[WindPal Analyzer] Usage log error:', res.error.message);
    }).catch(function () {});
  }

  return {
    analysis,
    usage: response.usage,
    model: response.model
  };
}
