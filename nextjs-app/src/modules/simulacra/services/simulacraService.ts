import { generateUUID } from '@/lib/utils';
import type {
  ConnectionLabel,
  ConnectionType,
  CreativeAgent,
  CrossPollination,
  IdeaConnection,
  IdeaDNA,
  IdeaNode,
  LifecycleState,
  PositionedIdeaNode,
  SimulacraActivity,
  Trait,
} from '@/modules/simulacra/types';
import { buildIdeaDNA, cosineSimilarity } from '@/modules/simulacra/utils/embeddings';
import { vitalityFromEnergy, energyTransferFromParents } from '@/modules/simulacra/utils/energy';
import { updateLifecycle, statusFromLifecycle } from '@/modules/simulacra/utils/lifecycle';

const EDGE_LABELS: Record<ConnectionType, ConnectionLabel> = {
  dependency: { name: 'depends on', color: '#3b82f6', icon: '⇢', affectsFlow: true, flowModifier: 1.1 },
  extends: { name: 'extends', color: '#22c55e', icon: '↗', affectsFlow: true, flowModifier: 1.2 },
  contradicts: { name: 'contradicts', color: '#ef4444', icon: '⟂', affectsFlow: true, flowModifier: 0.7 },
  analogous: { name: 'analogous', color: '#a855f7', icon: '≈', affectsFlow: false, flowModifier: 1 },
  inspires: { name: 'inspires', color: '#facc15', icon: '✦', affectsFlow: true, flowModifier: 1.3 },
  contains: { name: 'contains', color: '#9ca3af', icon: '⊃', affectsFlow: true, flowModifier: 1 },
  sequence: { name: 'sequence', color: '#0ea5e9', icon: '→', affectsFlow: true, flowModifier: 1.05 },
  'cross-pollinated': { name: 'child of', color: '#34d399', icon: '🧬', affectsFlow: true, flowModifier: 1.4 },
  custom: { name: 'custom', color: '#e5e7eb', affectsFlow: false, flowModifier: 1 },
};

export function createDefaultAgents(): CreativeAgent[] {
  return [
    {
      id: generateUUID(),
      name: 'Explorer Agent',
      role: 'explorer',
      canSpawn: false,
      canConnect: true,
      canPollinate: false,
      canExecute: false,
      curiosity: 0.9,
      creativity: 0.65,
      thoroughness: 0.75,
      queue: [],
      memory: { recentNodes: [], successfulPatterns: [], projectContext: 'Find non-obvious links.' },
    },
    {
      id: generateUUID(),
      name: 'Expander Agent',
      role: 'expander',
      canSpawn: true,
      canConnect: false,
      canPollinate: false,
      canExecute: false,
      curiosity: 0.6,
      creativity: 0.55,
      thoroughness: 0.8,
      queue: [],
      memory: { recentNodes: [], successfulPatterns: [], projectContext: 'Expand promising mature nodes.' },
    },
    {
      id: generateUUID(),
      name: 'Synthesizer Agent',
      role: 'synthesizer',
      canSpawn: true,
      canConnect: true,
      canPollinate: true,
      canExecute: false,
      curiosity: 0.8,
      creativity: 0.95,
      thoroughness: 0.7,
      queue: [],
      memory: { recentNodes: [], successfulPatterns: [], projectContext: 'Cross-pollinate high-compatibility pairs.' },
    },
    {
      id: generateUUID(),
      name: 'Curator Agent',
      role: 'curator',
      canSpawn: false,
      canConnect: true,
      canPollinate: false,
      canExecute: true,
      curiosity: 0.45,
      creativity: 0.4,
      thoroughness: 0.95,
      queue: [],
      memory: { recentNodes: [], successfulPatterns: [], projectContext: 'Keep ecosystem healthy and coherent.' },
    },
  ];
}

function createInitialLifecycle(node: Pick<IdeaNode, 'createdAt' | 'energy'>): LifecycleState {
  const initial = updateLifecycle(
    {
      id: '',
      projectId: '',
      content: '',
      dna: {
        embedding: [],
        keywords: [],
        sentiment: 0,
        complexity: 0,
        domain: [],
        traits: [],
      },
      energy: node.energy,
      lifecycle: {
        stage: 'embryo',
        ageHours: 0,
        maturity: 0,
        health: 1,
        canReproduce: false,
        canPollinate: false,
      },
      parentIds: [],
      generation: 0,
      createdAt: node.createdAt,
      updatedAt: node.createdAt,
      createdBy: 'human',
      tasks: [],
      status: 'seed',
    },
    node.createdAt
  );
  return initial;
}

export function createIdeaNode(params: {
  projectId: string;
  content: string;
  createdBy: IdeaNode['createdBy'];
  parentIds?: string[];
  generation?: number;
  agentId?: string;
  dna?: IdeaDNA;
  energySeed?: number;
}): IdeaNode {
  const now = new Date().toISOString();
  const dna = params.dna || buildIdeaDNA(params.content);
  const energyCurrent = params.energySeed ?? 58;

  const initialEnergy = {
    current: energyCurrent,
    max: Math.max(80, energyCurrent + 20),
    decayRate: Number((0.35 + dna.complexity * 0.35).toFixed(2)),
    lastActivity: now,
    attentionScore: 1,
    vitality: vitalityFromEnergy(energyCurrent, Math.max(80, energyCurrent + 20)),
  } as const;

  const lifecycle = createInitialLifecycle({
    createdAt: now,
    energy: { ...initialEnergy },
  });

  return {
    id: generateUUID(),
    projectId: params.projectId,
    content: params.content,
    dna,
    energy: { ...initialEnergy },
    lifecycle,
    parentIds: params.parentIds || [],
    generation: params.generation ?? 0,
    createdAt: now,
    updatedAt: now,
    createdBy: params.createdBy,
    agentId: params.agentId,
    tasks: [],
    status: statusFromLifecycle(lifecycle),
  };
}

function traitMap(traits: Trait[]): Map<string, Trait> {
  return new Map(traits.map((trait) => [trait.name, trait]));
}

function mergeTraits(parentA: Trait[], parentB: Trait[]): { inherited: Trait[]; novel: Trait[] } {
  const merged = traitMap(parentA);

  parentB.forEach((trait) => {
    const existing = merged.get(trait.name);
    if (!existing) {
      merged.set(trait.name, trait);
      return;
    }

    merged.set(trait.name, {
      ...existing,
      value: Number(((existing.value + trait.value) / 2).toFixed(2)),
      heritability: Number(((existing.heritability + trait.heritability) / 2).toFixed(2)),
    });
  });

  const inherited = Array.from(merged.values()).map((trait) => ({
    ...trait,
    value: Number((trait.value * (0.85 + Math.random() * 0.2)).toFixed(2)),
  }));

  const novel: Trait[] = [
    {
      name: 'generativity',
      value: Number((0.55 + Math.random() * 0.4).toFixed(2)),
      heritability: 0.45,
    },
  ];

  return { inherited, novel };
}

export function mergeDNA(parentA: IdeaDNA, parentB: IdeaDNA, mutationRate: number): { dna: IdeaDNA; inherited: Trait[]; novel: Trait[] } {
  const size = Math.min(parentA.embedding.length, parentB.embedding.length);
  const embedding = new Array(size).fill(0).map((_, index) => {
    const average = (parentA.embedding[index] + parentB.embedding[index]) / 2;
    const mutation = (Math.random() * 2 - 1) * mutationRate * 0.3;
    return Number((average + mutation).toFixed(5));
  });

  const keywords = Array.from(new Set([...parentA.keywords.slice(0, 5), ...parentB.keywords.slice(0, 5)])).slice(0, 10);
  const domain = Array.from(new Set([...parentA.domain, ...parentB.domain]));
  const { inherited, novel } = mergeTraits(parentA.traits, parentB.traits);

  return {
    dna: {
      embedding,
      keywords,
      sentiment: Number(((parentA.sentiment + parentB.sentiment) / 2).toFixed(2)),
      complexity: Number(Math.min(1, ((parentA.complexity + parentB.complexity) / 2) + mutationRate * 0.2).toFixed(2)),
      domain,
      traits: [...inherited, ...novel],
    },
    inherited,
    novel,
  };
}

function keywordOverlapRatio(keywordsA: string[], keywordsB: string[]): number {
  const setA = new Set(keywordsA);
  const setB = new Set(keywordsB);
  const setAList = Array.from(setA);
  const setBList = Array.from(setB);
  const intersection = setAList.filter((keyword) => setB.has(keyword)).length;
  const denominator = Math.max(1, new Set([...setAList, ...setBList]).size);
  return intersection / denominator;
}

function classifyConnection(nodeA: IdeaNode, nodeB: IdeaNode, similarity: number, overlap: number): { type: ConnectionType; insight: string } {
  const sentimentDelta = Math.abs(nodeA.dna.sentiment - nodeB.dna.sentiment);

  if (sentimentDelta > 0.7 && overlap > 0.15) {
    return {
      type: 'contradicts',
      insight: 'Nodes carry opposing sentiment around shared concepts, indicating productive tension.',
    };
  }

  if (similarity > 0.8) {
    return {
      type: 'analogous',
      insight: 'High semantic overlap suggests an analogous pattern that can transfer techniques.',
    };
  }

  if (overlap > 0.35) {
    return {
      type: 'extends',
      insight: 'Keyword overlap indicates one concept can extend the other with adjacent details.',
    };
  }

  if (nodeB.generation > nodeA.generation) {
    return {
      type: 'dependency',
      insight: 'The newer node appears downstream and depends on prior conceptual scaffolding.',
    };
  }

  return {
    type: 'inspires',
    insight: 'Cross-domain novelty detected with moderate compatibility, likely inspirational transfer.',
  };
}

export function proposeConnection(nodeA: IdeaNode, nodeB: IdeaNode): { compatibility: number; connection?: Omit<IdeaConnection, 'id'> } {
  const similarity = cosineSimilarity(nodeA.dna.embedding, nodeB.dna.embedding);
  const overlap = keywordOverlapRatio(nodeA.dna.keywords, nodeB.dna.keywords);
  const domainAffinity = nodeA.dna.domain.some((domain) => nodeB.dna.domain.includes(domain)) ? 0.12 : 0;
  const compatibility = Number(Math.min(1, similarity * 0.58 + overlap * 0.32 + domainAffinity).toFixed(2));

  if (compatibility < 0.45) {
    return { compatibility };
  }

  const { type, insight } = classifyConnection(nodeA, nodeB, similarity, overlap);
  const label = EDGE_LABELS[type];

  return {
    compatibility,
    connection: {
      sourceId: nodeA.id,
      targetId: nodeB.id,
      type,
      label,
      strength: Number(Math.max(0.2, compatibility).toFixed(2)),
      discoveredBy: 'agent',
      discoveryMethod: type === 'contradicts' ? 'contradiction' : type === 'analogous' ? 'analogical' : 'inferred',
      insight,
      activationCount: 1,
      lastActivated: new Date().toISOString(),
      isBidirectional: type === 'analogous',
    },
  };
}

export function createConnectionFromProposal(connection: Omit<IdeaConnection, 'id'>): IdeaConnection {
  return {
    ...connection,
    id: generateUUID(),
  };
}

export function pollinateIdeas(projectId: string, parentA: IdeaNode, parentB: IdeaNode): {
  offspring: IdeaNode;
  pollination: CrossPollination;
  links: IdeaConnection[];
  activity: SimulacraActivity;
} {
  const now = new Date().toISOString();
  const compatibility = Number(
    Math.min(1, cosineSimilarity(parentA.dna.embedding, parentB.dna.embedding) * 0.7 + 0.3).toFixed(2)
  );
  const mutationRate = Number((0.15 + Math.random() * 0.2).toFixed(2));
  const merged = mergeDNA(parentA.dna, parentB.dna, mutationRate);

  const concept = `SYNTHESIS: ${parentA.content.split(' ').slice(0, 4).join(' ')} + ${parentB.content
    .split(' ')
    .slice(0, 4)
    .join(' ')} => adaptive creative protocol`;

  const offspring = createIdeaNode({
    projectId,
    content: concept,
    createdBy: 'cross-pollination',
    parentIds: [parentA.id, parentB.id],
    generation: Math.max(parentA.generation, parentB.generation) + 1,
    dna: merged.dna,
    energySeed: energyTransferFromParents(parentA, parentB),
  });

  const pollination: CrossPollination = {
    id: generateUUID(),
    parentA: parentA.id,
    parentB: parentB.id,
    offspring: offspring.id,
    compatibility,
    mutationRate,
    inheritedTraits: merged.inherited,
    novelTraits: merged.novel,
    synthesisInsight: 'Synthesizer agent merged complementary domains and introduced controlled mutation for novelty.',
    novelConcept: concept,
  };

  const linkBase = {
    type: 'cross-pollinated' as const,
    label: EDGE_LABELS['cross-pollinated'],
    strength: Number(Math.max(0.45, compatibility).toFixed(2)),
    discoveredBy: 'agent' as const,
    discoveryMethod: 'inferred' as const,
    insight: 'Offspring inherits DNA from both parents with trait mutation.',
    activationCount: 1,
    lastActivated: now,
    isBidirectional: false,
  };

  const links: IdeaConnection[] = [
    createConnectionFromProposal({ ...linkBase, sourceId: parentA.id, targetId: offspring.id }),
    createConnectionFromProposal({ ...linkBase, sourceId: parentB.id, targetId: offspring.id }),
  ];

  return {
    offspring,
    pollination,
    links,
    activity: {
      id: generateUUID(),
      time: now,
      type: 'pollination',
      message: `Synthesizer produced offspring from ${parentA.id.slice(0, 5)} and ${parentB.id.slice(0, 5)} (compatibility ${Math.round(compatibility * 100)}%).`,
    },
  };
}

export function createSeedEcosystem(projectId: string): {
  nodes: IdeaNode[];
  connections: IdeaConnection[];
  pollinations: CrossPollination[];
  agents: CreativeAgent[];
  activity: SimulacraActivity[];
} {
  const root = createIdeaNode({
    projectId,
    content: 'Master node: Ideas as living organisms evolving through agent collaboration and energy economics.',
    createdBy: 'human',
  });

  const systemNode = createIdeaNode({
    projectId,
    content: 'Energy economy regulates idea vitality, preventing runaway growth while rewarding human attention.',
    createdBy: 'agent',
    parentIds: [root.id],
    generation: 1,
  });

  const uiNode = createIdeaNode({
    projectId,
    content: 'Graph canvas with lifecycle-aware cards and semantic edge labels for emergent navigation.',
    createdBy: 'agent',
    parentIds: [root.id],
    generation: 1,
  });

  const proposal = proposeConnection(systemNode, uiNode);
  const connections = proposal.connection ? [createConnectionFromProposal(proposal.connection)] : [];

  return {
    nodes: [root, systemNode, uiNode],
    connections,
    pollinations: [],
    agents: createDefaultAgents(),
    activity: [
      {
        id: generateUUID(),
        time: new Date().toISOString(),
        type: 'spawn',
        message: 'Simulacra initialized with a root organism and two juvenile branches.',
      },
    ],
  };
}

export function assignNodePositions(nodes: IdeaNode[]): PositionedIdeaNode[] {
  const generationBuckets = new Map<number, IdeaNode[]>();
  nodes.forEach((node) => {
    const bucket = generationBuckets.get(node.generation) || [];
    bucket.push(node);
    generationBuckets.set(node.generation, bucket);
  });

  const maxGeneration = Math.max(0, ...Array.from(generationBuckets.keys()));
  const radiusStep = 165;

  return nodes.map((node) => {
    const peers = generationBuckets.get(node.generation) || [node];
    const index = peers.findIndex((peer) => peer.id === node.id);
    const theta = (Math.PI * 2 * index) / Math.max(1, peers.length);
    const radius = 40 + (node.generation + 1) * radiusStep;

    const x = Math.round(Math.cos(theta) * radius + (maxGeneration + 1) * 190);
    const y = Math.round(Math.sin(theta) * radius + 360);

    return {
      ...node,
      position: { x, y },
    };
  });
}
