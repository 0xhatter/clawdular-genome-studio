import type { ActivityEvent, Module, Patch } from '@/types';
import type { RhizomeRuntimeEvent } from '@/types/rhizome';
import { generateUUID } from '@/lib/utils';

interface RhizomeMigrationResult {
  activityEvents: ActivityEvent[];
  runtimeEvents: RhizomeRuntimeEvent[];
}

function parseTimestamp(line: string, fallbackTimestamp: number): number {
  const bracketMatch = line.match(/\[([^\]]+)\]/);
  if (bracketMatch?.[1]) {
    const parsed = Date.parse(bracketMatch[1]);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const inlineDate = line.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/);
  if (inlineDate?.[0]) {
    const parsed = Date.parse(inlineDate[0].replace(' ', 'T'));
    if (!Number.isNaN(parsed)) return parsed;
  }

  return fallbackTimestamp;
}

function parseStatus(line: string): ActivityEvent['status'] {
  const upper = line.toUpperCase();
  if (/\bERROR\b|\bFAILED\b|\bFAIL\b/.test(upper)) return 'ERROR';
  if (/\bWARN\b|\bWARNING\b/.test(upper)) return 'WARN';
  if (/\bSUCCESS\b|\bCOMPLETED\b|\bDONE\b/.test(upper)) return 'SUCCESS';
  return 'INFO';
}

function normalizeAction(line: string): string {
  const cleaned = line
    .replace(/^\s*[-*]\s*/, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/`/g, '')
    .trim();

  const token = cleaned
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return token || 'RHIZOME_MEMORY_EVENT';
}

function findModuleByHint(modules: Module[], hint: string): Module | null {
  const lowerHint = hint.toLowerCase();
  return (
    modules.find((module) => module.id.toLowerCase() === lowerHint) ||
    modules.find((module) => module.id.toLowerCase().startsWith(lowerHint)) ||
    modules.find((module) => module.skillId.toLowerCase() === lowerHint) ||
    modules.find((module) => module.skillId.toLowerCase().includes(lowerHint)) ||
    modules.find((module) =>
      (module.genome.chromosomes.metadata?.name || '').toLowerCase().includes(lowerHint)
    ) ||
    null
  );
}

function resolveModuleId(modules: Module[], line: string): string | null {
  if (modules.length === 0) return null;

  const hintMatch = line.match(/module\s*[:=]\s*([a-zA-Z0-9_-]+)/i);
  if (hintMatch?.[1]) {
    const resolved = findModuleByHint(modules, hintMatch[1]);
    if (resolved) return resolved.id;
  }

  for (const module of modules) {
    const moduleName = module.genome.chromosomes.metadata?.name || '';
    if (
      line.toLowerCase().includes(module.skillId.toLowerCase()) ||
      (moduleName && line.toLowerCase().includes(moduleName.toLowerCase()))
    ) {
      return module.id;
    }
  }

  return modules[0]?.id || null;
}

function inferExecutionState(line: string): Module['executionState'] | undefined {
  const lower = line.toLowerCase();
  if (lower.includes('mutating')) return 'mutating';
  if (lower.includes('running') || lower.includes('executing')) return 'running';
  if (lower.includes('error') || lower.includes('failed')) return 'error';
  if (lower.includes('idle') || lower.includes('waiting')) return 'idle';
  return undefined;
}

function inferTriggerActive(line: string): boolean | undefined {
  const lower = line.toLowerCase();
  if (lower.includes('trigger active') || lower.includes('triggered') || lower.includes('webhook')) return true;
  if (lower.includes('trigger inactive') || lower.includes('trigger off')) return false;
  return undefined;
}

function inferExecutionSuccess(line: string): boolean | undefined {
  const lower = line.toLowerCase();
  if (lower.includes('success') || lower.includes('completed') || lower.includes('passed')) return true;
  if (lower.includes('failed') || lower.includes('error') || lower.includes('timeout')) return false;
  return undefined;
}

export function migrateMarkdownToRhizome(markdown: string, patch: Patch): RhizomeMigrationResult {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith('```'));

  const activityEvents: ActivityEvent[] = [];
  const runtimeEvents: RhizomeRuntimeEvent[] = [];
  const baseTimestamp = Date.now();
  const modules = patch.modules || [];

  lines.forEach((line, index) => {
    if (line.startsWith('#')) return;

    const fallbackTimestamp = baseTimestamp - (lines.length - index) * 1000;
    const timestamp = parseTimestamp(line, fallbackTimestamp);
    const status = parseStatus(line);
    const action = normalizeAction(line);

    activityEvents.push({
      id: generateUUID(),
      timestamp,
      action,
      status,
      patchName: patch.name,
    });

    const moduleId = resolveModuleId(modules, line);
    const executionState = inferExecutionState(line);
    const triggerActive = inferTriggerActive(line);
    const lastExecutionSuccess = inferExecutionSuccess(line);
    const hasRuntimeSignal =
      Boolean(executionState) || typeof triggerActive === 'boolean' || typeof lastExecutionSuccess === 'boolean';

    if (!moduleId || !hasRuntimeSignal) return;

    runtimeEvents.push({
      id: generateUUID(),
      patchId: patch.id,
      moduleId,
      timestamp,
      executionState,
      triggerActive,
      lastExecutionSuccess,
    });
  });

  return {
    activityEvents: activityEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200),
    runtimeEvents: runtimeEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 400),
  };
}
