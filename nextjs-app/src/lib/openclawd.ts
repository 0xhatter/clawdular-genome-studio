import type {
  FitnessScore,
  Genome,
  Module,
  Patch,
  SkillDefinition,
} from '@/types';

type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status?: number };

interface ExecutePatchResponse {
  patch?: Partial<Patch>;
  fitness?: FitnessScore;
  moduleStates?: Record<string, Module['state']>;
}

interface EvolvePatchResponse {
  generation?: number;
  fitness?: FitnessScore;
  changes?: Array<{ chromosome?: string; from?: string; to?: string; operation?: string }>;
}

interface MutateGenomeResponse {
  genome?: Genome;
  fitness?: FitnessScore;
}

interface BreedGenomesResponse {
  genome?: Genome;
}

export interface RuntimeModuleEvent {
  patchId?: string;
  moduleId: string;
  executionState?: Module['executionState'];
  triggerActive?: boolean;
  lastExecutionSuccess?: boolean;
}

function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_OPENCLAWD_BASE_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : '';
}

function makeUrl(path: string): string {
  const base = getBaseUrl();
  return base ? `${base}${path}` : path;
}

function getRuntimeEventsPath(): string {
  return process.env.NEXT_PUBLIC_OPENCLAWD_EVENTS_PATH?.trim() || '/api/runtime/events';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unexpected OpenClawd integration error';
}

function hasRequiredSkillFields(value: unknown): value is Partial<SkillDefinition> {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Record<string, unknown>;
  return typeof maybe.id === 'string' && typeof maybe.name === 'string';
}

function normalizeSkill(skill: Partial<SkillDefinition>): SkillDefinition {
  const category =
    skill.category === 'input' ||
    skill.category === 'process' ||
    skill.category === 'output' ||
    skill.category === 'logic' ||
    skill.category === 'utility'
      ? skill.category
      : 'utility';

  return {
    id: String(skill.id || ''),
    name: String(skill.name || ''),
    version: String(skill.version || '1.0.0'),
    category,
    chromosomes: {
      trigger: skill.chromosomes?.trigger || { patterns: [], filters: [] },
      action: skill.chromosomes?.action || { operations: [] },
      behavior:
        skill.chromosomes?.behavior || {
          rateLimit: { max: 100, window: '1m' },
          retryPolicy: { maxRetries: 3, backoff: 'exponential' },
        },
    },
    inputs: Array.isArray(skill.inputs) ? skill.inputs : [],
    outputs: Array.isArray(skill.outputs) ? skill.outputs : [],
    parameters: Array.isArray(skill.parameters) ? skill.parameters : [],
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(makeUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    let payload: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || `Request failed (${response.status})`)
          : `Request failed (${response.status})`;
      return { ok: false, error: message, status: response.status };
    }

    return { ok: true, data: payload as T, status: response.status };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export const openclawdClient = {
  async listSkills(): Promise<ApiResult<SkillDefinition[]>> {
    const result = await request<unknown>('/api/registry/skills');
    if (!result.ok) return result;

    if (!Array.isArray(result.data)) {
      return { ok: false, error: 'Invalid skills response shape', status: result.status };
    }

    const skills = result.data.filter(hasRequiredSkillFields).map((skill) => normalizeSkill(skill));
    return { ok: true, data: skills, status: result.status };
  },

  executePatch(patch: Patch): Promise<ApiResult<ExecutePatchResponse>> {
    return request<ExecutePatchResponse>(`/api/patches/${patch.id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ patch }),
    });
  },

  stopPatch(patchId: string): Promise<ApiResult<{ stopped: boolean }>> {
    return request<{ stopped: boolean }>(`/api/patches/${patchId}/stop`, {
      method: 'POST',
    });
  },

  evolvePatch(payload: { patchId: string; strategy: string; patch: Patch }): Promise<ApiResult<EvolvePatchResponse>> {
    return request<EvolvePatchResponse>('/api/evolution/evolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  mutateGenome(payload: {
    patchId: string;
    moduleId: string;
    genome: Genome;
    type: string;
    intensity: number;
  }): Promise<ApiResult<MutateGenomeResponse>> {
    return request<MutateGenomeResponse>('/api/genomes/mutate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  breedGenomes(payload: {
    patchId: string;
    moduleAId: string;
    moduleBId: string;
    genomeA: Genome;
    genomeB: Genome;
  }): Promise<ApiResult<BreedGenomesResponse>> {
    return request<BreedGenomesResponse>('/api/genomes/breed', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  subscribeRuntimeEvents(onEvent: (event: RuntimeModuleEvent) => void): () => void {
    const handlers = new Set<() => void>();

    const handleEvent = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const event = payload as Partial<RuntimeModuleEvent>;
      if (typeof event.moduleId !== 'string') return;
      onEvent({
        patchId: typeof event.patchId === 'string' ? event.patchId : undefined,
        moduleId: event.moduleId,
        executionState: event.executionState,
        triggerActive: event.triggerActive,
        lastExecutionSuccess: event.lastExecutionSuccess,
      });
    };

    if (typeof window !== 'undefined') {
      const customEventHandler = (evt: Event) => {
        const event = evt as CustomEvent<RuntimeModuleEvent | RuntimeModuleEvent[]>;
        if (Array.isArray(event.detail)) {
          event.detail.forEach(handleEvent);
          return;
        }
        handleEvent(event.detail);
      };
      window.addEventListener('openclaw-runtime', customEventHandler as EventListener);
      handlers.add(() => window.removeEventListener('openclaw-runtime', customEventHandler as EventListener));
    }

    if (typeof EventSource !== 'undefined') {
      try {
        const source = new EventSource(makeUrl(getRuntimeEventsPath()));
        source.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data) as RuntimeModuleEvent | RuntimeModuleEvent[];
            if (Array.isArray(parsed)) {
              parsed.forEach(handleEvent);
              return;
            }
            handleEvent(parsed);
          } catch {
            // Ignore malformed event payloads.
          }
        };
        handlers.add(() => source.close());
      } catch {
        // Ignore event stream setup failure and keep custom event channel active.
      }
    }

    return () => {
      handlers.forEach((cleanup) => cleanup());
      handlers.clear();
    };
  },
};
