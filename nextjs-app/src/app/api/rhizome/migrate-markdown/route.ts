import { NextResponse } from 'next/server';
import type { Module } from '@/types';
import { migrateMarkdownToRhizomeEvents } from '@/server/rhizome/markdown';
import { getRhizomeMemoryManager } from '@/server/rhizome/memory-manager';

export const runtime = 'nodejs';

interface MigratePayload {
  patchId?: string;
  markdown?: string;
  modules?: Module[];
  ingest?: boolean;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json() as MigratePayload;
    if (!payload.patchId || !payload.markdown) {
      return NextResponse.json({ ok: false, error: 'patchId and markdown are required' }, { status: 400 });
    }

    const modules = Array.isArray(payload.modules) ? payload.modules : [];
    const events = migrateMarkdownToRhizomeEvents(payload.patchId, payload.markdown, modules);

    let ingested = 0;
    if (payload.ingest !== false) {
      const manager = getRhizomeMemoryManager();
      const result = await manager.ingestEvents(events);
      ingested = result.ingested;
    }

    return NextResponse.json({
      ok: true,
      patchId: payload.patchId,
      events,
      ingested,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown markdown migration error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
