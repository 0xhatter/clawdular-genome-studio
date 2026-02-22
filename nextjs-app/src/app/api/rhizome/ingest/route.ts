import { NextResponse } from 'next/server';
import { getRhizomeMemoryManager } from '@/server/rhizome/memory-manager';
import type { RhizomeEventInput } from '@/server/rhizome/types';

export const runtime = 'nodejs';

interface IngestPayload {
  patchId?: string;
  events?: RhizomeEventInput[];
}

function isEventInput(value: unknown): value is RhizomeEventInput {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RhizomeEventInput>;
  return (
    typeof candidate.patchId === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.timestamp === 'number'
  );
}

export async function POST(req: Request) {
  try {
    const payload = await req.json() as IngestPayload;
    const events = Array.isArray(payload.events) ? payload.events.filter(isEventInput) : [];
    if (events.length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid events provided' }, { status: 400 });
    }

    const patchId = payload.patchId || events[0].patchId;
    const normalized = events.map((event) => ({
      ...event,
      patchId,
      text: event.text.slice(0, 1200),
    }));

    const manager = getRhizomeMemoryManager();
    const result = await manager.ingestEvents(normalized);
    return NextResponse.json({
      ok: true,
      ingested: result.ingested,
      patchId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingest error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
