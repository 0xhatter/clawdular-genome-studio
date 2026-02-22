import { NextResponse } from 'next/server';
import { getSimulacraStore } from '@/server/simulacra/store';

export const runtime = 'nodejs';

interface Params {
  params: {
    projectId: string;
  };
}

export async function GET(_: Request, { params }: Params) {
  const projectId = params.projectId;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
  }

  try {
    const store = getSimulacraStore();
    const snapshot = store.getSnapshot(projectId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Simulacra load error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
