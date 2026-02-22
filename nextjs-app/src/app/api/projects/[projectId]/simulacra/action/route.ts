import { NextResponse } from 'next/server';
import type { IdeaNode } from '@/modules/simulacra/types';
import {
  applyAgentCycle,
  applyCreateIdea,
  applyDiscover,
  applyFeed,
  applyPollinate,
  applyTick,
  type SimulacraActionResult,
} from '@/server/simulacra/engine';
import { getSimulacraStore } from '@/server/simulacra/store';

export const runtime = 'nodejs';

interface Params {
  params: {
    projectId: string;
  };
}

type ActionPayload =
  | {
      action: 'createIdea';
      content: string;
      parentId?: string;
      createdBy?: IdeaNode['createdBy'];
    }
  | {
      action: 'feed';
      nodeId: string;
      amount?: number;
    }
  | {
      action: 'tick';
    }
  | {
      action: 'discover';
    }
  | {
      action: 'pollinate';
      parentAId?: string;
      parentBId?: string;
    }
  | {
      action: 'agentCycle';
      mode?: 'explore' | 'expand' | 'synthesize' | 'full';
    };

function isCreatedBy(value: unknown): value is IdeaNode['createdBy'] {
  return value === 'human' || value === 'agent' || value === 'cross-pollination';
}

export async function POST(req: Request, { params }: Params) {
  const projectId = params.projectId;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
  }

  try {
    const payload = await req.json() as Partial<ActionPayload>;
    if (!payload?.action || typeof payload.action !== 'string') {
      return NextResponse.json({ ok: false, error: 'action is required' }, { status: 400 });
    }

    const store = getSimulacraStore();
    const snapshot = store.getSnapshot(projectId);

    let result: SimulacraActionResult;

    switch (payload.action) {
      case 'createIdea': {
        if (typeof payload.content !== 'string' || payload.content.trim().length === 0) {
          return NextResponse.json({ ok: false, error: 'content is required for createIdea' }, { status: 400 });
        }
        result = applyCreateIdea(snapshot, {
          content: payload.content,
          parentId: typeof payload.parentId === 'string' ? payload.parentId : undefined,
          createdBy: isCreatedBy(payload.createdBy) ? payload.createdBy : 'human',
        });
        break;
      }
      case 'feed': {
        if (typeof payload.nodeId !== 'string' || payload.nodeId.length === 0) {
          return NextResponse.json({ ok: false, error: 'nodeId is required for feed' }, { status: 400 });
        }
        result = applyFeed(snapshot, {
          nodeId: payload.nodeId,
          amount: typeof payload.amount === 'number' ? payload.amount : undefined,
        });
        break;
      }
      case 'tick': {
        result = applyTick(snapshot);
        break;
      }
      case 'discover': {
        result = applyDiscover(snapshot);
        break;
      }
      case 'pollinate': {
        result = applyPollinate(snapshot, {
          parentAId: typeof payload.parentAId === 'string' ? payload.parentAId : undefined,
          parentBId: typeof payload.parentBId === 'string' ? payload.parentBId : undefined,
        });
        break;
      }
      case 'agentCycle': {
        result = applyAgentCycle(snapshot, {
          mode: payload.mode,
        });
        break;
      }
      default: {
        return NextResponse.json({ ok: false, error: `Unsupported action: ${payload.action}` }, { status: 400 });
      }
    }

    const saved = store.setSnapshot(projectId, result.snapshot);
    return NextResponse.json({
      ok: true,
      snapshot: saved,
      meta: result.meta || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Simulacra action error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
