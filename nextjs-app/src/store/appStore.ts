import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  Patch, 
  Module, 
  Connection, 
  PortRef, 
  Point, 
  Genome, 
  FitnessScore,
  ActivityEvent,
  ViewType,
  SkillDefinition 
} from '@/types';
import type { RhizomeRuntimeEvent } from '@/types/rhizome';
import { generateUUID, incrementVersion } from '@/lib/utils';
import { migrateMarkdownToRhizome } from '@/lib/migrateMarkdownToRhizome';
import { openclawdClient, type RuntimeModuleEvent } from '@/lib/openclawd';

interface AppState {
  // View state
  currentView: ViewType;
  setView: (view: ViewType) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Patches
  patches: Record<string, Patch>;
  currentPatchId: string | null;
  selectedModuleId: string | null;
  runtimeEventMemory: Record<string, RhizomeRuntimeEvent[]>;
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  
  // Actions
  createPatch: (name: string, description?: string) => Patch;
  clonePatch: (patchId: string) => Patch | null;
  loadPatch: (patchId: string) => void;
  updatePatch: (patchId: string, updates: Partial<Patch>) => void;
  deletePatch: (patchId: string) => void;
  
  // Module actions
  addModule: (patchId: string, skillId: string, position: Point) => void;
  cloneModule: (patchId: string, moduleId: string, position?: Point) => void;
  removeModule: (patchId: string, moduleId: string) => void;
  updateModulePosition: (patchId: string, moduleId: string, position: Point) => void;
  selectModule: (moduleId: string | null) => void;
  updateModuleGenome: (patchId: string, moduleId: string, genome: Genome) => void;
  updateModuleMetadata: (patchId: string, moduleId: string, name: string) => void;
  setModuleOperationMode: (patchId: string, moduleId: string, mode: 'extract' | 'replace') => void;
  updateModuleParameter: (patchId: string, moduleId: string, parameterId: string, value: any) => void;
  
  // Connection actions
  createConnection: (patchId: string, from: PortRef, to: PortRef) => void;
  removeConnection: (patchId: string, connectionId: string) => void;
  
  // Execution
  executePatch: (patchId: string) => void;
  stopPatch: (patchId: string) => void;
  
  // Evolution
  evolvePatch: (patchId: string, strategy: string) => void;
  mutateModule: (patchId: string, moduleId: string, type: string, intensity: number) => void;
  breedModules: (patchId: string, moduleAId: string, moduleBId: string) => void;
  
  // Skill library
  skillLibrary: SkillDefinition[];
  loadSkillLibrary: () => void;
  initializeRuntimeEvents: () => void;
  clearRuntimeEventMemory: (patchId: string) => void;
  importRhizomeMarkdownMemory: (
    patchId: string,
    markdown: string,
    options?: { replace?: boolean }
  ) => { ok: boolean; importedActivity: number; importedRuntime: number; error?: string };
  exportCurrentPatchJSON: () => string | null;
  importPatchFromJSON: (json: string) => { ok: boolean; error?: string };

  // Hydration
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

interface HistorySnapshot {
  patches: Record<string, Patch>;
  runtimeEventMemory: Record<string, RhizomeRuntimeEvent[]>;
  currentPatchId: string | null;
  selectedModuleId: string | null;
}

let runtimeEventsUnsubscribe: null | (() => void) = null;

// Default skill library
const defaultSkills: SkillDefinition[] = [
  {
    id: 'gmail-trigger',
    name: 'Email Trigger',
    version: '1.0.0',
    category: 'input',
    chromosomes: {
      trigger: {
        patterns: [{ type: 'webhook', pattern: '/webhook/gmail' }],
        filters: []
      },
      action: {
        operations: [{ type: 'extract', config: { fields: ['sender', 'subject', 'body'] } }]
      },
      behavior: {
        rateLimit: { max: 100, window: '1h' },
        retryPolicy: { maxRetries: 3, backoff: 'exponential' }
      }
    },
    inputs: [],
    outputs: [
      { name: 'Email Data', type: 'data', dataType: 'object', isInput: false },
      { name: 'Attachments', type: 'data', dataType: 'stream', isInput: false }
    ],
    parameters: [
      { name: 'From Filter', type: 'text', value: '' },
      { name: 'Subject Filter', type: 'text', value: '' }
    ]
  },
  {
    id: 'slack-notify',
    name: 'Slack Notifier',
    version: '1.0.0',
    category: 'output',
    chromosomes: {
      trigger: { patterns: [], filters: [] },
      action: {
        operations: [{ type: 'send', config: { channel: '#general' } }]
      },
      behavior: {
        rateLimit: { max: 50, window: '1m' },
        retryPolicy: { maxRetries: 5, backoff: 'linear' }
      }
    },
    inputs: [
      { name: 'Message', type: 'data', dataType: 'string', isInput: true },
      { name: 'Image', type: 'data', dataType: 'stream', isInput: true }
    ],
    outputs: [
      { name: 'Sent', type: 'data', dataType: 'boolean', isInput: false }
    ],
    parameters: [
      { name: 'Channel', type: 'text', value: '#dev' },
      { name: 'Mention Team', type: 'toggle', value: false }
    ]
  },
  {
    id: 'text-processor',
    name: 'Text Processor',
    version: '1.0.0',
    category: 'process',
    chromosomes: {
      trigger: { patterns: [], filters: [] },
      action: {
        operations: [
          { type: 'transform', config: { mode: 'extract' } }
        ]
      },
      behavior: {
        rateLimit: { max: 1000, window: '1m' },
        retryPolicy: { maxRetries: 2, backoff: 'fixed' }
      }
    },
    inputs: [
      { name: 'Input Text', type: 'data', dataType: 'string', isInput: true },
      { name: 'Pattern', type: 'data', dataType: 'string', isInput: true }
    ],
    outputs: [
      { name: 'Output Text', type: 'data', dataType: 'string', isInput: false },
      { name: 'Error Message', type: 'data', dataType: 'string', isInput: false }
    ],
    parameters: [
      { name: 'Mode', type: 'select', value: 'extract', options: ['extract', 'replace', 'split'] },
      { name: 'Case Sensitive', type: 'toggle', value: true }
    ]
  },
  {
    id: 'summarize',
    name: 'Summarizer',
    version: '1.0.0',
    category: 'process',
    chromosomes: {
      trigger: { patterns: [], filters: [] },
      action: {
        operations: [{ type: 'summarize', config: { maxLength: 200 } }]
      },
      behavior: {
        rateLimit: { max: 50, window: '1m' },
        retryPolicy: { maxRetries: 3, backoff: 'exponential' }
      }
    },
    inputs: [
      { name: 'Text', type: 'data', dataType: 'string', isInput: true }
    ],
    outputs: [
      { name: 'Summary', type: 'data', dataType: 'string', isInput: false }
    ],
    parameters: [
      { name: 'Max Length', type: 'slider', value: 200, range: { min: 50, max: 500 } },
      { name: 'Bullet Points', type: 'toggle', value: false }
    ]
  },
  {
    id: 'if-condition',
    name: 'If Condition',
    version: '1.0.0',
    category: 'logic',
    chromosomes: {
      trigger: { patterns: [], filters: [] },
      action: {
        operations: [{ type: 'branch_if', config: { operator: 'contains' } }]
      },
      behavior: {
        rateLimit: { max: 500, window: '1m' },
        retryPolicy: { maxRetries: 1, backoff: 'fixed' }
      }
    },
    inputs: [
      { name: 'Value', type: 'data', dataType: 'any', isInput: true },
      { name: 'Matcher', type: 'data', dataType: 'string', isInput: true }
    ],
    outputs: [
      { name: 'True Path', type: 'trigger', dataType: 'boolean', isInput: false },
      { name: 'False Path', type: 'trigger', dataType: 'boolean', isInput: false }
    ],
    parameters: [
      { name: 'Operator', type: 'select', value: 'contains', options: ['contains', 'equals', 'regex'] },
      { name: 'Case Sensitive', type: 'toggle', value: false }
    ]
  },
  {
    id: 'router-switch',
    name: 'Router Switch',
    version: '1.0.0',
    category: 'logic',
    chromosomes: {
      trigger: { patterns: [], filters: [] },
      action: {
        operations: [{ type: 'route', config: { strategy: 'first-match' } }]
      },
      behavior: {
        rateLimit: { max: 800, window: '1m' },
        retryPolicy: { maxRetries: 1, backoff: 'fixed' }
      }
    },
    inputs: [
      { name: 'Payload', type: 'data', dataType: 'object', isInput: true }
    ],
    outputs: [
      { name: 'Route A', type: 'trigger', dataType: 'boolean', isInput: false },
      { name: 'Route B', type: 'trigger', dataType: 'boolean', isInput: false },
      { name: 'Fallback', type: 'trigger', dataType: 'boolean', isInput: false }
    ],
    parameters: [
      { name: 'Match Key', type: 'text', value: 'type' },
      { name: 'Default Route', type: 'select', value: 'fallback', options: ['route_a', 'route_b', 'fallback'] }
    ]
  },
  {
    id: 'rss-feed',
    name: 'RSS Feed',
    version: '1.0.0',
    category: 'input',
    chromosomes: {
      trigger: {
        patterns: [{ type: 'schedule', pattern: '0 */6 * * *' }],
        filters: []
      },
      action: {
        operations: [{ type: 'fetch', config: {} }]
      },
      behavior: {
        rateLimit: { max: 10, window: '1h' },
        retryPolicy: { maxRetries: 3, backoff: 'exponential' }
      }
    },
    inputs: [],
    outputs: [
      { name: 'Articles', type: 'data', dataType: 'object', isInput: false }
    ],
    parameters: [
      { name: 'Feed URL', type: 'text', value: '' },
      { name: 'Max Items', type: 'slider', value: 10, range: { min: 1, max: 50 } }
    ]
  },
  {
    id: 'notion-export',
    name: 'Notion Exporter',
    version: '1.0.0',
    category: 'output',
    chromosomes: {
      trigger: { patterns: [], filters: [] },
      action: {
        operations: [{ type: 'create_page', config: {} }]
      },
      behavior: {
        rateLimit: { max: 30, window: '1m' },
        retryPolicy: { maxRetries: 5, backoff: 'exponential' }
      }
    },
    inputs: [
      { name: 'Content', type: 'data', dataType: 'object', isInput: true },
      { name: 'Title', type: 'data', dataType: 'string', isInput: true }
    ],
    outputs: [
      { name: 'Page URL', type: 'data', dataType: 'string', isInput: false }
    ],
    parameters: [
      { name: 'Database ID', type: 'text', value: '' },
      { name: 'Tags', type: 'text', value: '' }
    ]
  }
];

function getPinnedLogicSkillIds(): string[] {
  const configured = process.env.NEXT_PUBLIC_OPENCLAWD_LOGIC_SKILL_IDS?.trim();
  if (!configured) return [];

  return Array.from(
    new Set(
      configured
        .split(',')
        .map((skillId) => skillId.trim())
        .filter(Boolean)
    )
  );
}

function applyPinnedLogicSkillSelection(skills: SkillDefinition[]): SkillDefinition[] {
  const pinnedLogicIds = getPinnedLogicSkillIds();
  if (pinnedLogicIds.length === 0) return skills;

  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const pinnedLogicSkills = pinnedLogicIds
    .map((skillId) => skillById.get(skillId))
    .filter((skill): skill is SkillDefinition => Boolean(skill));

  const nonLogicSkills = skills.filter((skill) => skill.category !== 'logic');
  const availablePinnedIds = new Set(pinnedLogicSkills.map((skill) => skill.id));
  const unresolvedIds = pinnedLogicIds.filter((skillId) => !availablePinnedIds.has(skillId));

  if (unresolvedIds.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('OpenClaw logic skills missing from registry:', unresolvedIds.join(', '));
  }

  return [...nonLogicSkills, ...pinnedLogicSkills];
}

// Helper to create default genome
function createDefaultGenome(skill: SkillDefinition): Genome {
  return {
    id: generateUUID(),
    version: skill.version,
    chromosomes: {
      trigger: skill.chromosomes.trigger,
      action: skill.chromosomes.action,
      behavior: skill.chromosomes.behavior,
      metadata: {
        name: skill.name,
        description: '',
        tags: [],
      }
    },
    mutations: [],
    fitness: {
      overall: 50,
      components: {
        reliability: 50,
        efficiency: 50,
        utility: 50,
        satisfaction: 50,
        adaptability: 50
      }
    }
  };
}

// Helper to create module from skill
function createModuleFromSkill(skill: SkillDefinition, position: Point): Module {
  return {
    id: generateUUID(),
    skillId: skill.id,
    genome: createDefaultGenome(skill),
    position,
    inputs: skill.inputs.map(input => ({
      ...input,
      id: generateUUID(),
      connectedTo: []
    })),
    outputs: skill.outputs.map(output => ({
      ...output,
      id: generateUUID(),
      connectedTo: []
    })),
    parameters: skill.parameters.map(param => ({
      ...param,
      id: generateUUID()
    })),
    state: 'idle',
    generation: 1,
    parentIds: []
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createHistorySnapshot(
  state: Pick<AppState, 'patches' | 'runtimeEventMemory' | 'currentPatchId' | 'selectedModuleId'>
): HistorySnapshot {
  return {
    patches: deepClone(state.patches),
    runtimeEventMemory: deepClone(state.runtimeEventMemory),
    currentPatchId: state.currentPatchId,
    selectedModuleId: state.selectedModuleId,
  };
}

function addActivity(patch: Patch, action: string, status: ActivityEvent['status'] = 'INFO') {
  if (!patch.activityLog) {
    patch.activityLog = [];
  }

  patch.activityLog.unshift({
    id: generateUUID(),
    timestamp: Date.now(),
    action,
    status,
    patchName: patch.name,
  });

  if (patch.activityLog.length > 100) {
    patch.activityLog = patch.activityLog.slice(0, 100);
  }
}

function addRuntimeEventMemory(
  runtimeEventMemory: Record<string, RhizomeRuntimeEvent[]>,
  patchId: string,
  event: RuntimeModuleEvent
) {
  if (!runtimeEventMemory[patchId]) {
    runtimeEventMemory[patchId] = [];
  }

  runtimeEventMemory[patchId].unshift({
    id: generateUUID(),
    patchId,
    moduleId: event.moduleId,
    timestamp: Date.now(),
    executionState: event.executionState,
    triggerActive: event.triggerActive,
    lastExecutionSuccess: event.lastExecutionSuccess,
  });

  if (runtimeEventMemory[patchId].length > 220) {
    runtimeEventMemory[patchId] = runtimeEventMemory[patchId].slice(0, 220);
  }
}

function toModuleState(executionState?: RuntimeModuleEvent['executionState']): Module['state'] | undefined {
  if (!executionState) return undefined;
  if (executionState === 'mutating') return 'mutating';
  return executionState;
}

function applyRuntimeEventToPatch(patch: Patch, event: RuntimeModuleEvent): boolean {
  const module = patch.modules.find((candidate) => candidate.id === event.moduleId);
  if (!module) return false;

  if (event.executionState) {
    module.executionState = event.executionState;
    const nextState = toModuleState(event.executionState);
    if (nextState) {
      module.state = nextState;
    }
  }
  if (typeof event.triggerActive === 'boolean') {
    module.triggerActive = event.triggerActive;
  }
  if (typeof event.lastExecutionSuccess === 'boolean') {
    module.lastExecutionSuccess = event.lastExecutionSuccess;
  }

  patch.updatedAt = Date.now();
  return true;
}

function normalizeImportedPatch(candidate: any): Patch {
  const now = Date.now();
  const safeFitness: FitnessScore = {
    overall: Number(candidate?.fitness?.overall ?? 0),
    components: {
      reliability: Number(candidate?.fitness?.components?.reliability ?? 0),
      efficiency: Number(candidate?.fitness?.components?.efficiency ?? 0),
      utility: Number(candidate?.fitness?.components?.utility ?? 0),
      satisfaction: Number(candidate?.fitness?.components?.satisfaction ?? 0),
      adaptability: Number(candidate?.fitness?.components?.adaptability ?? 0),
    },
  };

  return {
    id: generateUUID(),
    name: String(candidate?.name || 'IMPORTED_PATCH').toUpperCase(),
    description: String(candidate?.description || ''),
    modules: Array.isArray(candidate?.modules) ? candidate.modules : [],
    connections: Array.isArray(candidate?.connections) ? candidate.connections : [],
    activityLog: Array.isArray(candidate?.activityLog) ? candidate.activityLog : [],
    generation: Number(candidate?.generation ?? 1),
    evolutionHistory: Array.isArray(candidate?.evolutionHistory) ? candidate.evolutionHistory : [],
    fitness: safeFitness,
    isRunning: Boolean(candidate?.isRunning),
    createdAt: Number(candidate?.createdAt ?? now),
    updatedAt: Number(candidate?.updatedAt ?? now),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    immer((set, get) => ({
    // Initial state
    currentView: 'workflowCanvas',
    patches: {},
    currentPatchId: null,
    selectedModuleId: null,
    runtimeEventMemory: {},
    undoStack: [],
    redoStack: [],
    skillLibrary: defaultSkills,
    hasHydrated: false,

    // View actions
    setView: (view) => set({ currentView: view }),
    undo: () => {
      set((state) => {
        if (state.undoStack.length === 0) return;
        const previous = state.undoStack[state.undoStack.length - 1];
        const current = createHistorySnapshot(state);

        state.undoStack = state.undoStack.slice(0, -1);
        state.redoStack.push(current);
        state.patches = previous.patches;
        state.runtimeEventMemory = previous.runtimeEventMemory;
        state.currentPatchId = previous.currentPatchId;
        state.selectedModuleId = previous.selectedModuleId;
      });
    },
    redo: () => {
      set((state) => {
        if (state.redoStack.length === 0) return;
        const next = state.redoStack[state.redoStack.length - 1];
        const current = createHistorySnapshot(state);

        state.redoStack = state.redoStack.slice(0, -1);
        state.undoStack.push(current);
        state.patches = next.patches;
        state.runtimeEventMemory = next.runtimeEventMemory;
        state.currentPatchId = next.currentPatchId;
        state.selectedModuleId = next.selectedModuleId;
      });
    },
    canUndo: () => get().undoStack.length > 0,
    canRedo: () => get().redoStack.length > 0,
    setHasHydrated: (state) => set({ hasHydrated: state }),

    // Patch actions
    createPatch: (name, description = '') => {
      const patch: Patch = {
        id: generateUUID(),
        name,
        description,
        modules: [],
        connections: [],
        activityLog: [],
        generation: 1,
        evolutionHistory: [],
        fitness: {
          overall: 0,
          components: {
            reliability: 0,
            efficiency: 0,
            utility: 0,
            satisfaction: 0,
            adaptability: 0
          }
        },
        isRunning: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        state.patches[patch.id] = patch;
        state.runtimeEventMemory[patch.id] = [];
        state.currentPatchId = patch.id;
        addActivity(patch, 'PATCH_CREATED', 'SUCCESS');
      });

      return patch;
    },
    clonePatch: (patchId) => {
      const sourcePatch = get().patches[patchId];
      if (!sourcePatch) return null;

      const moduleIdMap = new Map<string, string>();
      const portIdMap = new Map<string, string>();

      const clonedModules: Module[] = sourcePatch.modules.map((module) => {
        const clonedModule = deepClone(module);
        const newModuleId = generateUUID();
        moduleIdMap.set(module.id, newModuleId);
        clonedModule.id = newModuleId;
        clonedModule.state = 'idle';
        clonedModule.position = {
          x: module.position.x + 40,
          y: module.position.y + 40,
        };

        clonedModule.inputs = module.inputs.map((input) => {
          const newPortId = generateUUID();
          portIdMap.set(input.id, newPortId);
          return {
            ...input,
            id: newPortId,
            connectedTo: [],
          };
        });

        clonedModule.outputs = module.outputs.map((output) => {
          const newPortId = generateUUID();
          portIdMap.set(output.id, newPortId);
          return {
            ...output,
            id: newPortId,
            connectedTo: [],
          };
        });

        return clonedModule;
      });

      const clonedConnections: Connection[] = sourcePatch.connections
        .map((connection) => {
          const fromModuleId = moduleIdMap.get(connection.from.moduleId);
          const toModuleId = moduleIdMap.get(connection.to.moduleId);
          const fromPortId = portIdMap.get(connection.from.portId);
          const toPortId = portIdMap.get(connection.to.portId);

          if (!fromModuleId || !toModuleId || !fromPortId || !toPortId) {
            return null;
          }

          return {
            ...deepClone(connection),
            id: generateUUID(),
            active: false,
            from: { moduleId: fromModuleId, portId: fromPortId },
            to: { moduleId: toModuleId, portId: toPortId },
          };
        })
        .filter((connection): connection is Connection => Boolean(connection));

      for (const connection of clonedConnections) {
        const sourceModule = clonedModules.find((module) => module.id === connection.from.moduleId);
        const targetModule = clonedModules.find((module) => module.id === connection.to.moduleId);

        const sourceOutput = sourceModule?.outputs.find((output) => output.id === connection.from.portId);
        const targetInput = targetModule?.inputs.find((input) => input.id === connection.to.portId);

        if (sourceOutput) sourceOutput.connectedTo.push(connection.id);
        if (targetInput) targetInput.connectedTo.push(connection.id);
      }

      const clonedPatch: Patch = {
        ...deepClone(sourcePatch),
        id: generateUUID(),
        name: `${sourcePatch.name}_COPY`,
        modules: clonedModules,
        connections: clonedConnections,
        activityLog: [],
        isRunning: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set((state) => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        state.patches[clonedPatch.id] = clonedPatch;
        state.runtimeEventMemory[clonedPatch.id] = [];
        state.currentPatchId = clonedPatch.id;
        state.selectedModuleId = null;
        addActivity(clonedPatch, 'PATCH_CLONED', 'SUCCESS');
      });

      return clonedPatch;
    },

    loadPatch: (patchId) => {
      set((state) => {
        state.currentPatchId = patchId;
        const patch = state.patches[patchId];
        if (patch) addActivity(patch, 'PATCH_LOADED');
      });
    },

    updatePatch: (patchId, updates) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          Object.assign(patch, updates);
          patch.updatedAt = Date.now();
        }
      });
    },

    deletePatch: (patchId) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        delete state.patches[patchId];
        delete state.runtimeEventMemory[patchId];
        if (state.currentPatchId === patchId) {
          state.currentPatchId = null;
        }
      });
    },

    // Module actions
    addModule: (patchId, skillId, position) => {
      const skill = get().skillLibrary.find(s => s.id === skillId);
      if (!skill) return;

      const module = createModuleFromSkill(skill, position);

      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          patch.modules.push(module);
          patch.updatedAt = Date.now();
          addActivity(patch, `MODULE_ADDED:${skill.name}`, 'SUCCESS');
        }
      });
    },
    cloneModule: (patchId, moduleId, position) => {
      set((state) => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (!patch) return;

        const sourceModule = patch.modules.find((module) => module.id === moduleId);
        if (!sourceModule) return;

        const clonedModule = deepClone(sourceModule);
        clonedModule.id = generateUUID();
        clonedModule.genome = {
          ...deepClone(sourceModule.genome),
          id: generateUUID(),
        };
        clonedModule.inputs = sourceModule.inputs.map((input) => ({
          ...input,
          id: generateUUID(),
          connectedTo: [],
        }));
        clonedModule.outputs = sourceModule.outputs.map((output) => ({
          ...output,
          id: generateUUID(),
          connectedTo: [],
        }));
        clonedModule.parameters = sourceModule.parameters.map((parameter) => ({
          ...parameter,
          id: generateUUID(),
        }));
        clonedModule.state = 'idle';
        clonedModule.position = position || {
          x: sourceModule.position.x + 220,
          y: sourceModule.position.y + 40,
        };

        patch.modules.push(clonedModule);
        patch.updatedAt = Date.now();
        addActivity(patch, `MODULE_CLONED:${sourceModule.skillId}`, 'SUCCESS');
      });
    },

    removeModule: (patchId, moduleId) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          const removedModule = patch.modules.find(m => m.id === moduleId);
          patch.modules = patch.modules.filter(m => m.id !== moduleId);
          patch.connections = patch.connections.filter(
            c => c.from.moduleId !== moduleId && c.to.moduleId !== moduleId
          );
          patch.updatedAt = Date.now();
          if (removedModule) addActivity(patch, `MODULE_REMOVED:${removedModule.skillId}`, 'WARN');
        }
        if (state.selectedModuleId === moduleId) {
          state.selectedModuleId = null;
        }
      });
    },

    updateModulePosition: (patchId, moduleId, position) => {
      set(state => {
        const patch = state.patches[patchId];
        if (patch) {
          const module = patch.modules.find(m => m.id === moduleId);
          if (module) {
            module.position = position;
          }
        }
      });
    },

    selectModule: (moduleId) => {
      set({ selectedModuleId: moduleId });
    },

    updateModuleGenome: (patchId, moduleId, genome) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          const module = patch.modules.find(m => m.id === moduleId);
          if (module) {
            module.genome = genome;
            module.generation++;
            patch.updatedAt = Date.now();
            addActivity(patch, `GENOME_UPDATED:${module.skillId}`, 'SUCCESS');
          }
        }
      });
    },
    updateModuleMetadata: (patchId, moduleId, name) => {
      set((state) => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (!patch) return;

        const module = patch.modules.find((m) => m.id === moduleId);
        if (!module) return;

        module.genome.chromosomes.metadata = {
          ...module.genome.chromosomes.metadata,
          name: name.trim().toUpperCase(),
        };
        patch.updatedAt = Date.now();
        addActivity(patch, `MODULE_RENAMED:${module.skillId}`, 'SUCCESS');
      });
    },
    setModuleOperationMode: (patchId, moduleId, mode) => {
      set((state) => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (!patch) return;

        const module = patch.modules.find((m) => m.id === moduleId);
        if (!module) return;

        const operations = module.genome.chromosomes.action.operations || [];
        const nextOperations = operations.length > 0
          ? operations.map((operation, index) =>
              index === 0
                ? { ...operation, config: { ...operation.config, mode } }
                : operation
            )
          : [{ type: 'transform', config: { mode } }];

        module.genome.chromosomes.action.operations = nextOperations;
        module.genome.version = incrementVersion(module.genome.version);
        patch.updatedAt = Date.now();
        addActivity(patch, `MODE_SET:${mode.toUpperCase()}`, 'SUCCESS');
      });
    },
    updateModuleParameter: (patchId, moduleId, parameterId, value) => {
      set((state) => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (!patch) return;

        const module = patch.modules.find((m) => m.id === moduleId);
        if (!module) return;

        const parameter = module.parameters.find((p) => p.id === parameterId);
        if (!parameter) return;

        parameter.value = value;
        patch.updatedAt = Date.now();
        addActivity(patch, `PARAM_UPDATED:${parameter.name}`, 'INFO');
      });
    },

    // Connection actions
    createConnection: (patchId, from, to) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (!patch) return;

        // Check if connection already exists
        const exists = patch.connections.some(
          c => c.to.moduleId === to.moduleId && c.to.portId === to.portId
        );
        if (exists) return;

        const connection: Connection = {
          id: generateUUID(),
          from,
          to,
          type: 'data',
          active: true
        };

        patch.connections.push(connection);

        // Update port connections
        const sourceModule = patch.modules.find(m => m.id === from.moduleId);
        const targetModule = patch.modules.find(m => m.id === to.moduleId);
        
        if (sourceModule && targetModule) {
          const outputPort = sourceModule.outputs.find(o => o.id === from.portId);
          const inputPort = targetModule.inputs.find(i => i.id === to.portId);
          
          if (outputPort) outputPort.connectedTo.push(connection.id);
          if (inputPort) inputPort.connectedTo.push(connection.id);
        }

        patch.updatedAt = Date.now();
        addActivity(patch, 'CONNECTION_CREATED', 'SUCCESS');
      });
    },

    removeConnection: (patchId, connectionId) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          const connection = patch.connections.find(c => c.id === connectionId);
          if (connection) {
            // Remove from port connections
            const sourceModule = patch.modules.find(m => m.id === connection.from.moduleId);
            const targetModule = patch.modules.find(m => m.id === connection.to.moduleId);
            
            if (sourceModule) {
              const outputPort = sourceModule.outputs.find(o => o.id === connection.from.portId);
              if (outputPort) {
                outputPort.connectedTo = outputPort.connectedTo.filter(id => id !== connectionId);
              }
            }
            if (targetModule) {
              const inputPort = targetModule.inputs.find(i => i.id === connection.to.portId);
              if (inputPort) {
                inputPort.connectedTo = inputPort.connectedTo.filter(id => id !== connectionId);
              }
            }
          }
          
          patch.connections = patch.connections.filter(c => c.id !== connectionId);
          patch.updatedAt = Date.now();
          addActivity(patch, 'CONNECTION_REMOVED', 'WARN');
        }
      });
    },

    // Execution
    executePatch: (patchId) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          patch.isRunning = true;
          patch.modules.forEach(m => m.state = 'running');
          addActivity(patch, 'PATCH_EXECUTE_STARTED', 'INFO');
        }
      });

      const patchSnapshot = get().patches[patchId];
      if (!patchSnapshot) return;

      void (async () => {
        const result = await openclawdClient.executePatch(deepClone(patchSnapshot));
        if (result.ok) {
          set((state) => {
            const patch = state.patches[patchId];
            if (!patch) return;

            patch.isRunning = false;
            patch.modules.forEach((module) => {
              const nextState = result.data.moduleStates?.[module.id];
              module.state = nextState || 'idle';
            });

            if (result.data.fitness) {
              patch.fitness = result.data.fitness;
            } else {
              patch.fitness.overall = Math.min(100, patch.fitness.overall + 5);
            }

            if (result.data.patch) {
              Object.assign(patch, result.data.patch);
            }

            patch.updatedAt = Date.now();
            addActivity(patch, 'PATCH_EXECUTE_COMPLETED', 'SUCCESS');
          });
          return;
        }

        // Fallback behavior keeps local demo flow usable if integration is unavailable.
        setTimeout(() => {
          set(state => {
            const patch = state.patches[patchId];
            if (patch) {
              patch.isRunning = false;
              patch.modules.forEach(m => m.state = 'idle');
              patch.fitness.overall = Math.min(100, patch.fitness.overall + 5);
              patch.updatedAt = Date.now();
              addActivity(patch, `PATCH_EXECUTE_FALLBACK:${result.error}`, 'WARN');
            }
          });
        }, 2000);
      })();
    },

    stopPatch: (patchId) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          patch.isRunning = false;
          patch.modules.forEach(m => m.state = 'idle');
          patch.updatedAt = Date.now();
          addActivity(patch, 'PATCH_STOPPED', 'WARN');
        }
      });

      void openclawdClient.stopPatch(patchId);
    },

    // Evolution
    evolvePatch: (patchId, strategy) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          patch.generation++;
          patch.evolutionHistory.push({
            timestamp: Date.now(),
            generation: patch.generation,
            strategy,
            parentPatch: patchId,
            changes: []
          });
          patch.fitness.overall = Math.min(100, patch.fitness.overall + Math.floor(Math.random() * 10));
          patch.updatedAt = Date.now();
          addActivity(patch, `EVOLUTION:${strategy.toUpperCase()}`, 'SUCCESS');
        }
      });

      const patchSnapshot = get().patches[patchId];
      if (!patchSnapshot) return;

      void (async () => {
        const result = await openclawdClient.evolvePatch({
          patchId,
          strategy,
          patch: deepClone(patchSnapshot),
        });

        if (!result.ok) {
          set((state) => {
            const patch = state.patches[patchId];
            if (!patch) return;
            addActivity(patch, `EVOLUTION_SYNC_FAILED:${result.error}`, 'WARN');
          });
          return;
        }

        set(state => {
          const patch = state.patches[patchId];
          if (patch) {
            if (typeof result.data.generation === 'number') {
              patch.generation = Math.max(patch.generation, result.data.generation);
            }
            if (result.data.fitness) {
              patch.fitness = result.data.fitness;
            }
            if (Array.isArray(result.data.changes) && patch.evolutionHistory.length > 0) {
              patch.evolutionHistory[patch.evolutionHistory.length - 1].changes = result.data.changes;
            }
            patch.updatedAt = Date.now();
            addActivity(patch, `EVOLUTION_SYNCED:${strategy.toUpperCase()}`, 'INFO');
          }
        });
      })();
    },

    mutateModule: (patchId, moduleId, type, intensity) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          const module = patch.modules.find(m => m.id === moduleId);
          if (module) {
            module.genome.mutations.push({
              timestamp: Date.now(),
              type: type as any,
              changes: [{ operation: 'mutate', from: module.genome.id }],
              parentGenomes: [module.genome.id]
            });
            module.genome.version = incrementVersion(module.genome.version);
            module.generation++;
            module.genome.fitness.overall = Math.min(100, module.genome.fitness.overall + Math.floor(Math.random() * 10));
            patch.updatedAt = Date.now();
            addActivity(patch, `MODULE_MUTATED:${module.skillId}:${Math.round(intensity * 100)}%`, 'SUCCESS');
          }
        }
      });

      const patchSnapshot = get().patches[patchId];
      const moduleSnapshot = patchSnapshot?.modules.find((module) => module.id === moduleId);
      if (!patchSnapshot || !moduleSnapshot) return;

      void (async () => {
        const result = await openclawdClient.mutateGenome({
          patchId,
          moduleId,
          type,
          intensity,
          genome: deepClone(moduleSnapshot.genome),
        });

        if (!result.ok) {
          set((state) => {
            const patch = state.patches[patchId];
            if (!patch) return;
            addActivity(patch, `MUTATION_SYNC_FAILED:${result.error}`, 'WARN');
          });
          return;
        }

        set((state) => {
          const patch = state.patches[patchId];
          if (!patch) return;
          const module = patch.modules.find((candidate) => candidate.id === moduleId);
          if (!module) return;

          if (result.data.genome) {
            module.genome = result.data.genome;
          }
          if (result.data.fitness) {
            patch.fitness = result.data.fitness;
          }

          patch.updatedAt = Date.now();
          addActivity(patch, `MUTATION_SYNCED:${module.skillId}`, 'INFO');
        });
      })();
    },

    breedModules: (patchId, moduleAId, moduleBId) => {
      set(state => {
        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        const patch = state.patches[patchId];
        if (patch) {
          const moduleA = patch.modules.find(m => m.id === moduleAId);
          const moduleB = patch.modules.find(m => m.id === moduleBId);
          
          if (moduleA && moduleB) {
            // Create child genome
            const childGenome: Genome = {
              id: generateUUID(),
              version: '1.0.0',
              chromosomes: {
                trigger: Math.random() > 0.5 ? moduleA.genome.chromosomes.trigger : moduleB.genome.chromosomes.trigger,
                action: Math.random() > 0.5 ? moduleA.genome.chromosomes.action : moduleB.genome.chromosomes.action,
                behavior: Math.random() > 0.5 ? moduleA.genome.chromosomes.behavior : moduleB.genome.chromosomes.behavior,
                metadata: {
                  name: `${moduleA.genome.chromosomes.metadata?.name || 'A'}_X_${moduleB.genome.chromosomes.metadata?.name || 'B'}`,
                  description: 'Bred from parents',
                  tags: []
                }
              },
              mutations: [{
                timestamp: Date.now(),
                type: 'bred',
                changes: [{ operation: 'breed', from: moduleA.id, to: moduleB.id }],
                parentGenomes: [moduleA.genome.id, moduleB.genome.id]
              }],
              fitness: {
                overall: Math.floor((moduleA.genome.fitness.overall + moduleB.genome.fitness.overall) / 2),
                components: {
                  reliability: Math.floor((moduleA.genome.fitness.components.reliability + moduleB.genome.fitness.components.reliability) / 2),
                  efficiency: Math.floor((moduleA.genome.fitness.components.efficiency + moduleB.genome.fitness.components.efficiency) / 2),
                  utility: Math.floor((moduleA.genome.fitness.components.utility + moduleB.genome.fitness.components.utility) / 2),
                  satisfaction: Math.floor((moduleA.genome.fitness.components.satisfaction + moduleB.genome.fitness.components.satisfaction) / 2),
                  adaptability: Math.floor((moduleA.genome.fitness.components.adaptability + moduleB.genome.fitness.components.adaptability) / 2)
                }
              }
            };

            // Update module A with child genome
            moduleA.genome = childGenome;
            moduleA.generation = Math.max(moduleA.generation, moduleB.generation) + 1;
            moduleA.parentIds = [moduleAId, moduleBId];
            patch.updatedAt = Date.now();
            addActivity(patch, `MODULES_BRED:${moduleA.skillId}+${moduleB.skillId}`, 'SUCCESS');
          }
        }
      });

      const patchSnapshot = get().patches[patchId];
      const moduleA = patchSnapshot?.modules.find((module) => module.id === moduleAId);
      const moduleB = patchSnapshot?.modules.find((module) => module.id === moduleBId);
      if (!patchSnapshot || !moduleA || !moduleB) return;

      void (async () => {
        const result = await openclawdClient.breedGenomes({
          patchId,
          moduleAId,
          moduleBId,
          genomeA: deepClone(moduleA.genome),
          genomeB: deepClone(moduleB.genome),
        });

        if (!result.ok) {
          set((state) => {
            const patch = state.patches[patchId];
            if (!patch) return;
            addActivity(patch, `BREED_SYNC_FAILED:${result.error}`, 'WARN');
          });
          return;
        }

        set((state) => {
          const patch = state.patches[patchId];
          if (!patch) return;
          const targetModule = patch.modules.find((candidate) => candidate.id === moduleAId);
          if (!targetModule) return;

          if (result.data.genome) {
            targetModule.genome = result.data.genome;
          }

          patch.updatedAt = Date.now();
          addActivity(patch, `BREED_SYNCED:${targetModule.skillId}`, 'INFO');
        });
      })();
    },

    loadSkillLibrary: () => {
      set({ skillLibrary: defaultSkills });
      void (async () => {
        const result = await openclawdClient.listSkills();
        if (!result.ok || result.data.length === 0) return;

        const filteredSkills = applyPinnedLogicSkillSelection(result.data);
        set((state) => {
          state.skillLibrary = filteredSkills;
        });
      })();
    },
    initializeRuntimeEvents: () => {
      if (runtimeEventsUnsubscribe) return;
      runtimeEventsUnsubscribe = openclawdClient.subscribeRuntimeEvents((event) => {
        set((state) => {
          if (event.patchId) {
            const patch = state.patches[event.patchId];
            if (patch) {
              const applied = applyRuntimeEventToPatch(patch, event);
              if (applied) {
                addRuntimeEventMemory(state.runtimeEventMemory, patch.id, event);
              }
            }
            return;
          }

          Object.values(state.patches).forEach((patch) => {
            const applied = applyRuntimeEventToPatch(patch, event);
            if (applied) {
              addRuntimeEventMemory(state.runtimeEventMemory, patch.id, event);
            }
          });
        });
      });
    },
    clearRuntimeEventMemory: (patchId) => {
      set((state) => {
        state.runtimeEventMemory[patchId] = [];
      });
    },
    importRhizomeMarkdownMemory: (patchId, markdown, options) => {
      const patch = get().patches[patchId];
      if (!patch) {
        return {
          ok: false,
          importedActivity: 0,
          importedRuntime: 0,
          error: 'Patch not found',
        };
      }

      const trimmed = markdown.trim();
      if (!trimmed) {
        return {
          ok: false,
          importedActivity: 0,
          importedRuntime: 0,
          error: 'Markdown input is empty',
        };
      }

      const migrated = migrateMarkdownToRhizome(trimmed, patch);
      const replace = Boolean(options?.replace);

      set((state) => {
        const draftPatch = state.patches[patchId];
        if (!draftPatch) return;

        state.undoStack.push(createHistorySnapshot(state));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];

        const nextActivity = replace
          ? migrated.activityEvents
          : [...migrated.activityEvents, ...(draftPatch.activityLog || [])];
        draftPatch.activityLog = nextActivity.slice(0, 100);

        const nextRuntime = replace
          ? migrated.runtimeEvents
          : [...migrated.runtimeEvents, ...(state.runtimeEventMemory[patchId] || [])];
        state.runtimeEventMemory[patchId] = nextRuntime.slice(0, 220);

        draftPatch.updatedAt = Date.now();
        addActivity(
          draftPatch,
          `RHIZOME_MD_IMPORTED:A${migrated.activityEvents.length}:R${migrated.runtimeEvents.length}`,
          'SUCCESS'
        );
      });

      return {
        ok: true,
        importedActivity: migrated.activityEvents.length,
        importedRuntime: migrated.runtimeEvents.length,
      };
    },
    exportCurrentPatchJSON: () => {
      const state = get();
      if (!state.currentPatchId) return null;
      const patch = state.patches[state.currentPatchId];
      if (!patch) return null;
      return JSON.stringify(patch, null, 2);
    },
    importPatchFromJSON: (json) => {
      try {
        const parsed = JSON.parse(json);
        const importedPatch = normalizeImportedPatch(parsed);

        set((state) => {
          state.undoStack.push(createHistorySnapshot(state));
          if (state.undoStack.length > 50) state.undoStack.shift();
          state.redoStack = [];
          state.patches[importedPatch.id] = importedPatch;
          state.runtimeEventMemory[importedPatch.id] = [];
          state.currentPatchId = importedPatch.id;
          state.selectedModuleId = importedPatch.modules[0]?.id ?? null;
          addActivity(importedPatch, 'PATCH_IMPORTED', 'SUCCESS');
        });

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Invalid JSON',
        };
      }
    }
  })),
  {
    name: 'clawdular-genome-studio-state',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      patches: state.patches,
      currentPatchId: state.currentPatchId,
      selectedModuleId: state.selectedModuleId,
      currentView: state.currentView,
      skillLibrary: state.skillLibrary,
      runtimeEventMemory: state.runtimeEventMemory,
    }),
    onRehydrateStorage: () => (state) => {
      if (state && (state.currentView as unknown as string) === 'patchbay') {
        state.setView('workflowCanvas');
      }
      if (state && (state.currentView as unknown as string) === 'connectome') {
        state.setView('rhizome');
      }
      state?.setHasHydrated(true);
    },
  }
  )
);
