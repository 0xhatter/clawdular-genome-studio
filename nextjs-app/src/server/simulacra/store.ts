import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { SimpleSimulacraSnapshot as SimulacraSnapshot } from '@/modules/simulacra/types-simplified';
import { SimpleSimulacraService } from '@/modules/simulacra/simple-simulacra-service';

interface SimulacraMemoryState {
  projects: Record<string, SimulacraSnapshot>;
}

const MEMORY_DIR = path.join(process.cwd(), '.rhizome');
const MEMORY_FILE = path.join(MEMORY_DIR, 'simulacra.json');

function ensureDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadState(): SimulacraMemoryState {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return { projects: {} };
    }
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SimulacraMemoryState;
    return {
      projects: parsed.projects || {},
    };
  } catch {
    return { projects: {} };
  }
}

function saveState(state: SimulacraMemoryState): void {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function cloneSnapshot(snapshot: SimulacraSnapshot): SimulacraSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as SimulacraSnapshot;
}

export class SimulacraStore {
  private state: SimulacraMemoryState;
  private service: SimpleSimulacraService;

  constructor(api: any) {
    this.state = loadState();
    this.service = new SimpleSimulacraService(api);
  }

  private async ensureProject(projectId: string): Promise<SimulacraSnapshot> {
    const existing = this.state.projects[projectId];
    if (existing) {
      return existing;
    }

    const seeded = await this.service.createSeedEcosystem(projectId);

    this.state.projects[projectId] = seeded;
    saveState(this.state);

    return seeded;
  }

  async getSnapshot(projectId: string): Promise<SimulacraSnapshot> {
    return cloneSnapshot(await this.ensureProject(projectId));
  }

  async setSnapshot(projectId: string, snapshot: SimulacraSnapshot): Promise<SimulacraSnapshot> {
    this.state.projects[projectId] = cloneSnapshot(snapshot);
    saveState(this.state);
    return this.getSnapshot(projectId);
  }

  async updateSnapshot(
    projectId: string,
    updater: (snapshot: SimulacraSnapshot, service: SimpleSimulacraService) => Promise<SimulacraSnapshot>
  ): Promise<SimulacraSnapshot> {
    const current = await this.getSnapshot(projectId);
    const next = await updater(current, this.service);
    return this.setSnapshot(projectId, next);
  }

  async createActionHandler(projectId: string) {
    return {
      createIdea: async (params: { content: string; createdBy?: SimpleSimulacraSnapshot['nodes'][0]['createdBy']; parentIds?: string[] }) => {
        return await this.updateSnapshot(projectId, async (snapshot, service) => {
          const node = await service.createNode({
            projectId,
            content: params.content,
            createdBy: params.createdBy || 'human',
            parentIds: params.parentIds,
          });

          return {
            ...snapshot,
            nodes: [...snapshot.nodes, node],
            activity: [
              ...snapshot.activity,
              {
                id: Date.now().toString(),
                time: new Date().toISOString(),
                type: 'spawn',
                message: `Created idea: ${params.content.slice(0, 50)}...`,
              },
            ],
          };
        });
      },

      feedNode: async (nodeId: string, amount: number = 15) => {
        return await this.updateSnapshot(projectId, async (snapshot, service) => {
          const node = snapshot.nodes.find(n => n.id === nodeId);
          if (!node) return snapshot;

          const update = service.boostAttention(node, amount);
          return {
            ...snapshot,
            nodes: snapshot.nodes.map(n => n.id === nodeId ? { ...n, ...update } : n),
          };
        });
      },

      tick: async () => {
        return await this.updateSnapshot(projectId, async (snapshot, service) => {
          const { updates, activities } = service.tick(snapshot.nodes);

          return {
            ...snapshot,
            nodes: snapshot.nodes.map(n => updates.get(n.id) ? { ...n, ...updates.get(n.id)! } : n),
            activity: [...snapshot.activity, ...activities],
          };
        });
      },

      discover: async () => {
        return await this.updateSnapshot(projectId, async (snapshot, service) => {
          const connections: any[] = [];
          const newActivities: any[] = [];

          // Try to find connections between nodes
          for (let i = 0; i < snapshot.nodes.length; i++) {
            for (let j = i + 1; j < snapshot.nodes.length; j++) {
              // Skip if already connected
              const exists = snapshot.connections.some(
                c => c.sourceId === snapshot.nodes[i].id && c.targetId === snapshot.nodes[j].id
              );

              if (!exists) {
                const connection = await service.proposeConnection(snapshot.nodes[i], snapshot.nodes[j]);
                if (connection) {
                  connections.push(connection);
                  newActivities.push({
                    id: Date.now().toString() + Math.random(),
                    time: new Date().toISOString(),
                    type: 'connection',
                    message: `Discovered ${connection.type} connection between ${snapshot.nodes[i].id.slice(0, 6)} and ${snapshot.nodes[j].id.slice(0, 6)}`,
                  });
                }
              }
            }
          }

          return {
            ...snapshot,
            connections: [...snapshot.connections, ...connections],
            activity: [...snapshot.activity, ...newActivities],
          };
        });
      },

      pollinate: async (parentAId?: string, parentBId?: string) => {
        return await this.updateSnapshot(projectId, async (snapshot, service) => {
          // Find parents
          const parentA = snapshot.nodes.find(n => n.id === parentAId) || snapshot.nodes[0];
          const parentB = snapshot.nodes.find(n => n.id === parentBId) || snapshot.nodes[1];

          // Create pollination
          const { offspring, pollination, activity } = await service.pollinateNodes(parentA, parentB);

          return {
            ...snapshot,
            nodes: [...snapshot.nodes, offspring],
            connections: [
              ...snapshot.connections,
              service.createConnectionFromProposal({
                sourceId: parentA.id,
                targetId: offspring.id,
                type: 'cross-pollinated' as any,
                insight: 'Child of parent A',
                discoveredBy: 'agent',
              }),
              service.createConnectionFromProposal({
                sourceId: parentB.id,
                targetId: offspring.id,
                type: 'cross-pollinated' as any,
                insight: 'Child of parent B',
                discoveredBy: 'agent',
              }),
            ],
            pollinations: [...snapshot.pollinations, pollination],
            activity: [...snapshot.activity, activity],
          };
        });
      },

      agentCycle: async (mode: 'explore' | 'expand' | 'synthesize' | 'full' = 'full') => {
        return await this.updateSnapshot(projectId, async (snapshot, service) => {
          const agent = snapshot.agents[mode === 'explore' || mode === 'full' ? 0 : 1];
          const action = await service.agentDecide(agent, snapshot.nodes, snapshot.connections);

          let newSnapshot = { ...snapshot };

          switch (action) {
            case 'spawn': {
              const { node, activity } = await service.agentSpawn(agent, projectId, snapshot.nodes);
              newSnapshot.nodes = [...newSnapshot.nodes, node];
              newSnapshot.activity = [...newSnapshot.activity, activity];
              newSnapshot.agents = newSnapshot.agents.map(a =>
                a.id === agent.id ? { ...a, lastAction: new Date().toISOString(), actionCount: a.actionCount + 1 } : a
              );
              break;
            }
            case 'connect': {
              const { updates, activities } = service.tick(snapshot.nodes);
              // Find one connection
              for (let i = 0; i < snapshot.nodes.length; i++) {
                for (let j = i + 1; j < snapshot.nodes.length; j++) {
                  const exists = snapshot.connections.some(
                    c => c.sourceId === snapshot.nodes[i].id && c.targetId === snapshot.nodes[j].id
                  );
                  if (!exists) {
                    const connection = await service.proposeConnection(snapshot.nodes[i], snapshot.nodes[j]);
                    if (connection) {
                      newSnapshot.connections = [...newSnapshot.connections, connection];
                      newSnapshot.activity = [...newSnapshot.activity, {
                        id: Date.now().toString() + Math.random(),
                        time: new Date().toISOString(),
                        type: 'agent_action',
                        message: `Agent found ${connection.type} connection`,
                        agentId: agent.id,
                      }];
                      newSnapshot.agents = newSnapshot.agents.map(a =>
                        a.id === agent.id ? { ...a, lastAction: new Date().toISOString(), actionCount: a.actionCount + 1 } : a
                      );
                      break;
                    }
                  }
                }
              }
              break;
            }
            case 'synthesize': {
              // Pick two mature nodes
              const mature = snapshot.nodes.filter(n => n.state === 'mature').slice(0, 2);
              if (mature.length >= 2) {
                const { offspring, pollination, activity } = await service.pollinateNodes(mature[0], mature[1]);
                newSnapshot.nodes = [...newSnapshot.nodes, offspring];
                newSnapshot.connections = [
                  ...newSnapshot.connections,
                  service.createConnectionFromProposal({
                    sourceId: mature[0].id,
                    targetId: offspring.id,
                    type: 'cross-pollinated' as any,
                    insight: 'Child of parent A',
                    discoveredBy: 'agent',
                  }),
                  service.createConnectionFromProposal({
                    sourceId: mature[1].id,
                    targetId: offspring.id,
                    type: 'cross-pollinated' as any,
                    insight: 'Child of parent B',
                    discoveredBy: 'agent',
                  }),
                ];
                newSnapshot.pollinations = [...newSnapshot.pollinations, pollination];
                newSnapshot.activity = [...newSnapshot.activity, activity];
                newSnapshot.agents = newSnapshot.agents.map(a =>
                  a.id === agent.id ? { ...a, lastAction: new Date().toISOString(), actionCount: a.actionCount + 1 } : a
                );
              }
              break;
            }
            case 'wait': {
              // Just tick
              const { updates, activities } = service.tick(snapshot.nodes);
              newSnapshot.nodes = snapshot.nodes.map(n => updates.get(n.id) ? { ...n, ...updates.get(n.id)! } : n);
              newSnapshot.activity = [...newSnapshot.activity, ...activities];
              newSnapshot.agents = newSnapshot.agents.map(a =>
                a.id === agent.id ? { ...a, lastAction: new Date().toISOString(), actionCount: a.actionCount + 1 } : a
              );
              break;
            }
          }

          return newSnapshot;
        });
      },
    };
  }
}

let singleton: SimulacraStore | null = null;

export function getSimulacraStore(api: any): SimulacraStore {
  if (!singleton) {
    singleton = new SimulacraStore(api);
  }
  return singleton;
}
