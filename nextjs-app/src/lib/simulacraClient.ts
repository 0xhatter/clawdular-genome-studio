import type { SimpleIdeaNode as IdeaNode, SimpleSimulacraSnapshot as SimulacraSnapshot } from '@/modules/simulacra/types-simplified';

export interface SimulacraActionMeta {
  createdNodeId?: string;
  offspringNodeId?: string;
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface SnapshotEnvelope {
  ok: true;
  snapshot: SimulacraSnapshot;
  meta?: SimulacraActionMeta | null;
}

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
      return {
        ok: false,
        error: payload?.error || `Request failed (${response.status})`,
      };
    }

    return {
      ok: true,
      data: payload as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown request error',
    };
  }
}

function projectPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/simulacra`;
}

export const simulacraClient = {
  async getSnapshot(projectId: string): Promise<ApiResult<{ snapshot: SimulacraSnapshot }>> {
    const result = await request<{ ok: true; snapshot: SimulacraSnapshot }>(projectPath(projectId));
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        snapshot: result.data.snapshot,
      },
    };
  },

  async action(
    projectId: string,
    payload:
      | { action: 'createIdea'; content: string; parentIds?: string[]; createdBy?: IdeaNode['createdBy'] }
      | { action: 'feed'; nodeId: string; amount?: number }
      | { action: 'tick' }
      | { action: 'discover' }
      | { action: 'pollinate'; parentAId?: string; parentBId?: string }
      | { action: 'agentCycle'; mode?: 'explore' | 'expand' | 'synthesize' | 'full' }
  ): Promise<ApiResult<{ snapshot: SimulacraSnapshot; meta?: SimulacraActionMeta | null }>> {
    const result = await request<SnapshotEnvelope>(`${projectPath(projectId)}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!result.ok) return result;

    return {
      ok: true,
      data: {
        snapshot: result.data.snapshot,
        meta: result.data.meta || null,
      },
    };
  },
};
