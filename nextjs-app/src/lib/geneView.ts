import type { Genome, Module, Mutation, Patch } from '@/types';
import type {
  ExpressionState,
  GenePart,
  GeneStage,
  GeneViewModel,
  LineageEdge,
  MutationImpact,
  MutationType,
} from '@/types/geneView';
import { clamp } from '@/lib/utils';

function getModuleFitness(module: Module): number {
  const candidate = module.fitness ?? module.genome?.fitness?.overall ?? 50;
  return clamp(candidate, 0, 100);
}

function getMutationCount(module: Module): number {
  return module.mutationCount ?? module.genome?.mutations?.length ?? 0;
}

export function deriveGeneStage(module: Module, history: Patch[]): GeneStage {
  const gen = module.generation || 1;
  const fitness = getModuleFitness(module) / 100;
  const localMutations = getMutationCount(module);
  const historyMutations = history.reduce((total, patch) => {
    const match = patch.modules.find((candidate) => candidate.id === module.id);
    return total + (match ? getMutationCount(match) : 0);
  }, 0);
  const mutations = Math.max(localMutations, historyMutations);

  if (gen === 1 && mutations === 0) return 'seed';
  if (gen <= 3 && fitness < 0.3) return 'sprout';
  if (mutations > 0 && fitness < 0.6) return 'juvenile';
  if (fitness >= 0.8 && mutations < 10) return 'mature';
  if (fitness >= 0.8 && mutations >= 10) return 'adaptive';
  if (fitness < 0.3 && gen > 5) return 'senescent';

  return 'juvenile';
}

export function deriveExpressionState(module: Module, openclawState?: string): ExpressionState {
  const runtimeState = openclawState || module.executionState || module.state;
  if (runtimeState === 'mutating' || runtimeState === 'evolving') return 'mutating';
  if (runtimeState === 'error') return 'stressed';
  if (runtimeState === 'running') return 'transcribing';
  if (module.lastExecutionSuccess) return 'translated';
  if (module.triggerActive) return 'primed';
  return 'silent';
}

function safeRange(start: number, end: number): { start: number; end: number } {
  const clampedStart = clamp(start, 0, 1);
  const clampedEnd = clamp(end, clampedStart + 0.01, 1);
  return { start: clampedStart, end: clampedEnd };
}

export function buildGeneParts(genome: Genome): GenePart[] {
  const parts: GenePart[] = [];
  const triggerPatterns = genome.chromosomes.trigger?.patterns || [];
  const triggerFilters = genome.chromosomes.trigger?.filters || [];
  const actions = genome.chromosomes.action?.operations || [];
  const retries = genome.chromosomes.behavior?.retryPolicy?.maxRetries || 0;
  const rateLimit = genome.chromosomes.behavior?.rateLimit?.max || 0;
  const tags = genome.chromosomes.metadata?.tags || [];

  const promoterIntensity = clamp((triggerPatterns.length || 1) / 5, 0.2, 1);
  parts.push({
    id: 'promoter',
    type: 'promoter',
    ...safeRange(0, 0.12),
    intensity: promoterIntensity,
    metadata: { patterns: triggerPatterns },
  });

  parts.push({
    id: 'utr5',
    type: 'utr5',
    ...safeRange(0.12, 0.2),
    intensity: clamp((triggerFilters.length || 1) / 4, 0.15, 1),
    metadata: { filters: triggerFilters },
  });

  const exonCount = Math.max(actions.length, 1);
  const codingSpanStart = 0.2;
  const codingSpanEnd = 0.8;
  const laneSize = (codingSpanEnd - codingSpanStart) / exonCount;

  for (let i = 0; i < exonCount; i += 1) {
    const operation = actions[i];
    const exonStart = codingSpanStart + i * laneSize;
    const exonEnd = exonStart + laneSize * 0.72;
    parts.push({
      id: `exon-${i}`,
      type: 'exon',
      ...safeRange(exonStart, exonEnd),
      intensity: clamp(0.45 + (operation ? 0.3 : 0), 0, 1),
      metadata: { operation },
    });
    const intronEnd = exonStart + laneSize;
    if (intronEnd - exonEnd > 0.01) {
      parts.push({
        id: `intron-${i}`,
        type: 'intron',
        ...safeRange(exonEnd, intronEnd),
        intensity: clamp((i + 1) / (exonCount * 2), 0.1, 0.6),
      });
    }
  }

  parts.push({
    id: 'utr3',
    type: 'utr3',
    ...safeRange(0.8, 0.9),
    intensity: clamp((tags.length || 1) / 6, 0.15, 1),
    metadata: { tags },
  });

  parts.push({
    id: 'regulator',
    type: 'regulator',
    ...safeRange(0.9, 0.97),
    intensity: clamp((retries + rateLimit / 100) / 8, 0.2, 1),
    metadata: {
      retryPolicy: genome.chromosomes.behavior?.retryPolicy,
      rateLimit: genome.chromosomes.behavior?.rateLimit,
    },
  });

  parts.push({
    id: 'mark',
    type: 'mark',
    ...safeRange(0.97, 1),
    intensity: clamp(genome.mutations.length / 20, 0.1, 1),
    metadata: { mutations: genome.mutations.length },
  });

  return parts;
}

export function buildLineage(module: Module): LineageEdge | undefined {
  if (!module.parentIds?.length) return undefined;
  const lastMutation = module.genome.mutations[module.genome.mutations.length - 1];
  const mutationType = (lastMutation?.type || 'cloned') as MutationType;
  return {
    childId: module.id,
    parentIds: module.parentIds,
    crossoverPoints: module.crossoverPoints,
    spliceSeam: module.spliceSeam,
    timestamp: lastMutation?.timestamp || Date.now(),
    mutationType,
  };
}

export function buildGeneViewModel(module: Module, history: Patch[], openclawState?: string): GeneViewModel {
  const fitness = getModuleFitness(module);
  return {
    stage: deriveGeneStage(module, history),
    expressionState: deriveExpressionState(module, openclawState),
    parts: buildGeneParts(module.genome),
    lineage: buildLineage(module),
    mutationLoad: clamp(getMutationCount(module) / 20, 0, 1),
    fitness,
    generation: module.generation || 1,
    moduleId: module.id,
  };
}

function mutationTypeOf(model: GeneViewModel): MutationType {
  return model.lineage?.mutationType || 'behavioral';
}

function mutationSeverity(changedCount: number, avgDelta: number): 'minor' | 'moderate' | 'major' {
  if (changedCount >= 4 || avgDelta > 0.35) return 'major';
  if (changedCount >= 2 || avgDelta > 0.15) return 'moderate';
  return 'minor';
}

export function deriveMutationImpact(parentGenes: GeneViewModel[], childGene: GeneViewModel): MutationImpact {
  const parentById = new Map<string, GenePart>();
  parentGenes.forEach((gene) => {
    gene.parts.forEach((part) => {
      if (!parentById.has(part.id)) {
        parentById.set(part.id, part);
      }
    });
  });

  const changedParts: string[] = [];
  let deltaSum = 0;
  childGene.parts.forEach((part) => {
    const parent = parentById.get(part.id);
    const delta = parent ? Math.abs(part.intensity - parent.intensity) : part.intensity;
    if (delta >= 0.12 || !parent) {
      changedParts.push(part.id);
      deltaSum += delta;
    }
  });

  const avgDelta = changedParts.length > 0 ? deltaSum / changedParts.length : 0;
  return {
    changedParts,
    confidence: clamp(0.55 + childGene.mutationLoad * 0.35 + avgDelta * 0.25, 0, 1),
    severity: mutationSeverity(changedParts.length, avgDelta),
    type: mutationTypeOf(childGene),
  };
}

export function getPartColor(partType: GenePart['type'], expressionState: ExpressionState): string {
  switch (partType) {
    case 'promoter':
      return expressionState === 'primed' ? '#67e8f9' : '#22d3ee';
    case 'utr5':
      return '#94a3b8';
    case 'exon':
      return expressionState === 'transcribing' ? '#f8fafc' : '#cbd5e1';
    case 'intron':
      return '#475569';
    case 'utr3':
      return '#a5f3fc';
    case 'regulator':
      return expressionState === 'mutating' ? '#f59e0b' : '#38bdf8';
    case 'mark':
      return expressionState === 'stressed' ? '#ef4444' : '#64748b';
    default:
      return '#94a3b8';
  }
}

export function getMutationTypeFromHistory(mutations: Mutation[]): MutationType {
  const last = mutations[mutations.length - 1]?.type;
  const supported: MutationType[] = ['parameter', 'behavioral', 'structural', 'spliced', 'bred', 'cloned'];
  return supported.includes(last as MutationType) ? (last as MutationType) : 'behavioral';
}
