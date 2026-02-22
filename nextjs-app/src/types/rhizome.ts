import type { Module } from '@/types';

export type RhizomeChromosome = 'trigger' | 'action' | 'behavior' | 'metadata';

export type RhizomeNodeType = 'patch' | 'module' | 'activity' | 'runtime' | 'group';

export type RhizomeEdgeType = 'triggered' | 'referenced' | 'caused' | 'updated';

export interface RhizomeRuntimeEvent {
  id: string;
  patchId: string;
  moduleId: string;
  timestamp: number;
  executionState?: Module['executionState'];
  triggerActive?: boolean;
  lastExecutionSuccess?: boolean;
}

export interface RhizomeNode {
  id: string;
  type: RhizomeNodeType;
  chromosome: RhizomeChromosome;
  label: string;
  timestamp: number;
  fitness: number;
  generation: number;
  moduleId?: string;
  status?: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  details?: string;
}

export interface RhizomeEdge {
  id: string;
  source: string;
  target: string;
  type: RhizomeEdgeType;
  weight: number;
  timestamp: number;
  active: boolean;
}

export interface RhizomeGraph {
  patchId: string;
  nodes: RhizomeNode[];
  edges: RhizomeEdge[];
  lastUpdated: number;
  expressionDensity: Record<RhizomeChromosome, number>;
}

export interface RhizomeLayoutNode extends RhizomeNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RhizomeLayoutGraph extends RhizomeGraph {
  nodes: RhizomeLayoutNode[];
  canvas: {
    width: number;
    height: number;
  };
}

export interface RhizomeLayoutOptions {
  filterChromosome: RhizomeChromosome | null;
  collapsedChromosomes?: Partial<Record<RhizomeChromosome, boolean>>;
}
