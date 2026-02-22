import 'server-only';

import type { ActivityEvent, Module } from '@/types';
import type { RhizomeEventInput } from '@/server/rhizome/types';

function parseTimestamp(line: string, fallback: number): number {
  const bracket = line.match(/\[([^\]]+)\]/)?.[1];
  if (bracket) {
    const parsed = Date.parse(bracket);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const inline = line.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/);
  if (inline?.[0]) {
    const parsed = Date.parse(inline[0].replace(' ', 'T'));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function parseStatus(line: string): ActivityEvent['status'] {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FAILED')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARN';
  if (upper.includes('SUCCESS') || upper.includes('COMPLETED')) return 'SUCCESS';
  return 'INFO';
}

function pickModuleId(line: string, modules: Module[]): string | undefined {
  const hinted = line.match(/module\s*[:=]\s*([a-zA-Z0-9_-]+)/i)?.[1];
  if (hinted) {
    const module = modules.find(
      (candidate) =>
        candidate.id === hinted ||
        candidate.skillId === hinted ||
        (candidate.genome.chromosomes.metadata?.name || '').toLowerCase() === hinted.toLowerCase()
    );
    if (module) return module.id;
  }
  return modules[0]?.id;
}

function inferSource(line: string): RhizomeEventInput['source'] {
  const lower = line.toLowerCase();
  if (lower.includes('runtime') || lower.includes('execution')) return 'runtime';
  if (lower.includes('markdown') || lower.includes('memory')) return 'markdown';
  return 'activity';
}

export function migrateMarkdownToRhizomeEvents(
  patchId: string,
  markdown: string,
  modules: Module[]
): RhizomeEventInput[] {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('```'));

  const now = Date.now();
  const events: RhizomeEventInput[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const timestamp = parseTimestamp(line, now - (lines.length - index) * 1000);
    events.push({
      patchId,
      source: inferSource(line),
      text: line,
      timestamp,
      moduleId: pickModuleId(line, modules),
      status: parseStatus(line),
    });
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}
