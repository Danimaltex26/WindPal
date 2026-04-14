/**
 * TradePals Claude Client
 *
 * Single entry point for all Claude API calls.
 * Handles model selection via modelRouter, retries, and error formatting.
 *
 * Never call Anthropic directly from route handlers — use this client.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getModelConfig, MODELS } from './modelRouter.js';

const anthropic = new Anthropic();

/**
 * @param {object} options
 * @param {string} options.feature - Feature key for model routing
 * @param {object} options.context - Context for auto-classification (troubleshoot)
 * @param {string} options.systemPrompt - System prompt
 * @param {Array}  options.messages - [{role, content}]
 * @param {number} options.maxTokensOverride - Override default max_tokens
 * @returns {Promise<{content: string, model: string, usage: object, feature: string}>}
 */
export async function callClaude(options) {
  var { feature, context, systemPrompt, messages, maxTokensOverride } = options;
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
        system: systemPrompt,
        messages: messages,
      });

      logUsage(feature, config.model, response.usage);

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

function logUsage(feature, model, usage) {
  var shouldLog = process.env.NODE_ENV === 'development' ||
                  process.env.TRADEPAL_MODEL_LOGGING === 'true';
  if (!shouldLog) return;

  var isSonnet = model.includes('sonnet');
  var label = isSonnet ? 'SONNET' : 'HAIKU';
  var inputCost = (usage.input_tokens / 1000000) * (isSonnet ? 3.0 : 0.25);
  var outputCost = (usage.output_tokens / 1000000) * (isSonnet ? 15.0 : 1.25);
  var total = inputCost + outputCost;

  console.log(
    '[ClaudeClient] ' + feature + ' | ' + label +
    ' | in:' + usage.input_tokens + ' out:' + usage.output_tokens +
    ' | ~$' + total.toFixed(5)
  );
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
