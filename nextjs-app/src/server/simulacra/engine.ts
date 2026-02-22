import 'server-only';

import { generateUUID } from '@/lib/utils';
import type { IdeaConnection, IdeaNode, SimulacraActivity, SimulacraSnapshot } from '@/modules/simulacra/types';
import {
  createConnectionFromProposal,
  createIdeaNode,
  createSeedEcosystem,
  pollinateIdeas,
  proposeConnection,
} from '@/modules/simulacra/services/simulacraService';
import { applyMetabolism, calculateMetabolism, drainEnergy, feedEnergy } from '@/modules/simulacra/utils/energy';
import { statusFromLifecycle, updateLifecycle } from '@/modules/simulacra/utils/lifecycle';

const ACTIVITY_LIMIT = 60;
const POLLINATION_PARENT_COST = 8;

export interface SimulacraActionMeta {
  createdNodeId?: string;
  offspringNodeId?: string;
}

export interface SimulacraActionResult {
  snapshot: SimulacraSnapshot;
  meta?: SimulacraActionMeta;
}

function cloneSnapshot(snapshot: SimulacraSnapshot): SimulacraSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as SimulacraSnapshot;
}

function limitActivity(activity: SimulacraActivity[]): SimulacraActivity[] {
  return activity.slice(0, ACTIVITY_LIMIT);
}

function relationExists(connections: IdeaConnection[], sourceId: string, targetId: string): boolean {
  return connections.some((connection) => {
    const direct = connection.sourceId === sourceId && connection.targetId === targetId;
    const reverse = connection.isBidirectional && connection.sourceId === targetId && connection.targetId === sourceId;
    return direct || reverse;
  });
}

export function ensureProjectSnapshot(projectId: string, snapshot?: SimulacraSnapshot): SimulacraSnapshot {
  if (snapshot) return cloneSnapshot(snapshot);
  return {
    projectId,
    ...createSeedEcosystem(projectId),
  };
}

export function applyCreateIdea(
  snapshot: SimulacraSnapshot,
  payload: { content: string; parentId?: string; createdBy?: IdeaNode['createdBy'] }
): SimulacraActionResult {
  const content = payload.content.trim();
  if (!content) {
    return { snapshot };
  }

  const now = new Date().toISOString();
  const parent = payload.parentId ? snapshot.nodes.find((node) => node.id === payload.parentId) : null;
  const nextNode = createIdeaNode({
    projectId: snapshot.projectId,
    content,
    createdBy: payload.createdBy || 'human',
    parentIds: parent ? [parent.id] : [],
    generation: parent ? parent.generation + 1 : 0,
  });

  const nodes = parent
    ? snapshot.nodes.map((node) => {
        if (node.id !== parent.id) return node;
        return {
          ...node,
          energy: drainEnergy(node.energy, 4, now),
          updatedAt: now,
        };
      })
    : snapshot.nodes;

  return {
    snapshot: {
      ...snapshot,
      nodes: [...nodes, nextNode],
      activity: limitActivity([
        {
          id: generateUUID(),
          time: now,
          type: 'spawn',
          message: `${(payload.createdBy || 'human') === 'human' ? 'Human' : 'Agent'} spawned node ${nextNode.id.slice(0, 6)}.`,
        },
        ...snapshot.activity,
      ]),
    },
    meta: {
      createdNodeId: nextNode.id,
    },
  };
}

export function applyFeed(
  snapshot: SimulacraSnapshot,
  payload: { nodeId: string; amount?: number }
): SimulacraActionResult {
  const now = new Date().toISOString();
  const amount = typeof payload.amount === 'number' ? payload.amount : 12;

  const nodes = snapshot.nodes.map((node) => {
    if (node.id !== payload.nodeId) return node;

    const energy = feedEnergy(node.energy, amount, now);
    const lifecycle = updateLifecycle({ ...node, energy }, now);

    return {
      ...node,
      energy,
      lifecycle,
      status: statusFromLifecycle(lifecycle),
      updatedAt: now,
    };
  });

  return {
    snapshot: {
      ...snapshot,
      nodes,
      activity: limitActivity([
        {
          id: generateUUID(),
          time: now,
          type: 'feed',
          message: `Fed node ${payload.nodeId.slice(0, 6)} with +${amount} energy.`,
        },
        ...snapshot.activity,
      ]),
    },
  };
}

export function applyTick(snapshot: SimulacraSnapshot): SimulacraActionResult {
  const now = new Date().toISOString();
  const lifecycleTransitions: SimulacraActivity[] = [];

  const nodes = snapshot.nodes.map((node) => {
    if (node.status === 'archived') return node;

    const energy = applyMetabolism(node.energy, calculateMetabolism(node), now);
    const lifecycle = updateLifecycle({ ...node, energy }, now);
    const status = energy.current <= 0 ? 'dormant' : statusFromLifecycle(lifecycle);

    if (lifecycle.stage !== node.lifecycle.stage) {
      lifecycleTransitions.push({
        id: generateUUID(),
        time: now,
        type: 'lifecycle',
        message: `Node ${node.id.slice(0, 6)} matured ${node.lifecycle.stage} → ${lifecycle.stage}.`,
      });
    }

    return {
      ...node,
      energy,
      lifecycle,
      status,
      updatedAt: now,
    };
  });

  return {
    snapshot: {
      ...snapshot,
      nodes,
      activity: limitActivity([
        {
          id: generateUUID(),
          time: now,
          type: 'tick',
          message: `Metabolism tick completed across ${nodes.length} organisms.`,
        },
        ...lifecycleTransitions,
        ...snapshot.activity,
      ]),
    },
  };
}

export function applyDiscover(snapshot: SimulacraSnapshot): SimulacraActionResult {
  if (snapshot.nodes.length < 2) {
    return { snapshot };
  }

  const now = new Date().toISOString();
  const candidates = [...snapshot.nodes]
    .sort((a, b) => b.energy.current - a.energy.current)
    .slice(0, 8);

  const created: IdeaConnection[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const nodeA = candidates[i];
      const nodeB = candidates[j];

      if (relationExists(snapshot.connections, nodeA.id, nodeB.id)) {
        continue;
      }

      const proposal = proposeConnection(nodeA, nodeB);
      if (!proposal.connection || proposal.compatibility < 0.62) {
        continue;
      }

      created.push(createConnectionFromProposal(proposal.connection));
      if (created.length >= 4) break;
    }

    if (created.length >= 4) break;
  }

  if (created.length === 0) {
    return {
      snapshot: {
        ...snapshot,
        activity: limitActivity([
          {
            id: generateUUID(),
            time: now,
            type: 'agent',
            message: 'Explorer sweep found no high-confidence connections.',
          },
          ...snapshot.activity,
        ]),
      },
    };
  }

  const touched = new Set(created.flatMap((connection) => [connection.sourceId, connection.targetId]));
  const nodes = snapshot.nodes.map((node) => {
    if (!touched.has(node.id)) return node;
    return {
      ...node,
      energy: feedEnergy(node.energy, 2.5, now),
      updatedAt: now,
    };
  });

  return {
    snapshot: {
      ...snapshot,
      nodes,
      connections: [...snapshot.connections, ...created],
      activity: limitActivity([
        {
          id: generateUUID(),
          time: now,
          type: 'connection',
          message: `Explorer discovered ${created.length} new semantic connections.`,
        },
        ...snapshot.activity,
      ]),
    },
  };
}

export function applyPollinate(
  snapshot: SimulacraSnapshot,
  payload?: { parentAId?: string; parentBId?: string }
): SimulacraActionResult {
  if (snapshot.nodes.length < 2) {
    return { snapshot };
  }

  const now = new Date().toISOString();
  const resolvedIds = payload?.parentAId && payload?.parentBId
    ? [payload.parentAId, payload.parentBId]
    : snapshot.nodes
        .filter((node) => node.lifecycle.canPollinate)
        .slice(0, 2)
        .map((node) => node.id);

  if (resolvedIds.length < 2) {
    return {
      snapshot: {
        ...snapshot,
        activity: limitActivity([
          {
            id: generateUUID(),
            time: now,
            type: 'agent',
            message: 'Synthesizer skipped pollination (insufficient eligible parents).',
          },
          ...snapshot.activity,
        ]),
      },
    };
  }

  const parentA = snapshot.nodes.find((node) => node.id === resolvedIds[0]);
  const parentB = snapshot.nodes.find((node) => node.id === resolvedIds[1]);

  if (!parentA || !parentB || parentA.id === parentB.id) {
    return { snapshot };
  }

  const result = pollinateIdeas(snapshot.projectId, parentA, parentB);

  const nodes = snapshot.nodes
    .map((node) => {
      if (node.id !== parentA.id && node.id !== parentB.id) return node;
      return {
        ...node,
        energy: drainEnergy(node.energy, POLLINATION_PARENT_COST, now),
        updatedAt: now,
      };
    })
    .concat(result.offspring);

  const links = result.links.filter(
    (connection) => !relationExists(snapshot.connections, connection.sourceId, connection.targetId)
  );

  return {
    snapshot: {
      ...snapshot,
      nodes,
      connections: [...snapshot.connections, ...links],
      pollinations: [result.pollination, ...snapshot.pollinations],
      activity: limitActivity([result.activity, ...snapshot.activity]),
    },
    meta: {
      offspringNodeId: result.offspring.id,
    },
  };
}

export function applyAgentCycle(
  snapshot: SimulacraSnapshot,
  payload?: { mode?: 'explore' | 'expand' | 'synthesize' | 'full' }
): SimulacraActionResult {
  const mode = payload?.mode || 'full';

  if (mode === 'explore') {
    return applyDiscover(snapshot);
  }

  if (mode === 'synthesize') {
    return applyPollinate(snapshot);
  }

  if (mode === 'expand') {
    const candidate = snapshot.nodes
      .filter((node) => node.lifecycle.canReproduce && node.energy.current > 28)
      .sort((a, b) => b.energy.current - a.energy.current)[0];

    if (!candidate) {
      return { snapshot };
    }

    return applyCreateIdea(snapshot, {
      content: `Expansion from ${candidate.id.slice(0, 6)}: operationalize ${candidate.dna.keywords.slice(0, 3).join(', ')} with task-level decomposition.`,
      parentId: candidate.id,
      createdBy: 'agent',
    });
  }

  const afterTick = applyTick(snapshot);
  const afterDiscover = applyDiscover(afterTick.snapshot);
  const afterExpand = applyAgentCycle(afterDiscover.snapshot, { mode: 'expand' });
  const afterPollinate = applyPollinate(afterExpand.snapshot);

  return {
    snapshot: afterPollinate.snapshot,
    meta: {
      createdNodeId: afterExpand.meta?.createdNodeId,
      offspringNodeId: afterPollinate.meta?.offspringNodeId,
    },
  };
}
