import { NextResponse } from 'next/server';
import type { SimpleSimulacraSnapshot as SimulacraSnapshot } from '@/modules/simulacra/types-simplified';
import { getSimulacraStore } from '@/server/simulacra/store';

export const runtime = 'nodejs';

interface Params {
  params: {
    projectId: string;
  };
}

// Need to pass API context for LLM integration
const mockApi = {
  config: {
    agents: {
      defaults: {
        model: {
          primary: process.env.NEXT_PUBLIC_MODEL || 'openai/gpt-4',
        },
      },
    },
  },
};

export async function GET(_: Request, { params }: Params) {
  const projectId = params.projectId;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
  }

  try {
    const store = getSimulacraStore(mockApi);
    const snapshot = await store.getSnapshot(projectId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Simulacra load error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
