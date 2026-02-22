import 'server-only';

import { loadRhizomeConfig } from '@/server/rhizome/config';
import { getModelChainForTask, withRetry } from '@/server/rhizome/routing';
import type { ExtractionResult, RhizomeTask } from '@/server/rhizome/types';

class RhizomeLlmError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RhizomeLlmError';
    this.status = status;
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(stripCodeFence(text)) as T;
  } catch {
    return fallback;
  }
}

function localEmbedding(text: string, dims = 64): number[] {
  const vector = new Array<number>(dims).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  for (const token of normalized.split(/\s+/).filter(Boolean)) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    vector[hash % dims] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

async function openAiRequest<T>(baseUrl: string, apiKey: string, path: string, payload: object, timeoutMs: number): Promise<T> {
  if (!apiKey) {
    throw new RhizomeLlmError('Provider API key missing');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new RhizomeLlmError(`LLM request failed (${response.status}): ${message}`, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof RhizomeLlmError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown LLM transport error';
    throw new RhizomeLlmError(message);
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackExtract(text: string): ExtractionResult {
  const words = text
    .replace(/[^a-zA-Z0-9\s:_-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 16);
  const uniqueWords = Array.from(new Set(words));
  const entities = uniqueWords.slice(0, 6).map((name) => ({
    name,
    type: 'concept' as const,
    confidence: 0.42,
  }));
  const relations = entities.slice(1).map((entity, index) => ({
    source: entities[index].name,
    target: entity.name,
    type: 'references' as const,
    weight: 0.35,
  }));
  return {
    entities,
    relations,
    summary: text.slice(0, 180),
  };
}

async function callModel(task: RhizomeTask, input: string): Promise<{ text?: string; embedding?: number[] }> {
  const config = loadRhizomeConfig();
  const chain = getModelChainForTask(task);
  for (const modelId of chain) {
    const model = config.models[modelId];
    const provider = config.providers[model.provider];
    if (!model || !provider) continue;
    if (provider.type !== 'openai') continue;

    try {
      if (task === 'embed' || model.kind === 'embedding') {
        const payload = {
          model: model.model,
          input,
        };
        const result = await withRetry(() =>
          openAiRequest<{ data?: Array<{ embedding?: number[] }> }>(
            provider.baseUrl,
            provider.apiKey,
            '/embeddings',
            payload,
            provider.timeoutMs
          )
        );
        const embedding = result.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) {
          return { embedding };
        }
      } else {
        const payload = {
          model: model.model,
          temperature: model.temperature ?? 0.2,
          max_tokens: model.maxTokens ?? 600,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                task === 'extract'
                  ? 'Extract entities and relations from workflow memory. Return JSON with keys entities, relations, summary.'
                  : 'Summarize memory context. Return JSON with key summary.',
            },
            {
              role: 'user',
              content: input,
            },
          ],
        };
        const result = await withRetry(() =>
          openAiRequest<{ choices?: Array<{ message?: { content?: string } }> }>(
            provider.baseUrl,
            provider.apiKey,
            '/chat/completions',
            payload,
            provider.timeoutMs
          )
        );
        const textResponse = result.choices?.[0]?.message?.content;
        if (textResponse) {
          return { text: textResponse };
        }
      }
    } catch {
      continue;
    }
  }
  return {};
}

export async function extractMemoryFacts(text: string): Promise<ExtractionResult> {
  const result = await callModel('extract', text);
  if (!result.text) return fallbackExtract(text);
  const parsed = safeJsonParse<ExtractionResult>(result.text, fallbackExtract(text));
  return {
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : text.slice(0, 180),
  };
}

export async function summarizeMemoryContext(text: string): Promise<string> {
  const result = await callModel('summarize', text);
  if (!result.text) return text.slice(0, 220);
  const parsed = safeJsonParse<{ summary?: string }>(result.text, { summary: text.slice(0, 220) });
  return parsed.summary || text.slice(0, 220);
}

export async function embedText(text: string): Promise<number[]> {
  const result = await callModel('embed', text);
  if (result.embedding?.length) return result.embedding;
  return localEmbedding(text);
}
