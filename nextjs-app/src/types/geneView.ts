export type GeneStage = 'seed' | 'sprout' | 'juvenile' | 'mature' | 'adaptive' | 'senescent';
export type ExpressionState = 'silent' | 'primed' | 'transcribing' | 'translated' | 'stressed' | 'mutating';
export type MutationType = 'parameter' | 'behavioral' | 'structural' | 'spliced' | 'bred' | 'cloned';

export interface GenePart {
  id: string;
  type: 'promoter' | 'utr5' | 'exon' | 'intron' | 'utr3' | 'regulator' | 'mark';
  start: number;
  end: number;
  intensity: number;
  metadata?: Record<string, any>;
}

export interface LineageEdge {
  childId: string;
  parentIds: string[];
  crossoverPoints?: number[];
  spliceSeam?: number;
  timestamp: number;
  mutationType: MutationType;
}

export interface GeneViewModel {
  stage: GeneStage;
  expressionState: ExpressionState;
  parts: GenePart[];
  lineage?: LineageEdge;
  mutationLoad: number;
  fitness: number;
  generation: number;
  moduleId: string;
}

export interface MutationImpact {
  changedParts: string[];
  confidence: number;
  severity: 'minor' | 'moderate' | 'major';
  type: MutationType;
}
