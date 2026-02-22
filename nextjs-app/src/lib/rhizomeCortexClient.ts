import type { Module } from '@/types';
import type { RhizomeEventInput } from '@/server/rhizome/types';
import type { RhizomeGraph } from '@/types/rhizome';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      return { ok: false, error: payload?.error || `Request failed (${response.status})` };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown request error',
    };
  }
}

export const rhizomeCortexClient = {
  health() {
    return request<{ ok: true; service: string; timestamp: number }>('/api/rhizome/health');
  },

  ingest(patchId: string, events: RhizomeEventInput[]) {
    return request<{ ok: true; ingested: number; patchId: string }>('/api/rhizome/ingest', {
      method: 'POST',
      body: JSON.stringify({ patchId, events }),
    });
  },

  query(patchId: string, query: string, limit = 8) {
    return request<{ ok: true; summary: string }>('/api/rhizome/query', {
      method: 'POST',
      body: JSON.stringify({ patchId, query, limit }),
    });
  },

  graph(patchId: string) {
    return request<{ ok: true; graph: RhizomeGraph }>(`/api/rhizome/graph?patchId=${encodeURIComponent(patchId)}`);
  },

  migrateMarkdown(patchId: string, markdown: string, modules: Module[]) {
    return request<{ ok: true; ingested: number }>('/api/rhizome/migrate-markdown', {
      method: 'POST',
      body: JSON.stringify({ patchId, markdown, modules, ingest: true }),
    });
  },
};
