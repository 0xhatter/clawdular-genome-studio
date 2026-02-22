import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { generateUUID } from '@/lib/utils';
import { loadRhizomeConfig } from '@/server/rhizome/config';
import { embedText, extractMemoryFacts, summarizeMemoryContext } from '@/server/rhizome/llm-manager';
import type {
  RhizomeEntity,
  RhizomeEpisode,
  RhizomeEventInput,
  RhizomePatchMemory,
  RhizomeQueryResult,
  RhizomeRelation,
} from '@/server/rhizome/types';
import type { RhizomeGraph, RhizomeNode, RhizomeEdge, RhizomeChromosome } from '@/types/rhizome';

interface RhizomePatchMemoryState extends RhizomePatchMemory {
  entityEmbeddings: Record<string, number[]>;
  episodeEmbeddings: Record<string, number[]>;
}

interface RhizomeMemoryState {
  patches: Record<string, RhizomePatchMemoryState>;
}

const MEMORY_DIR = path.join(process.cwd(), '.rhizome');
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.json');

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

function normalizeEntityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadState(): RhizomeMemoryState {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return { patches: {} };
    }
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RhizomeMemoryState;
    return {
      patches: parsed.patches || {},
    };
  } catch {
    return { patches: {} };
  }
}

function saveState(state: RhizomeMemoryState) {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function chromosomeForEntityType(type: RhizomeEntity['type']): RhizomeChromosome {
  if (type === 'module' || type === 'skill') return 'action';
  if (type === 'error') return 'behavior';
  if (type === 'resource') return 'trigger';
  return 'metadata';
}

function chromosomeForEpisode(episode: RhizomeEpisode): RhizomeChromosome {
  if (episode.source === 'runtime') return 'action';
  if (episode.source === 'activity' && episode.status === 'ERROR') return 'behavior';
  if (episode.source === 'activity' && episode.status === 'WARN') return 'behavior';
  if (episode.source === 'markdown') return 'metadata';
  return 'trigger';
}

function trimByLimit<T extends { timestamp?: number; createdAt?: number }>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  const sorted = [...items].sort((a, b) => {
    const timeA = a.timestamp || a.createdAt || 0;
    const timeB = b.timestamp || b.createdAt || 0;
    return timeB - timeA;
  });
  return sorted.slice(0, limit);
}

export class RhizomeMemoryManager {
  private state: RhizomeMemoryState;

  constructor() {
    this.state = loadState();
  }

  private patchState(patchId: string): RhizomePatchMemoryState {
    if (!this.state.patches[patchId]) {
      this.state.patches[patchId] = {
        entities: [],
        relations: [],
        episodes: [],
        entityEmbeddings: {},
        episodeEmbeddings: {},
      };
    }
    return this.state.patches[patchId];
  }

  private async upsertEntity(patchId: string, name: string, type: RhizomeEntity['type'], confidence: number): Promise<RhizomeEntity> {
    const patch = this.patchState(patchId);
    const normalized = normalizeEntityName(name);
    const existing = patch.entities.find((entity) => normalizeEntityName(entity.name) === normalized && entity.type === type);
    if (existing) {
      existing.lastSeenAt = Date.now();
      existing.confidence = Math.min(1, Math.max(existing.confidence, confidence));
      return existing;
    }
    const entity: RhizomeEntity = {
      id: generateUUID(),
      patchId,
      name: name.trim().slice(0, 120),
      type,
      confidence: Math.max(0.1, Math.min(1, confidence)),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    patch.entities.push(entity);
    patch.entityEmbeddings[entity.id] = await embedText(`${entity.type} ${entity.name}`);
    return entity;
  }

  private upsertRelation(
    patchId: string,
    sourceEntityId: string,
    targetEntityId: string,
    type: RhizomeRelation['type'],
    weight: number
  ) {
    const patch = this.patchState(patchId);
    const existing = patch.relations.find(
      (relation) =>
        relation.sourceEntityId === sourceEntityId &&
        relation.targetEntityId === targetEntityId &&
        relation.type === type
    );
    if (existing) {
      existing.lastSeenAt = Date.now();
      existing.weight = Math.min(1, Math.max(existing.weight, weight));
      return existing;
    }
    const relation: RhizomeRelation = {
      id: generateUUID(),
      patchId,
      sourceEntityId,
      targetEntityId,
      type,
      weight: Math.max(0.1, Math.min(1, weight)),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    patch.relations.push(relation);
    return relation;
  }

  async ingestEvents(events: RhizomeEventInput[]): Promise<{ ingested: number }> {
    if (events.length === 0) return { ingested: 0 };
    const config = loadRhizomeConfig();
    for (const event of events) {
      const patch = this.patchState(event.patchId);
      const episode: RhizomeEpisode = {
        id: generateUUID(),
        patchId: event.patchId,
        source: event.source,
        text: event.text.slice(0, 1200),
        timestamp: event.timestamp,
        moduleId: event.moduleId,
        status: event.status,
        entityIds: [],
      };
      patch.episodes.push(episode);
      patch.episodeEmbeddings[episode.id] = await embedText(`${event.source} ${event.text}`);

      const extraction = await extractMemoryFacts(event.text);
      const entityMap = new Map<string, RhizomeEntity>();
      for (const extracted of extraction.entities.slice(0, 12)) {
        const entity = await this.upsertEntity(
          event.patchId,
          extracted.name,
          extracted.type || 'unknown',
          extracted.confidence ?? 0.5
        );
        entityMap.set(normalizeEntityName(extracted.name), entity);
        episode.entityIds?.push(entity.id);
      }

      for (const relation of extraction.relations.slice(0, 20)) {
        const sourceEntity = entityMap.get(normalizeEntityName(relation.source))
          || await this.upsertEntity(event.patchId, relation.source, 'unknown', 0.4);
        const targetEntity = entityMap.get(normalizeEntityName(relation.target))
          || await this.upsertEntity(event.patchId, relation.target, 'unknown', 0.4);
        this.upsertRelation(
          event.patchId,
          sourceEntity.id,
          targetEntity.id,
          relation.type || 'references',
          relation.weight ?? 0.5
        );
      }

      patch.entities = trimByLimit(patch.entities, config.memory.maxEntitiesPerPatch);
      patch.relations = trimByLimit(patch.relations, config.memory.maxRelationsPerPatch);
      patch.episodes = trimByLimit(patch.episodes, config.memory.maxEpisodesPerPatch);
    }

    saveState(this.state);
    return { ingested: events.length };
  }

  getPatchMemory(patchId: string): RhizomePatchMemory {
    const patch = this.patchState(patchId);
    return {
      entities: [...patch.entities],
      relations: [...patch.relations],
      episodes: [...patch.episodes],
    };
  }

  toGraph(patchId: string, limit = 240): RhizomeGraph {
    const patch = this.patchState(patchId);
    const nodes: RhizomeNode[] = [];
    const edges: RhizomeEdge[] = [];
    const now = Date.now();

    const patchNodeId = `patch:${patchId}`;
    nodes.push({
      id: patchNodeId,
      type: 'patch',
      chromosome: 'metadata',
      label: `PATCH ${patchId.slice(0, 8)}`,
      timestamp: now,
      fitness: 0.8,
      generation: 1,
      details: 'rhizome-cortex',
    });

    const topEntities = [...patch.entities]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, Math.floor(limit * 0.45));
    const topEpisodes = [...patch.episodes]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.floor(limit * 0.55));

    for (const entity of topEntities) {
      const nodeId = `entity:${entity.id}`;
      nodes.push({
        id: nodeId,
        type: 'module',
        chromosome: chromosomeForEntityType(entity.type),
        label: entity.name,
        timestamp: entity.lastSeenAt,
        fitness: entity.confidence,
        generation: 1,
        details: entity.type,
      });
      edges.push({
        id: `edge:${patchNodeId}:${nodeId}`,
        source: patchNodeId,
        target: nodeId,
        type: 'referenced',
        weight: 0.45,
        timestamp: entity.lastSeenAt,
        active: true,
      });
    }

    for (const episode of topEpisodes) {
      const nodeId = `episode:${episode.id}`;
      nodes.push({
        id: nodeId,
        type: episode.source === 'runtime' ? 'runtime' : 'activity',
        chromosome: chromosomeForEpisode(episode),
        label: episode.text.slice(0, 36),
        timestamp: episode.timestamp,
        fitness: episode.status === 'ERROR' ? 0.3 : 0.65,
        generation: 1,
        details: episode.source,
      });
      edges.push({
        id: `edge:${patchNodeId}:${nodeId}`,
        source: patchNodeId,
        target: nodeId,
        type: 'caused',
        weight: 0.4,
        timestamp: episode.timestamp,
        active: false,
      });
      for (const entityId of episode.entityIds || []) {
        edges.push({
          id: `edge:${nodeId}:entity:${entityId}`,
          source: nodeId,
          target: `entity:${entityId}`,
          type: 'referenced',
          weight: 0.5,
          timestamp: episode.timestamp,
          active: true,
        });
      }
    }

    for (const relation of patch.relations.slice(0, limit)) {
      edges.push({
        id: `relation:${relation.id}`,
        source: `entity:${relation.sourceEntityId}`,
        target: `entity:${relation.targetEntityId}`,
        type: relation.type === 'causes' ? 'caused' : 'referenced',
        weight: relation.weight,
        timestamp: relation.lastSeenAt,
        active: relation.weight >= 0.55,
      });
    }

    const filteredEdges = edges.filter(
      (edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target)
    );

    const densities: Record<RhizomeChromosome, number> = {
      trigger: 0,
      action: 0,
      behavior: 0,
      metadata: 0,
    };
    for (const chromosome of Object.keys(densities) as RhizomeChromosome[]) {
      const laneNodes = nodes.filter((node) => node.chromosome === chromosome && node.type !== 'patch');
      densities[chromosome] = laneNodes.length
        ? laneNodes.reduce((sum, node) => sum + node.fitness, 0) / laneNodes.length
        : 0;
    }

    return {
      patchId,
      nodes,
      edges: filteredEdges,
      lastUpdated: now,
      expressionDensity: densities,
    };
  }

  async query(patchId: string, queryText: string, limit = 8): Promise<RhizomeQueryResult> {
    const patch = this.patchState(patchId);
    const queryEmbedding = await embedText(queryText);

    const scoredEntities = patch.entities
      .map((entity) => ({
        entity,
        score: cosineSimilarity(queryEmbedding, patch.entityEmbeddings[entity.id] || []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const pickedEntityIds = new Set(scoredEntities.map((entry) => entry.entity.id));
    const relatedEpisodes = patch.episodes
      .filter((episode) => (episode.entityIds || []).some((entityId) => pickedEntityIds.has(entityId)))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);

    const summarySeed = relatedEpisodes.map((episode) => `${episode.source.toUpperCase()}: ${episode.text}`).join('\n');
    const summary = await summarizeMemoryContext(
      summarySeed || `No strong matches found for "${queryText}".`
    );

    return {
      summary,
      graph: this.toGraph(patchId, 160),
      relatedEpisodes,
    };
  }
}

declare global {
  var __rhizomeMemoryManager__: RhizomeMemoryManager | undefined;
}

export function getRhizomeMemoryManager(): RhizomeMemoryManager {
  if (!global.__rhizomeMemoryManager__) {
    global.__rhizomeMemoryManager__ = new RhizomeMemoryManager();
  }
  return global.__rhizomeMemoryManager__;
}
