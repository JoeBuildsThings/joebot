import models from '../config/models.js';
import personality from './personality.js';
import * as profileMemory from './profileMemory.js';

import * as gemini from './providers/gemini.js';
import * as groq from './providers/groq.js';
import * as openrouter from './providers/openrouter.js';

const providers = {gemini, groq, openrouter};

function shouldFallback(error) {
  const temporaryStatuses = [408, 409, 425, 429, 500, 502, 503, 504];

  if (temporaryStatuses.includes(error?.status)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();

  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('temporarily') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('empty response')
  );
}

function buildMemoryBlock() {
  const memories = profileMemory.getMemories();

  if (!memories.length) {
    return '';
  }

  const list = memories.map(item => `- ${item}`).join('\n');

  return `PERSONAL MEMORY\n${list}`;
}

function buildSystemPrompt(systemAddition = '') {
  const parts = [personality, buildMemoryBlock(), systemAddition];
  return parts.filter(Boolean).join('\n\n');
}

function assertValidProviderResult(result, providerName) {
  if (!result) {
    throw new Error(`Provider contract violation: ${providerName}.generate() returned no result`);
  }

  const hasToolCalls = Array.isArray(result.toolCalls) && result.toolCalls.length > 0;
  const hasReply = typeof result.reply === 'string' && result.reply.trim() !== '';

  if (!hasReply && !hasToolCalls) {
    throw new Error(
      `Provider contract violation: ${providerName}.generate() returned neither a reply nor tool calls`
    );
  }
}

export async function generate({
  messages = [],
  debug = false,
  systemAddition = '',
  tools = [],
  toolChoice = 'auto'
}) {
  const systemPrompt = buildSystemPrompt(systemAddition);

  const finalMessages = [{role: 'system', content: systemPrompt}, ...messages];

  let lastError = null;

  for (const candidate of models.all) {
    const provider = providers[candidate.provider];

    if (!provider) {
      continue;
    }

    try {
      if (debug) {
        console.log(`[JOEBOT DEBUG] Trying ${candidate.provider}/${candidate.model}`);
      }

      const result = await provider.generate({
        model: candidate.model,
        messages: finalMessages,
        tools,
        toolChoice
      });

      assertValidProviderResult(result, candidate.provider);

      return {
        reply: result.reply || '',
        toolCalls: result.toolCalls || [],
        raw: result.raw || null,
        provider: candidate.provider,
        model: candidate.model
      };
    } catch (error) {
      lastError = error;

      if (debug) {
        console.log(`[JOEBOT DEBUG] ${candidate.provider}/${candidate.model} failed: ${error.message}`);
      }

      if (!shouldFallback(error)) {
        throw error;
      }
    }
  }

  const error = new Error(lastError?.message || 'All JOEBOT providers failed');
  error.code = 'ALL_PROVIDERS_FAILED';
  throw error;
}
