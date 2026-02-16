export interface Point {
  x: number;
  y: number;
}

export interface Port {
  id: string;
  name: string;
  type: 'data' | 'trigger' | 'control';
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'stream' | 'any';
  connectedTo: string[];
  isInput: boolean;
}

export interface Parameter {
  id: string;
  name: string;
  type: 'knob' | 'slider' | 'toggle' | 'select' | 'text';
  value: any;
  range?: { min: number; max: number };
  options?: string[];
}

export interface Chromosome {
  patterns?: TriggerPattern[];
  filters?: Filter[];
  operations?: Operation[];
  rateLimit?: RateLimitConfig;
  retryPolicy?: RetryConfig;
  name?: string;
  description?: string;
  tags?: string[];
}

export interface TriggerPattern {
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  pattern: string;
}

export interface Filter {
  field: string;
  operator: string;
  value: string;
}

export interface Operation {
  type: string;
  config: Record<string, any>;
}

export interface RateLimitConfig {
  max: number;
  window: string;
}

export interface RetryConfig {
  maxRetries: number;
  backoff: string;
}

export interface Genome {
  id: string;
  version: string;
  chromosomes: {
    trigger: Chromosome;
    action: Chromosome;
    behavior: Chromosome;
    metadata: Chromosome;
  };
  mutations: Mutation[];
  fitness: FitnessScore;
}

export interface Mutation {
  timestamp: number;
  type: 'parameter' | 'structural' | 'behavioral' | 'spliced' | 'bred' | 'cloned';
  changes: Change[];
  parentGenomes?: string[];
}

export interface Change {
  chromosome?: string;
  from?: string;
  to?: string;
  operation?: string;
}

export interface FitnessScore {
  overall: number;
  components: {
    reliability: number;
    efficiency: number;
    utility: number;
    satisfaction: number;
    adaptability: number;
  };
}

export interface Module {
  id: string;
  skillId: string;
  genome: Genome;
  position: Point;
  inputs: Port[];
  outputs: Port[];
  parameters: Parameter[];
  state: 'idle' | 'running' | 'error' | 'evolving' | 'mutating';
  generation: number;
  parentIds: string[];
  mutationCount?: number;
  fitness?: number;
  crossoverPoints?: number[];
  spliceSeam?: number;
  createdAt?: number;
  lastExecutionSuccess?: boolean;
  triggerActive?: boolean;
  executionState?: 'idle' | 'running' | 'error' | 'mutating';
}

export interface Connection {
  id: string;
  from: PortRef;
  to: PortRef;
  type: 'data' | 'trigger' | 'feedback';
  active: boolean;
}

export interface PortRef {
  moduleId: string;
  portId: string;
}

export interface Patch {
  id: string;
  name: string;
  description: string;
  modules: Module[];
  connections: Connection[];
  activityLog: ActivityEvent[];
  generation: number;
  evolutionHistory: EvolutionEvent[];
  fitness: FitnessScore;
  isRunning: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  action: string;
  status: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  patchName: string;
}

export interface EvolutionEvent {
  timestamp: number;
  generation: number;
  strategy: string;
  parentPatch: string;
  changes: Change[];
}

export interface ExecutionMetrics {
  totalRuns: number;
  successfulRuns: number;
  avgTokenUsage: number;
  avgExecutionTime: number;
  usageCount: number;
  ratings: number[];
  totalErrors: number;
  recoveredErrors: number;
}

export type ViewType = 'dashboard' | 'patchbay' | 'genome' | 'evolution';

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  category: 'input' | 'process' | 'output' | 'logic' | 'utility';
  chromosomes: {
    trigger: Chromosome;
    action: Chromosome;
    behavior: Chromosome;
  };
  inputs: Omit<Port, 'id' | 'connectedTo'>[];
  outputs: Omit<Port, 'id' | 'connectedTo'>[];
  parameters: Omit<Parameter, 'id'>[];
}
