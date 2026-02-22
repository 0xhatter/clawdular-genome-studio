// Simplified Simulacra Types - LLM-driven, minimal state

export type DateTime = string;

// Simplified to 4 states (was 6)
export type NodeState = "seed" | "growing" | "mature" | "dormant";

// Keep creation source tracking
export type CreatedBy = "human" | "agent" | "cross-pollination";

// Simplified connection types (no custom, no sequence, etc.)
export type SimpleConnectionType = "extends" | "contradicts" | "inspires" | "related";

// Simplified agent types (was 6, now 2)
export type SimpleAgentRole = "explorer" | "synthesizer";

// Simple idea node - no DNA, no energy decay, no complex lifecycle
export interface SimpleIdeaNode {
  id: string;
  projectId: string;
  content: string;
  state: NodeState;
  attention: number; // Simple attention score (0-100)
  lastActive: DateTime;
  parentIds: string[];
  createdAt: DateTime;
  updatedAt: DateTime;
  createdBy: CreatedBy;
  agentId?: string;
  keywords: string[]; // Extracted by LLM
  domain: string; // Domain classification by LLM
}

// Simple connection - no strength, no activation counts, no complex labels
export interface SimpleConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: SimpleConnectionType;
  insight: string; // LLM-generated insight
  discoveredBy: "human" | "agent";
  createdAt: DateTime;
}

// Cross-pollination result
export interface SimplePollination {
  id: string;
  parentA: string;
  parentB: string;
  offspring: string;
  insight: string; // LLM-generated synthesis insight
  createdAt: DateTime;
}

// Simplified agent - no curiosity/creativity/thoroughness stats, no task queue
export interface SimpleAgent {
  id: string;
  name: string;
  role: SimpleAgentRole;
  lastAction: DateTime;
  actionCount: number;
}

// Activity log entry
export interface Activity {
  id: string;
  time: DateTime;
  type: "spawn" | "connection" | "pollination" | "agent_action" | "transition";
  message: string;
  agentId?: string;
}

// Full ecosystem snapshot
export interface SimpleSimulacraSnapshot {
  projectId: string;
  nodes: SimpleIdeaNode[];
  connections: SimpleConnection[];
  pollinations: SimplePollination[];
  agents: SimpleAgent[];
  activity: Activity[];
  updatedAt: DateTime;
}

// Graph position for visualization
export interface GraphPosition {
  x: number;
  y: number;
}

export interface PositionedIdeaNode extends SimpleIdeaNode {
  position: GraphPosition;
}

// Stats for dashboard
export interface EcosystemStats {
  nodes: number;
  alive: number; // seed + growing + mature
  dormant: number;
  connections: number;
  pollinations: number;
  avgAttention: number;
}

// ===== SIMPLIFIED TYPES ONLY =====
// Removed from original:
// - IdeaDNA (embedding, sentiment, complexity, traits)
// - EnergyState (decayRate, vitality calculations)
// - LifecycleState (stage transitions, health, reproduction flags)
// - ConnectionType (8 types, labels, flow modifiers)
// - ConnectionLabel (colors, icons, affectsFlow)
// - CreativeAgent (canSpawn, canConnect, etc., curiosity stats)
// - AgentTask (task queue with priorities and energy costs)
// - AgentMemory (recentNodes, successfulPatterns)
// - Pattern (success rate tracking)
// - CrossPollination (compatibility, mutationRate, inherited/novel traits)
// - SimulacraActivity (many event types)
