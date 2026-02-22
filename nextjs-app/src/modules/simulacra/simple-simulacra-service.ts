import { generateUUID } from "@/lib/utils";
import type {
  SimpleAgent,
  SimpleConnection,
  SimpleIdeaNode,
  SimplePollination,
  NodeState,
  SimpleConnectionType,
  SimpleAgentRole,
  Activity,
} from "../modules/simulacra/types-simplified";
import { LlmSimulacraService } from "./llm-simulacra-service";

// Simplified state machine - 4 states instead of 6
const STATE_TRANSITIONS: Record<NodeState, NodeState[]> = {
  seed: ["growing", "dormant"],
  growing: ["mature", "dormant"],
  mature: ["dormant"],
  dormant: ["growing", "dormant"],
};

// Attention decay per tick (small value)
const ATTENTION_DECAY = 2;

// Attention thresholds for states
const ATTENTION_THRESHOLDS = {
  growing: 40,
  mature: 70,
  dormant: 20,
};

export class SimpleSimulacraService {
  private llmService: LlmSimulacraService;

  constructor(api: any) {
    this.llmService = new LlmSimulacraService(api);
  }

  /**
   * Create a new idea node
   */
  async createNode(params: {
    projectId: string;
    content: string;
    createdBy: SimpleIdeaNode["createdBy"];
    parentIds?: string[];
    agentId?: string;
  }): Promise<SimpleIdeaNode> {
    const now = new Date().toISOString();

    // Use LLM to classify the idea
    const classification = await this.llmService.classifyIdea(params.content);

    return {
      id: generateUUID(),
      projectId: params.projectId,
      content: params.content,
      state: "seed",
      attention: 80, // Start with high attention (new ideas get attention)
      lastActive: now,
      parentIds: params.parentIds || [],
      createdAt: now,
      updatedAt: now,
      createdBy: params.createdBy,
      agentId: params.agentId,
      keywords: classification.keywords,
      domain: classification.domain,
    };
  }

  /**
   * Propose a connection between two nodes using LLM
   */
  async proposeConnection(
    nodeA: SimpleIdeaNode,
    nodeB: SimpleIdeaNode,
  ): Promise<SimpleConnection | null> {
    // Skip if already connected
    // (caller should check this)

    // Use LLM to find relationship
    return await this.llmService.findConnection(nodeA, nodeB);
  }

  /**
   * Create a connection from proposal
   */
  createConnectionFromProposal(proposal: {
    sourceId: string;
    targetId: string;
    type: SimpleConnectionType;
    insight: string;
    discoveredBy: SimpleConnection["discoveredBy"];
  }): SimpleConnection {
    const now = new Date().toISOString();
    return {
      id: generateUUID(),
      sourceId: proposal.sourceId,
      targetId: proposal.targetId,
      type: proposal.type,
      insight: proposal.insight,
      discoveredBy: proposal.discoveredBy,
      createdAt: now,
    };
  }

  /**
   * Synthesize two nodes into offspring using LLM
   */
  async pollinateNodes(
    parentA: SimpleIdeaNode,
    parentB: SimpleIdeaNode,
  ): Promise<{ offspring: SimpleIdeaNode; pollination: SimplePollination; activity: Activity }> {
    const now = new Date().toISOString();
    const projectId = parentA.projectId;

    // Use LLM to synthesize
    const offspringContent = await this.llmService.synthesize(parentA, parentB);

    // Create offspring node
    const classification = await this.llmService.classifyIdea(offspringContent);
    const offspring: SimpleIdeaNode = {
      id: generateUUID(),
      projectId,
      content: offspringContent,
      state: "seed",
      attention: 90, // Offspring get extra attention
      lastActive: now,
      parentIds: [parentA.id, parentB.id],
      createdAt: now,
      updatedAt: now,
      createdBy: "cross-pollination",
      keywords: classification.keywords,
      domain: classification.domain,
    };

    // Create pollination record
    const pollination: SimplePollination = {
      id: generateUUID(),
      parentA: parentA.id,
      parentB: parentB.id,
      offspring: offspring.id,
      insight: `Synthesized from "${parentA.content.slice(0, 30)}..." and "${parentB.content.slice(0, 30)}..."`,
      createdAt: now,
    };

    // Create activity
    const activity: Activity = {
      id: generateUUID(),
      time: now,
      type: "pollination",
      message: `Created offspring: ${offspringContent.slice(0, 60)}...`,
    };

    return { offspring, pollination, activity };
  }

  /**
   * Run one tick of attention decay and state transitions
   */
  tick(nodes: SimpleIdeaNode[]): { updates: Map<string, Partial<SimpleIdeaNode>>; activities: Activity[] } {
    const updates = new Map<string, Partial<SimpleIdeaNode>>();
    const activities: Activity[] = [];
    const now = new Date().toISOString();

    nodes.forEach((node) => {
      const nodeUpdate: Partial<SimpleIdeaNode> = {};
      let changed = false;

      // Decay attention
      const newAttention = Math.max(0, node.attention - ATTENTION_DECAY);
      if (newAttention !== node.attention) {
        nodeUpdate.attention = newAttention;
        nodeUpdate.lastActive = now;
        changed = true;
      }

      // Check state transitions
      const possibleStates = STATE_TRANSITIONS[node.state];
      for (const targetState of possibleStates) {
        const threshold = ATTENTION_THRESHOLDS[targetState];
        if (threshold && newAttention >= threshold && node.state !== targetState) {
          // Only transition to higher state
          if (
            (node.state === "seed" && targetState === "growing") ||
            (node.state === "growing" && targetState === "mature") ||
            (node.state === "mature" && targetState === "dormant") ||
            (node.state === "dormant" && targetState === "growing")
          ) {
            nodeUpdate.state = targetState;
            activities.push({
              id: generateUUID(),
              time: now,
              type: "transition",
              message: `${node.id.slice(0, 6)}: ${node.state} → ${targetState}`,
            });
            changed = true;
            break;
          }
        }
      }

      // Dormant check (low attention)
      if (newAttention < ATTENTION_THRESHOLDS.dormant && node.state !== "dormant") {
        nodeUpdate.state = "dormant";
        activities.push({
          id: generateUUID(),
          time: now,
          type: "transition",
          message: `${node.id.slice(0, 6)}: went dormant`,
        });
        changed = true;
      }

      if (changed) {
        updates.set(node.id, { ...nodeUpdate, updatedAt: now });
      }
    });

    return { updates, activities };
  }

  /**
   * Boost attention for a node (when selected, fed, or involved in pollination)
   */
  boostAttention(node: SimpleIdeaNode, amount: number = 15): Partial<SimpleIdeaNode> {
    const newAttention = Math.min(100, node.attention + amount);
    return {
      attention: newAttention,
      lastActive: new Date().toISOString(),
    };
  }

  /**
   * Create default agents
   */
  createDefaultAgents(): SimpleAgent[] {
    const now = new Date().toISOString();
    return [
      {
        id: generateUUID(),
        name: "Explorer",
        role: "explorer",
        lastAction: now,
        actionCount: 0,
      },
      {
        id: generateUUID(),
        name: "Synthesizer",
        role: "synthesizer",
        lastAction: now,
        actionCount: 0,
      },
    ];
  }

  /**
   * Agent decides what to do
   */
  async agentDecide(
    agent: SimpleAgent,
    nodes: SimpleIdeaNode[],
    connections: SimpleConnection[],
  ): Promise<"spawn" | "connect" | "synthesize" | "wait"> {
    return await this.llmService.decideAction(nodes, connections, agent.role);
  }

  /**
   * Agent spawns a new idea
   */
  async agentSpawn(
    agent: SimpleAgent,
    projectId: string,
    context: SimpleIdeaNode[],
  ): Promise<{ node: SimpleIdeaNode; activity: Activity }> {
    const contextContent = context.map((n) => n.content);
    const newContent = await this.llmService.generateIdea(contextContent);

    const now = new Date().toISOString();
    const classification = await this.llmService.classifyIdea(newContent);

    const node: SimpleIdeaNode = {
      id: generateUUID(),
      projectId,
      content: newContent,
      state: "seed",
      attention: 85, // Agent-spawned ideas get high attention
      lastActive: now,
      parentIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: "agent",
      agentId: agent.id,
      keywords: classification.keywords,
      domain: classification.domain,
    };

    const activity: Activity = {
      id: generateUUID(),
      time: now,
      type: "spawn",
      message: `${agent.name} spawned: ${newContent.slice(0, 50)}...`,
      agentId: agent.id,
    };

    return { node, activity };
  }

  /**
   * Calculate ecosystem stats
   */
  calculateStats(
    nodes: SimpleIdeaNode[],
    connections: SimpleConnection[],
    pollinations: SimplePollination[],
  ): EcosystemStats {
    const alive = nodes.filter((n) => n.state !== "dormant").length;
    const dormant = nodes.filter((n) => n.state === "dormant").length;
    const avgAttention =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.attention, 0) / nodes.length
        : 0;

    return {
      nodes: nodes.length,
      alive,
      dormant,
      connections: connections.length,
      pollinations: pollinations.length,
      avgAttention: Math.round(avgAttention),
    };
  }

  /**
   * Static: Export assignNodePositions for use in UI
   */
  static assignNodePositionsStatic(nodes: SimpleIdeaNode[]): PositionedIdeaNode[] {
    const service = new SimpleSimulacraService(null as any);
    return service.assignNodePositions(nodes);
  }

  /**
   * Static: Export createDefaultAgents for use in hooks
   */
  static createDefaultAgentsStatic(): SimpleAgent[] {
    const service = new SimpleSimulacraService(null as any);
    return service.createDefaultAgents();
  }

  /**
   * Static: Export calculateStats for use in hooks
   */
  static calculateStatsStatic(
    nodes: SimpleIdeaNode[],
    connections: SimpleConnection[],
    pollinations: SimplePollination[],
  ): EcosystemStats {
    const service = new SimpleSimulacraService(null as any);
    return service.calculateStats(nodes, connections, pollinations);
  }

  /**
   * Assign positions to nodes (radial layout by state)
   */
  assignNodePositions(nodes: SimpleIdeaNode[]): PositionedIdeaNode[] {
    const stateBuckets = new Map<NodeState, SimpleIdeaNode[]>();
    nodes.forEach((node) => {
      const bucket = stateBuckets.get(node.state) || [];
      bucket.push(node);
      stateBuckets.set(node.state, bucket);
    });

    // Position states in concentric circles
    const stateRadii: Record<NodeState, number> = {
      seed: 80,
      growing: 180,
      mature: 280,
      dormant: 380,
    };

    const centerX = 600;
    const centerY = 400;

    return nodes.map((node) => {
      const peers = stateBuckets.get(node.state) || [node];
      const index = peers.findIndex((peer) => peer.id === node.id);
      const radius = stateRadii[node.state];
      const theta = (Math.PI * 2 * index) / Math.max(1, peers.length);

      const x = Math.round(centerX + Math.cos(theta) * radius);
      const y = Math.round(centerY + Math.sin(theta) * radius);

      return {
        ...node,
        position: { x, y },
      };
    });
  }

  /**
   * Create seed ecosystem
   */
  async createSeedEcosystem(projectId: string): Promise<{
    nodes: SimpleIdeaNode[];
    connections: SimpleConnection[];
    pollinations: SimplePollination[];
    agents: SimpleAgent[];
    activity: Activity[];
  }> {
    const now = new Date().toISOString();

    // Create root nodes
    const root = await this.createNode({
      projectId,
      content: "Core concept: Ideas evolve through interaction and synthesis",
      createdBy: "human",
    });

    const system = await this.createNode({
      projectId,
      content: "System uses LLMs to understand and connect ideas intelligently",
      createdBy: "human",
      parentIds: [root.id],
    });

    const ui = await this.createNode({
      projectId,
      content: "Visual graph canvas allows exploration and manipulation of the idea space",
      createdBy: "human",
      parentIds: [root.id],
    });

    // Create a connection
    const connection = await this.proposeConnection(system, ui);
    const connections = connection ? [this.createConnectionFromProposal({
      sourceId: connection.sourceId,
      targetId: connection.targetId,
      type: connection.type,
      insight: connection.insight,
      discoveredBy: "agent",
    })] : [];

    return {
      nodes: [root, system, ui],
      connections,
      pollinations: [],
      agents: this.createDefaultAgents(),
      activity: [
        {
          id: generateUUID(),
          time: now,
          type: "spawn",
          message: "Simulacra initialized with seed ecosystem",
        },
      ],
    };
  }
}

type EcosystemStats = {
  nodes: number;
  alive: number;
  dormant: number;
  connections: number;
  pollinations: number;
  avgAttention: number;
};
