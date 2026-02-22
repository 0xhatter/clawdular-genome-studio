import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { SimulacraSnapshot } from '@/modules/simulacra/types';
import { createSeedEcosystem } from '@/modules/simulacra/services/simulacraService';

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

  constructor() {
    this.state = loadState();
  }

  private ensureProject(projectId: string): SimulacraSnapshot {
    const existing = this.state.projects[projectId];
    if (existing) {
      return existing;
    }

    const seeded: SimulacraSnapshot = {
      projectId,
      ...createSeedEcosystem(projectId),
    };

    this.state.projects[projectId] = seeded;
    saveState(this.state);

    return seeded;
  }

  getSnapshot(projectId: string): SimulacraSnapshot {
    return cloneSnapshot(this.ensureProject(projectId));
  }

  setSnapshot(projectId: string, snapshot: SimulacraSnapshot): SimulacraSnapshot {
    this.state.projects[projectId] = cloneSnapshot(snapshot);
    saveState(this.state);
    return this.getSnapshot(projectId);
  }

  updateSnapshot(
    projectId: string,
    updater: (snapshot: SimulacraSnapshot) => SimulacraSnapshot
  ): SimulacraSnapshot {
    const current = this.getSnapshot(projectId);
    const next = updater(current);
    return this.setSnapshot(projectId, next);
  }
}

let singleton: SimulacraStore | null = null;

export function getSimulacraStore(): SimulacraStore {
  if (!singleton) {
    singleton = new SimulacraStore();
  }
  return singleton;
}
