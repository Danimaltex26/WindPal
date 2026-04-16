/**
 * TradePals Claude Client
 *
 * Single entry point for all Claude API calls.
 * Handles model selection via modelRouter, retries, error formatting,
 * and usage logging to Supabase for cost tracking.
 *
 * Never call Anthropic directly from route handlers — use this client.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { getModelConfig, MODELS } from './modelRouter.js';

const anthropic = new Anthropic();

// Supabase client for usage logging (public schema, service role)
var supabaseLog = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseLog = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// App name — set via APP_NAME env var, or derived from service name in health check
var APP_NAME = process.env.APP_NAME || 'unknown';

/**
 * @param {object} options
 * @param {string} options.feature - Feature key for model routing
 * @param {object} options.context - Context for auto-classification (troubleshoot)
 * @param {string} options.systemPrompt - System prompt
 * @param {Array}  options.messages - [{role, content}]
 * @param {number} options.maxTokensOverride - Override default max_tokens
 * @param {string} options.userId - Optional user ID for usage tracking
 * @returns {Promise<{content: string, model: string, usage: object, feature: string}>}
 */
export async function callClaude(options) {
  var { feature, context, systemPrompt, messages, maxTokensOverride, userId } = options;
  if (!context) context = {};

  var config = getModelConfig(feature, context);
  if (maxTokensOverride) config.max_tokens = maxTokensOverride;

  var attempt = 0;
  var maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      attempt++;

      var response = await anthropic.messages.create({
        model: config.model,
        max_tokens: config.max_tokens,
        // PROMPT CACHING: all system prompts cached via claudeClient
        // Applies to troubleshoot, reference, and any other callClaude() feature
        // Cache window: 5 minutes — resets on each cache hit
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: messages,
      });

      logUsage(feature, config.model, response.usage, userId);

      return {
        content: response.content[0].text,
        model: config.model,
        usage: response.usage,
        feature: feature,
      };

    } catch (error) {
      var isRetryable = error.status === 529 || error.status === 500;
      var isLastAttempt = attempt >= maxAttempts;

      if (isRetryable && !isLastAttempt) {
        console.warn(
          '[ClaudeClient] ' + feature + ' attempt ' + attempt +
          ' failed (' + error.status + '). Retrying in 2s...'
        );
        await new Promise(function (resolve) { setTimeout(resolve, 2000); });
        continue;
      }

      throw formatClaudeError(error, feature, config.model);
    }
  }
}

function logUsage(feature, model, usage, userId) {
  var isSonnet = model.includes('sonnet');
  var label = isSonnet ? 'SONNET' : 'HAIKU';
  var inputCost = (usage.input_tokens / 1000000) * (isSonnet ? 3.0 : 0.25);
  var outputCost = (usage.output_tokens / 1000000) * (isSonnet ? 15.0 : 1.25);
  var total = inputCost + outputCost;

  // Console log in dev
  var shouldLog = process.env.NODE_ENV === 'development' ||
                  process.env.TRADEPAL_MODEL_LOGGING === 'true';
  if (shouldLog) {
    console.log(
      '[ClaudeClient] ' + feature + ' | ' + label +
      ' | in:' + usage.input_tokens + ' out:' + usage.output_tokens +
      ' | ~$' + total.toFixed(5)
    );
  }

  // Write to Supabase usage log (fire-and-forget)
  if (supabaseLog) {
    supabaseLog.from('ai_usage_log').insert({
      app_name: APP_NAME,
      feature: feature,
      model: model,
      is_sonnet: isSonnet,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: total,
      user_id: userId || null,
    }).then(function (res) {
      if (res.error) console.error('[ClaudeClient] Usage log error:', res.error.message);
    }).catch(function () {});
  }
}

function formatClaudeError(error, feature, model) {
  var err = new Error(error.message || 'Claude API call failed');
  err.type = 'claude_error';
  err.feature = feature;
  err.model = model;
  err.status = error.status || 500;
  err.isOverloaded = error.status === 529;
  err.isAuthError = error.status === 401;
  err.isRateLimit = error.status === 429;
  return err;
}
