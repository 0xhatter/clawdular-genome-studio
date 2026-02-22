export type DateTime = string;

export type NodeStatus = 'seed' | 'growing' | 'mature' | 'refining' | 'dormant' | 'archived';
export type CreatedBy = 'human' | 'agent' | 'cross-pollination';
export type Vitality = 'thriving' | 'stable' | 'struggling' | 'critical' | 'dormant';
export type LifecycleStage = 'embryo' | 'infant' | 'juvenile' | 'adult' | 'elder' | 'fossil';

export interface Trait {
  name: string;
  value: number;
  heritability: number;
}

export interface IdeaDNA {
  embedding: number[];
  keywords: string[];
  sentiment: number;
  complexity: number;
  domain: string[];
  traits: Trait[];
}

export interface EnergyState {
  current: number;
  max: number;
  decayRate: number;
  lastActivity: DateTime;
  attentionScore: number;
  vitality: Vitality;
}

export interface LifecycleState {
  stage: LifecycleStage;
  ageHours: number;
  maturity: number;
  health: number;
  nextStageAt?: DateTime;
  canReproduce: boolean;
  canPollinate: boolean;
}

export interface Task {
  id: string;
  title: string;
  status: 'queued' | 'active' | 'done';
}

export interface IdeaNode {
  id: string;
  projectId: string;
  content: string;
  dna: IdeaDNA;
  energy: EnergyState;
  lifecycle: LifecycleState;
  parentIds: string[];
  generation: number;
  createdAt: DateTime;
  updatedAt: DateTime;
  createdBy: CreatedBy;
  agentId?: string;
  tasks: Task[];
  status: NodeStatus;
}

export type ConnectionType =
  | 'dependency'
  | 'extends'
  | 'contradicts'
  | 'analogous'
  | 'inspires'
  | 'contains'
  | 'sequence'
  | 'cross-pollinated'
  | 'custom';

export interface ConnectionLabel {
  name: string;
  color: string;
  icon?: string;
  affectsFlow: boolean;
  flowModifier: number;
}

export interface IdeaConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: ConnectionType;
  label: ConnectionLabel;
  strength: number;
  discoveredBy: 'human' | 'agent' | 'system';
  discoveryMethod: 'explicit' | 'inferred' | 'analogical' | 'contradiction';
  insight?: string;
  activationCount: number;
  lastActivated: DateTime;
  isBidirectional: boolean;
}

export interface CrossPollination {
  id: string;
  parentA: string;
  parentB: string;
  offspring: string;
  compatibility: number;
  mutationRate: number;
  inheritedTraits: Trait[];
  novelTraits: Trait[];
  synthesisInsight: string;
  novelConcept: string;
}

export type AgentRole = 'explorer' | 'expander' | 'synthesizer' | 'critic' | 'executor' | 'curator';

export interface AgentTask {
  id: string;
  type: 'spawn' | 'connect' | 'pollinate' | 'analyze' | 'execute';
  targetNodeId?: string;
  contextNodes: string[];
  priority: number;
  energyCost: number;
}

export interface Pattern {
  key: string;
  successRate: number;
}

export interface AgentMemory {
  recentNodes: string[];
  successfulPatterns: Pattern[];
  projectContext: string;
}

export interface CreativeAgent {
  id: string;
  name: string;
  role: AgentRole;
  canSpawn: boolean;
  canConnect: boolean;
  canPollinate: boolean;
  canExecute: boolean;
  curiosity: number;
  creativity: number;
  thoroughness: number;
  currentFocus?: string;
  queue: AgentTask[];
  memory: AgentMemory;
}

export interface SimulacraActivity {
  id: string;
  time: DateTime;
  type: 'spawn' | 'connection' | 'pollination' | 'feed' | 'tick' | 'agent' | 'lifecycle';
  message: string;
}

export interface SimulacraSnapshot {
  projectId: string;
  nodes: IdeaNode[];
  connections: IdeaConnection[];
  pollinations: CrossPollination[];
  agents: CreativeAgent[];
  activity: SimulacraActivity[];
}

export interface GraphPosition {
  x: number;
  y: number;
}

export interface PositionedIdeaNode extends IdeaNode {
  position: GraphPosition;
}
