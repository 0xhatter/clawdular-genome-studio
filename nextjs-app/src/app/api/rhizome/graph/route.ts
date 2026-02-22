import { NextResponse } from 'next/server';
import { getRhizomeMemoryManager } from '@/server/rhizome/memory-manager';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const patchId = url.searchParams.get('patchId');
  const limit = Number(url.searchParams.get('limit') || 240);
  if (!patchId) {
    return NextResponse.json({ ok: false, error: 'patchId is required' }, { status: 400 });
  }
  try {
    const manager = getRhizomeMemoryManager();
    const graph = manager.toGraph(patchId, Number.isFinite(limit) ? limit : 240);
    return NextResponse.json({
      ok: true,
      graph,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown graph error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
