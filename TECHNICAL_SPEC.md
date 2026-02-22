# Clawdular Genome Studio - Technical Specification

## Overview
A Skill DNA Sequencer for AI skills that combines visual workflow composition with genetic manipulation (DNA sequencing) to create, evolve, and optimize skill workflows.

---

## Core Architecture

### 1. Three-Layer Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│      (React/Vue UI - Workflow Canvas, Genome Editor)        │
├─────────────────────────────────────────────────────────────┤
│                    ORCHESTRATION LAYER                       │
│    (Node.js/Python - Module Manager, Evolution Engine)      │
├─────────────────────────────────────────────────────────────┤
│                      SKILL LAYER                             │
│         (OpenClaw Skills - Existing + Genome-Enabled)       │
├─────────────────────────────────────────────────────────────┤
│                      RUNTIME LAYER                           │
│              (Execution Engine - Event-Driven)              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Data Models

#### Module (Skill Instance)
```typescript
interface Module {
  id: string;                    // Unique instance ID
  skillId: string;               // Reference to base skill
  genome: Genome;                // Genetic configuration
  position: { x: number; y: number };  // Canvas position
  inputs: Port[];                // Input jacks
  outputs: Port[];               // Output jacks
  parameters: Parameter[];       // Control knobs
  state: 'idle' | 'running' | 'error' | 'evolving';
  generation: number;            // Evolution generation
  parentIds: string[];           // Parent modules (if bred)
}

interface Port {
  id: string;
  name: string;
  type: 'data' | 'trigger' | 'control';
  dataType: 'string' | 'number' | 'object' | 'stream' | 'any';
  connectedTo: string[];         // Connected port IDs
}

interface Parameter {
  id: string;
  name: string;
  type: 'knob' | 'slider' | 'toggle' | 'select' | 'text';
  value: any;
  range?: { min: number; max: number };
  options?: string[];
}
```

#### Genome (Skill DNA)
```typescript
interface Genome {
  id: string;
  version: string;
  chromosomes: {
    trigger: TriggerChromosome;
    action: ActionChromosome;
    behavior: BehaviorChromosome;
    metadata: MetadataChromosome;
  };
  mutations: Mutation[];         // Mutation history
  fitness: FitnessScore;
}

interface TriggerChromosome {
  patterns: TriggerPattern[];
  filters: Filter[];
  scheduling?: ScheduleConfig;
}

interface ActionChromosome {
  operations: Operation[];
  transformations: Transform[];
  outputFormat: OutputConfig;
}

interface BehaviorChromosome {
  rateLimit: RateLimitConfig;
  retryPolicy: RetryConfig;
  errorHandling: ErrorConfig;
  caching: CacheConfig;
}

interface Mutation {
  timestamp: number;
  type: 'parameter' | 'structural' | 'spliced' | 'bred';
  changes: Change[];
  parentGenomes?: string[];
}
```

#### Patch (Workflow)
```typescript
interface Patch {
  id: string;
  name: string;
  description: string;
  modules: Module[];
  connections: Connection[];
  generation: number;
  evolutionHistory: EvolutionEvent[];
  fitness: FitnessScore;
  isRunning: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Connection {
  id: string;
  from: { moduleId: string; portId: string };
  to: { moduleId: string; portId: string };
  type: 'data' | 'trigger' | 'feedback';
  active: boolean;
}
```

---

## Key Components

### 1. Module Registry
```typescript
class ModuleRegistry {
  private skills: Map<string, SkillDefinition>;
  
  // Register a skill as a genome-enabled module
  registerSkill(skill: SkillDefinition): void;
  
  // Extract genome from existing skill
  extractGenome(skillId: string): Genome;
  
  // Create module instance from skill
  createModule(skillId: string, position: Point): Module;
  
  // Get compatible ports between two modules
  getCompatiblePorts(source: Module, target: Module): PortPair[];
}
```

### 2. Patch Engine
```typescript
class PatchEngine {
  private patches: Map<string, Patch>;
  private eventBus: EventBus;
  
  // Create new patch
  createPatch(name: string): Patch;
  
  // Add module to patch
  addModule(patchId: string, module: Module): void;
  
  // Connect two ports
  connect(patchId: string, from: PortRef, to: PortRef): Connection;
  
  // Execute patch
  execute(patchId: string): ExecutionContext;
  
  // Hot-swap module during execution
  hotSwap(patchId: string, oldModuleId: string, newModule: Module): void;
}
```

### 3. Genome Engine
```typescript
class GenomeEngine {
  // Extract genome from module
  extract(module: Module): Genome;
  
  // Splice chromosomes between genomes
  splice(source: Genome, target: Genome, chromosomes: string[]): Genome;
  
  // Breed two genomes
  breed(parentA: Genome, parentB: Genome, strategy: BreedStrategy): Genome;
  
  // Apply mutation
  mutate(genome: Genome, type: MutationType, intensity: number): Genome;
  
  // Clone genome
  clone(genome: Genome): Genome;
  
  // Calculate fitness
  calculateFitness(genome: Genome, metrics: Metrics): FitnessScore;
}
```

### 4. Evolution Engine
```typescript
class EvolutionEngine {
  private generations: Generation[];
  
  // Evolve patch to next generation
  evolve(patch: Patch, strategy: EvolutionStrategy): Patch;
  
  // Auto-breed based on usage patterns
  autoBreed(patch: Patch, patterns: UsagePattern[]): Patch;
  
  // A/B test two variants
  abTest(variantA: Patch, variantB: Patch, duration: number): TestResult;
  
  // Select best from population
  selectBest(population: Patch[], criteria: SelectionCriteria): Patch;
  
  // Rollback to previous generation
  rollback(patch: Patch, generations: number): Patch;
}
```

---

## Execution Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trigger   │────▶│   Module A  │────▶│   Module B  │
│  (Webhook)  │     │  (Process)  │     │  (Output)   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Event Bus  │
                    │  (RabbitMQ/ │
                    │   Redis)    │
                    └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Module C│  │ Module D│  │ Module E│
        │ (Async) │  │ (Async) │  │ (Async) │
        └─────────┘  └─────────┘  └─────────┘
```

### Event-Driven Architecture
1. **Trigger Event** → Module receives input
2. **Process** → Module executes its genome's action chromosome
3. **Emit** → Module outputs to connected ports
4. **Propagate** → Event bus routes to connected modules
5. **Evolve** → Execution metrics feed back to fitness calculation

---

## Genetic Operations

### 1. Extract
```typescript
// Extract genome from any skill
const gmailGenome = genomeEngine.extract(gmailModule);
// Returns structured DNA with all chromosomes
```

### 2. Splice
```typescript
// Take trigger from Gmail, action from Slack
const hybrid = genomeEngine.splice(
  gmailGenome,
  slackGenome,
  ['trigger']  // Take trigger chromosome from gmail
);
// Result: Gmail trigger + Slack action
```

### 3. Breed
```typescript
// Combine two genomes
const child = genomeEngine.breed(
  gmailGenome,
  calendarGenome,
  { 
    strategy: 'crossover',  // or 'dominant', 'blended'
    selectionRate: 0.5 
  }
);
```

### 4. Mutate
```typescript
// Apply random mutations
const mutant = genomeEngine.mutate(
  genome,
  'parameter',      // type: 'parameter' | 'structural' | 'behavioral'
  0.3               // intensity: 0-1
);
```

---

## Fitness Calculation

```typescript
interface FitnessScore {
  overall: number;           // 0-100
  components: {
    reliability: number;     // Success rate
    efficiency: number;      // Token/speed optimization
    utility: number;         // Usage frequency
    satisfaction: number;    // User ratings
    adaptability: number;    // Error recovery
  };
}

function calculateFitness(patch: Patch): FitnessScore {
  return {
    reliability: patch.executionHistory.successRate * 100,
    efficiency: calculateEfficiencyScore(patch),
    utility: Math.min(patch.usageCount / 100, 1) * 100,
    satisfaction: patch.ratings.average * 20,  // 5-star to 100
    adaptability: patch.errorRecoveryRate * 100
  };
}
```

---

## API Endpoints

```typescript
// Patch Management
POST   /api/patches              // Create new patch
GET    /api/patches              // List all patches
GET    /api/patches/:id          // Get patch details
PUT    /api/patches/:id          // Update patch
DELETE /api/patches/:id          // Delete patch
POST   /api/patches/:id/execute  // Execute patch
POST   /api/patches/:id/stop     // Stop execution

// Module Operations
POST   /api/patches/:id/modules              // Add module
DELETE /api/patches/:id/modules/:moduleId    // Remove module
PUT    /api/patches/:id/modules/:moduleId    // Update module
POST   /api/patches/:id/connections          // Create connection
DELETE /api/patches/:id/connections/:connId  // Remove connection

// Genome Operations
POST   /api/genomes/extract      // Extract genome from module
POST   /api/genomes/splice       // Splice genomes
POST   /api/genomes/breed        // Breed genomes
POST   /api/genomes/mutate       // Mutate genome
POST   /api/genomes/clone        // Clone genome

// Evolution Operations
POST   /api/evolution/evolve     // Evolve patch
POST   /api/evolution/auto-breed // Auto-breed based on patterns
POST   /api/evolution/ab-test    // A/B test variants
POST   /api/evolution/rollback   // Rollback generation
GET    /api/evolution/timeline   // Get evolution history

// Module Registry
GET    /api/registry/skills      // List available skills
GET    /api/registry/skills/:id  // Get skill details
POST   /api/registry/register    // Register new skill
```

---

## Database Schema (PostgreSQL + JSONB)

```sql
-- Patches table
CREATE TABLE patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  canvas_state JSONB NOT NULL,  -- modules, connections, positions
  generation INTEGER DEFAULT 1,
  fitness_score JSONB,
  evolution_history JSONB[],
  is_running BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Genomes table
CREATE TABLE genomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  chromosomes JSONB NOT NULL,
  mutations JSONB[],
  fitness_score JSONB,
  parent_genomes UUID[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Executions table
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id UUID REFERENCES patches(id),
  status VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  metrics JSONB,
  errors JSONB[]
);

-- Evolution events
CREATE TABLE evolution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id UUID REFERENCES patches(id),
  type VARCHAR(50),  -- 'mutate', 'breed', 'splice', 'select'
  parent_ids UUID[],
  changes JSONB,
  fitness_before JSONB,
  fitness_after JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Real-Time Features (WebSocket)

```typescript
// Client connects to patch room
ws.join(`patch:${patchId}`);

// Server broadcasts:
- module:added
- module:removed
- module:updated
- connection:created
- connection:removed
- execution:started
- execution:progress
- execution:completed
- execution:error
- evolution:occurred
- genome:mutated
```

---

## Security Considerations

1. **Sandboxed Execution**: Each module runs in isolated context
2. **Permission Inheritance**: Child genomes inherit parent permissions
3. **Mutation Limits**: Prevent runaway mutations with bounds checking
4. **Audit Trail**: All genetic operations logged
5. **Rollback Safety**: Always preserve working versions

---

## Implementation Phases

### Phase 1: Core (MVP)
- [ ] Module registry with basic skills
- [ ] Visual workflow canvas (drag-drop, connections)
- [ ] Basic genome extraction
- [ ] Simple execution engine

### Phase 2: Genetics
- [ ] Genome editor UI
- [ ] Splice and breed operations
- [ ] Mutation engine
- [ ] Fitness tracking

### Phase 3: Evolution
- [ ] Auto-breeding algorithms
- [ ] A/B testing framework
- [ ] Evolution timeline visualization
- [ ] Community genome sharing

### Phase 4: Advanced
- [ ] Hot-swapping during execution
- [ ] Distributed execution
- [ ] AI-powered evolution suggestions
- [ ] Marketplace for evolved skills

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + D3.js (for workflow canvas) |
| State Management | Zustand + React Query |
| Backend | Node.js + Express / Fastify |
| Database | PostgreSQL + Redis |
| Message Queue | RabbitMQ / Bull Queue |
| WebSockets | Socket.io |
| Container | Docker + Kubernetes |
| Monitoring | Prometheus + Grafana |

---

## Open Questions

1. Should evolved skills be publishable back to Clawhub?
2. How to handle skill version conflicts during breeding?
3. What's the maximum mutation depth before human review required?
4. Should there be a "genome marketplace" for sharing evolved traits?
