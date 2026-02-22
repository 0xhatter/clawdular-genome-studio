import type { ActivityEvent, Module, Patch } from '@/types';
import type {
  RhizomeChromosome,
  RhizomeEdge,
  RhizomeGraph,
  RhizomeLayoutGraph,
  RhizomeLayoutNode,
  RhizomeLayoutOptions,
  RhizomeNode,
  RhizomeRuntimeEvent,
} from '@/types/rhizome';
import { clamp } from '@/lib/utils';

const LANE_X: Record<RhizomeChromosome, number> = {
  trigger: 180,
  action: 460,
  behavior: 740,
  metadata: 1020,
};

export const RHIZOME_CHROMOSOMES: RhizomeChromosome[] = ['trigger', 'action', 'behavior', 'metadata'];

function compactAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/:/g, ' ');
}

function inferActivityChromosome(action: string): RhizomeChromosome {
  if (
    action.startsWith('PATCH_EXECUTE_STARTED') ||
    action.startsWith('PATCH_STOPPED') ||
    action.startsWith('CONNECTION_CREATED')
  ) {
    return 'trigger';
  }
  if (
    action.startsWith('PATCH_EXECUTE_COMPLETED') ||
    action.startsWith('MODULE_ADDED') ||
    action.startsWith('CONNECTION_REMOVED')
  ) {
    return 'action';
  }
  if (
    action.startsWith('MODULE_MUTATED') ||
    action.startsWith('MODULES_BRED') ||
    action.startsWith('MODE_SET') ||
    action.startsWith('PARAM_UPDATED') ||
    action.startsWith('GENOME_UPDATED') ||
    action.startsWith('EVOLUTION')
  ) {
    return 'behavior';
  }
  return 'metadata';
}

function inferRuntimeChromosome(event: RhizomeRuntimeEvent): RhizomeChromosome {
  if (event.triggerActive) return 'trigger';
  if (event.executionState === 'running') return 'action';
  if (event.executionState === 'mutating') return 'behavior';
  return 'metadata';
}

function statusFitness(status?: ActivityEvent['status']): number {
  if (status === 'SUCCESS') return 0.92;
  if (status === 'INFO') return 0.75;
  if (status === 'WARN') return 0.5;
  if (status === 'ERROR') return 0.28;
  return 0.65;
}

function executionFitness(event: RhizomeRuntimeEvent): number {
  if (event.lastExecutionSuccess === true) return 0.94;
  if (event.lastExecutionSuccess === false) return 0.3;
  if (event.executionState === 'running') return 0.72;
  if (event.executionState === 'error') return 0.25;
  return 0.6;
}

function ageFitness(baseFitness: number, timestamp: number, now: number): number {
  const ageHours = Math.max(0, now - timestamp) / (1000 * 60 * 60);
  const ageMultiplier = Math.exp(-ageHours / 36);
  return clamp(baseFitness * ageMultiplier, 0.05, 1);
}

function moduleLabel(module: Module): string {
  return module.genome.chromosomes.metadata?.name || module.skillId;
}

function sortNewestFirst(a: { timestamp: number }, b: { timestamp: number }): number {
  return b.timestamp - a.timestamp;
}

function computeExpressionDensity(nodes: RhizomeNode[]): Record<RhizomeChromosome, number> {
  const grouped = RHIZOME_CHROMOSOMES.reduce<Record<RhizomeChromosome, RhizomeNode[]>>(
    (acc, chromosome) => {
      acc[chromosome] = [];
      return acc;
    },
    {
      trigger: [],
      action: [],
      behavior: [],
      metadata: [],
    }
  );

  nodes.forEach((node) => {
    grouped[node.chromosome].push(node);
  });

  return RHIZOME_CHROMOSOMES.reduce<Record<RhizomeChromosome, number>>((acc, chromosome) => {
    const members = grouped[chromosome];
    if (members.length === 0) {
      acc[chromosome] = 0;
      return acc;
    }
    const totalFitness = members.reduce((sum, node) => sum + node.fitness, 0);
    acc[chromosome] = clamp(totalFitness / members.length, 0, 1);
    return acc;
  }, {
    trigger: 0,
    action: 0,
    behavior: 0,
    metadata: 0,
  });
}

export function buildRhizomeGraph(
  patch: Patch,
  runtimeEvents: RhizomeRuntimeEvent[],
  maxActivityNodes = 120,
  maxRuntimeNodes = 120
): RhizomeGraph {
  const now = Date.now();
  const nodes: RhizomeNode[] = [];
  const edges: RhizomeEdge[] = [];
  const moduleMap = new Map(patch.modules.map((module) => [module.id, module]));
  const moduleNodesAdded = new Set<string>();

  const patchNodeId = `patch:${patch.id}`;
  nodes.push({
    id: patchNodeId,
    type: 'patch',
    chromosome: 'metadata',
    label: patch.name,
    timestamp: patch.updatedAt,
    fitness: ageFitness(clamp(patch.fitness.overall / 100, 0.2, 1), patch.updatedAt, now),
    generation: patch.generation,
    details: `GEN ${patch.generation}`,
  });

  const activityNodes = patch.activityLog.slice(0, maxActivityNodes).slice().sort(sortNewestFirst);
  for (const event of activityNodes) {
    const chromosome = inferActivityChromosome(event.action);
    const eventNodeId = `activity:${event.id}`;
    nodes.push({
      id: eventNodeId,
      type: 'activity',
      chromosome,
      label: compactAction(event.action).slice(0, 40),
      timestamp: event.timestamp,
      fitness: ageFitness(statusFitness(event.status), event.timestamp, now),
      generation: patch.generation,
      status: event.status,
      details: event.action,
    });
    edges.push({
      id: `edge:${patchNodeId}:${eventNodeId}`,
      source: patchNodeId,
      target: eventNodeId,
      type: 'caused',
      weight: 0.45,
      timestamp: event.timestamp,
      active: event.status === 'SUCCESS' || event.status === 'INFO',
    });
  }

  const runtimeNodes = runtimeEvents.slice(0, maxRuntimeNodes).slice().sort(sortNewestFirst);
  for (const event of runtimeNodes) {
    const module = moduleMap.get(event.moduleId);
    if (!module) continue;

    const moduleNodeId = `module:${patch.id}:${module.id}`;
    if (!moduleNodesAdded.has(moduleNodeId)) {
      moduleNodesAdded.add(moduleNodeId);
      nodes.push({
        id: moduleNodeId,
        type: 'module',
        chromosome: 'action',
        label: moduleLabel(module).slice(0, 32),
        timestamp: module.createdAt || patch.createdAt,
        fitness: ageFitness(clamp(module.genome.fitness.overall / 100, 0.2, 1), module.createdAt || patch.createdAt, now),
        generation: module.generation,
        moduleId: module.id,
        details: module.skillId,
      });
      edges.push({
        id: `edge:${patchNodeId}:${moduleNodeId}`,
        source: patchNodeId,
        target: moduleNodeId,
        type: 'referenced',
        weight: 0.36,
        timestamp: patch.updatedAt,
        active: true,
      });
    }

    const runtimeNodeId = `runtime:${event.id}`;
    nodes.push({
      id: runtimeNodeId,
      type: 'runtime',
      chromosome: inferRuntimeChromosome(event),
      label: `${event.executionState || 'idle'}${event.triggerActive ? ' trigger' : ''}`.trim(),
      timestamp: event.timestamp,
      fitness: ageFitness(executionFitness(event), event.timestamp, now),
      generation: module.generation,
      moduleId: module.id,
      details: moduleLabel(module),
    });
    edges.push({
      id: `edge:${moduleNodeId}:${runtimeNodeId}`,
      source: moduleNodeId,
      target: runtimeNodeId,
      type: event.triggerActive ? 'triggered' : 'updated',
      weight: event.triggerActive ? 0.9 : 0.65,
      timestamp: event.timestamp,
      active: event.executionState === 'running' || event.triggerActive === true,
    });
  }

  return {
    patchId: patch.id,
    nodes,
    edges,
    lastUpdated: now,
    expressionDensity: computeExpressionDensity(nodes.filter((node) => node.type !== 'patch')),
  };
}

function toLayoutNode(node: RhizomeNode, laneIndex: number): RhizomeLayoutNode {
  const width = node.type === 'patch' ? 220 : node.type === 'group' ? 230 : 210;
  const height = node.type === 'patch' ? 48 : 42;
  return {
    ...node,
    width,
    height,
    x: LANE_X[node.chromosome] - width / 2,
    y: node.type === 'patch' ? 24 : 88 + laneIndex * 64,
  };
}

function collapseRhizomeLanes(
  nodes: RhizomeNode[],
  edges: RhizomeEdge[],
  collapsedChromosomes: Partial<Record<RhizomeChromosome, boolean>>
): { nodes: RhizomeNode[]; edges: RhizomeEdge[] } {
  const groupByChromosome = new Map<RhizomeChromosome, RhizomeNode[]>();
  const visibleNodes: RhizomeNode[] = [];
  const mappedNodeId = new Map<string, string>();

  RHIZOME_CHROMOSOMES.forEach((chromosome) => {
    groupByChromosome.set(chromosome, []);
  });

  nodes.forEach((node) => {
    if (node.type === 'patch' || !collapsedChromosomes[node.chromosome]) {
      visibleNodes.push(node);
      mappedNodeId.set(node.id, node.id);
      return;
    }
    groupByChromosome.get(node.chromosome)?.push(node);
  });

  RHIZOME_CHROMOSOMES.forEach((chromosome) => {
    const collapsedNodes = groupByChromosome.get(chromosome) || [];
    if (collapsedNodes.length === 0 || !collapsedChromosomes[chromosome]) return;

    const groupId = `group:${chromosome}`;
    const latestTimestamp = Math.max(...collapsedNodes.map((node) => node.timestamp));
    const avgFitness = clamp(
      collapsedNodes.reduce((sum, node) => sum + node.fitness, 0) / collapsedNodes.length,
      0,
      1
    );
    const latestGeneration = Math.max(...collapsedNodes.map((node) => node.generation));
    const runtimeCount = collapsedNodes.filter((node) => node.type === 'runtime').length;
    const activityCount = collapsedNodes.filter((node) => node.type === 'activity').length;
    const moduleCount = collapsedNodes.filter((node) => node.type === 'module').length;

    visibleNodes.push({
      id: groupId,
      type: 'group',
      chromosome,
      label: `${chromosome} cluster`,
      timestamp: latestTimestamp,
      fitness: avgFitness,
      generation: latestGeneration,
      details: `${collapsedNodes.length} nodes | M:${moduleCount} A:${activityCount} R:${runtimeCount}`,
    });

    collapsedNodes.forEach((node) => {
      mappedNodeId.set(node.id, groupId);
    });
  });

  const aggregate = new Map<string, RhizomeEdge & { _count: number }>();
  edges.forEach((edge) => {
    const source = mappedNodeId.get(edge.source);
    const target = mappedNodeId.get(edge.target);
    if (!source || !target || source === target) return;

    const key = `${source}|${target}|${edge.type}`;
    const existing = aggregate.get(key);
    if (existing) {
      existing.weight += edge.weight;
      existing.timestamp = Math.max(existing.timestamp, edge.timestamp);
      existing.active = existing.active || edge.active;
      existing._count += 1;
      return;
    }

    aggregate.set(key, {
      id: `edge:${key}`.replace(/[^a-zA-Z0-9:_|-]/g, '_'),
      source,
      target,
      type: edge.type,
      weight: edge.weight,
      timestamp: edge.timestamp,
      active: edge.active,
      _count: 1,
    });
  });

  const visibleEdges: RhizomeEdge[] = Array.from(aggregate.values()).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    weight: clamp(edge.weight / edge._count, 0.15, 1),
    timestamp: edge.timestamp,
    active: edge.active,
  }));

  return { nodes: visibleNodes, edges: visibleEdges };
}

import * as d3 from 'd3-force';

export function layoutRhizomeGraph(
  graph: RhizomeGraph,
  options: RhizomeLayoutOptions
): RhizomeLayoutGraph {
  const { filterChromosome, collapsedChromosomes = {} } = options;
  const visibleNodesByFilter = graph.nodes.filter(
    (node) => !filterChromosome || node.chromosome === filterChromosome || node.type === 'patch'
  );
  const visibleNodeIdsByFilter = new Set(visibleNodesByFilter.map((node) => node.id));
  const visibleEdgesByFilter = graph.edges.filter(
    (edge) => visibleNodeIdsByFilter.has(edge.source) && visibleNodeIdsByFilter.has(edge.target)
  );

  const collapsed = collapseRhizomeLanes(visibleNodesByFilter, visibleEdgesByFilter, collapsedChromosomes);

  // Create layout nodes from visible nodes
  // For a bubble map, we make width and height identical (circles)
  const layoutNodes: (RhizomeLayoutNode & d3.SimulationNodeDatum)[] = collapsed.nodes.map(node => {
    let size = 64; // Default bubble size
    if (node.type === 'patch') size = 100; // Main patch bubble is larger
    else if (node.type === 'group') size = 80;

    return {
      ...node,
      width: size,
      height: size,
      x: 0,
      y: 0,
    };
  });

  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));

  // Set the canvas dimensions to comfortably hold a star layout
  const CANVAS_WIDTH = 1600;
  const CANVAS_HEIGHT = 1600;
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;

  // Directions for chromosomes (diverging outwards)
  // trigger: Top-Left
  // action: Top-Right
  // behavior: Bottom-Left
  // metadata: Bottom-Right
  const directions: Record<RhizomeChromosome, { x: number; y: number }> = {
    trigger: { x: centerX - 300, y: centerY - 300 },
    action: { x: centerX + 300, y: centerY - 300 },
    behavior: { x: centerX - 300, y: centerY + 300 },
    metadata: { x: centerX + 300, y: centerY + 300 },
  };

  // Lock the patch node in the center
  layoutNodes.forEach(n => {
    if (n.type === 'patch') {
      n.fx = centerX;
      n.fy = centerY;
    }
  });

  const layoutEdges = collapsed.edges.map(e => ({
    ...e,
    source: nodeMap.get(e.source)!,
    target: nodeMap.get(e.target)!,
  })).filter(e => e.source && e.target);

  const simulation = d3.forceSimulation(layoutNodes)
    .force('charge', d3.forceManyBody<RhizomeLayoutNode & d3.SimulationNodeDatum>().strength(node => (node.type === 'patch' ? -1000 : -400)))
    .force('collide', d3.forceCollide().radius(110).iterations(3))
    .force('link', d3.forceLink(layoutEdges).id((d: any) => d.id).distance(180))
    // Add radial positioning forces to pull chromosomes to their designated quadrants
    .force('x', d3.forceX<RhizomeLayoutNode & d3.SimulationNodeDatum>().x((node) => {
      if (node.type === 'patch') return centerX;
      return directions[node.chromosome as RhizomeChromosome]?.x || centerX;
    }).strength(0.3))
    .force('y', d3.forceY<RhizomeLayoutNode & d3.SimulationNodeDatum>().y((node) => {
      if (node.type === 'patch') return centerY;
      return directions[node.chromosome as RhizomeChromosome]?.y || centerY;
    }).strength(0.3));

  // Run the simulation statically to pre-calculate positions
  simulation.stop();
  simulation.tick(150);

  // Position the nodes correctly for rendering since d3 calculates center points, 
  // but we render from top-left.
  layoutNodes.forEach(n => {
    n.x = (n.x ?? 0) - n.width / 2;
    n.y = (n.y ?? 0) - n.height / 2;
  });

  // Re-map edges back to string IDs for the renderer
  const outputEdges = layoutEdges.map(e => ({
    ...e,
    source: (e.source as any).id,
    target: (e.target as any).id,
  }));

  return {
    ...graph,
    nodes: layoutNodes,
    edges: outputEdges,
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
  };
}
