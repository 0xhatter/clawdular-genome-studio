import 'server-only';

import { loadRhizomeConfig, loadRhizomeRouting } from '@/server/rhizome/config';
import type { RhizomeTask } from '@/server/rhizome/types';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getModelChainForTask(task: RhizomeTask): string[] {
  const config = loadRhizomeConfig();
  const routing = loadRhizomeRouting();
  const chain = routing.tasks[task]?.chain || [];
  return chain.filter((modelId) => Boolean(config.models[modelId]));
}

export function isRetriableStatus(status?: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || (status !== undefined && status >= 500);
}

export function shouldRetry(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return isRetriableStatus((error as { status: number }).status);
  }
  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    const message = (error as { message: string }).message.toLowerCase();
    return message.includes('timeout') || message.includes('network') || message.includes('temporarily');
  }
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const routing = loadRhizomeRouting();
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= routing.retry.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === routing.retry.maxRetries) {
        throw error;
      }
      attempt += 1;
      await wait(routing.retry.backoffMs * attempt);
    }
  }
  throw lastError;
}
