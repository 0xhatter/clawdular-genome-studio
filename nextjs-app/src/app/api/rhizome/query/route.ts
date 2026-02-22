import { NextResponse } from 'next/server';
import { getRhizomeMemoryManager } from '@/server/rhizome/memory-manager';

export const runtime = 'nodejs';

interface QueryPayload {
  patchId?: string;
  query?: string;
  limit?: number;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json() as QueryPayload;
    if (!payload.patchId || !payload.query) {
      return NextResponse.json({ ok: false, error: 'patchId and query are required' }, { status: 400 });
    }
    const manager = getRhizomeMemoryManager();
    const result = await manager.query(payload.patchId, payload.query, payload.limit || 8);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown query error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
