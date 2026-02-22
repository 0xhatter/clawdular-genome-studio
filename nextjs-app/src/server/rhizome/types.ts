import type { ActivityEvent, Module } from '@/types';
import type { RhizomeGraph } from '@/types/rhizome';

export type RhizomeTask = 'extract' | 'summarize' | 'embed';

export interface ProviderConfig {
  type: 'openai';
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  kind?: 'chat' | 'embedding';
}

export interface RhizomeConfig {
  providers: Record<string, ProviderConfig>;
  models: Record<string, ModelConfig>;
  memory: {
    maxEntitiesPerPatch: number;
    maxRelationsPerPatch: number;
    maxEpisodesPerPatch: number;
  };
}

export interface RhizomeRoutingConfig {
  tasks: Record<RhizomeTask, { chain: string[] }>;
  retry: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface RhizomeEventInput {
  patchId: string;
  source: 'runtime' | 'activity' | 'markdown';
  text: string;
  timestamp: number;
  moduleId?: string;
  status?: ActivityEvent['status'];
}

export interface RhizomeEntity {
  id: string;
  patchId: string;
  name: string;
  type: 'module' | 'skill' | 'resource' | 'error' | 'concept' | 'unknown';
  confidence: number;
  createdAt: number;
  lastSeenAt: number;
}

export interface RhizomeRelation {
  id: string;
  patchId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: 'uses' | 'causes' | 'depends_on' | 'blocked_by' | 'references';
  weight: number;
  createdAt: number;
  lastSeenAt: number;
}

export interface RhizomeEpisode {
  id: string;
  patchId: string;
  source: RhizomeEventInput['source'];
  text: string;
  timestamp: number;
  moduleId?: string;
  status?: ActivityEvent['status'];
  entityIds?: string[];
}

export interface RhizomePatchMemory {
  entities: RhizomeEntity[];
  relations: RhizomeRelation[];
  episodes: RhizomeEpisode[];
}

export interface ExtractionResult {
  entities: Array<{ name: string; type?: RhizomeEntity['type']; confidence?: number }>;
  relations: Array<{ source: string; target: string; type?: RhizomeRelation['type']; weight?: number }>;
  summary?: string;
}

export interface RhizomeQueryResult {
  summary: string;
  graph: RhizomeGraph;
  relatedEpisodes: RhizomeEpisode[];
}

export interface RhizomeMigrateMarkdownPayload {
  patchId: string;
  markdown: string;
  modules?: Module[];
}
