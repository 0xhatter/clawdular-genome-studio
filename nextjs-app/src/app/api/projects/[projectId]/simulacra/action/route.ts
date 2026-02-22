import { NextResponse } from 'next/server';
import type { SimpleIdeaNode as IdeaNode, SimpleSimulacraSnapshot as SimulacraSnapshot } from '@/modules/simulacra/types-simplified';
import { getSimulacraStore } from '@/server/simulacra/store';

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
      parentIds?: string[];
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

    const store = getSimulacraStore(mockApi);
    const actionHandler = await store.createActionHandler(projectId);

    let result: { snapshot: SimulacraSnapshot; meta?: any };

    switch (payload.action) {
      case 'createIdea': {
        if (typeof payload.content !== 'string' || payload.content.trim().length === 0) {
          return NextResponse.json({ ok: false, error: 'content is required for createIdea' }, { status: 400 });
        }
        const updated = await actionHandler.createIdea({
          content: payload.content,
          parentIds: typeof payload.parentIds === 'object' ? payload.parentIds : undefined,
          createdBy: isCreatedBy(payload.createdBy) ? payload.createdBy : 'human',
        });
        result = { snapshot: updated, meta: { createdNodeId: updated.nodes[updated.nodes.length - 1].id } };
        break;
      }
      case 'feed': {
        if (typeof payload.nodeId !== 'string' || payload.nodeId.length === 0) {
          return NextResponse.json({ ok: false, error: 'nodeId is required for feed' }, { status: 400 });
        }
        const updated = await actionHandler.feedNode(payload.nodeId, typeof payload.amount === 'number' ? payload.amount : undefined);
        result = { snapshot: updated };
        break;
      }
      case 'tick': {
        const updated = await actionHandler.tick();
        result = { snapshot: updated };
        break;
      }
      case 'discover': {
        const updated = await actionHandler.discover();
        result = { snapshot: updated };
        break;
      }
      case 'pollinate': {
        const updated = await actionHandler.pollinate(
          typeof payload.parentAId === 'string' ? payload.parentAId : undefined,
          typeof payload.parentBId === 'string' ? payload.parentBId : undefined,
        );
        result = {
          snapshot: updated,
          meta: { offspringNodeId: updated.nodes[updated.nodes.length - 1].id },
        };
        break;
      }
      case 'agentCycle': {
        const updated = await actionHandler.agentCycle(typeof payload.mode === 'string' ? payload.mode : 'full');
        const meta: any = {};
        const lastNode = updated.nodes[updated.nodes.length - 1];
        if (lastNode && lastNode.createdAt > updated.nodes[updated.nodes.length - 2]?.createdAt) {
          meta.offspringNodeId = lastNode.id;
        }
        result = { snapshot: updated, meta: Object.keys(meta).length > 0 ? meta : undefined };
        break;
      }
      default: {
        return NextResponse.json({ ok: false, error: `Unsupported action: ${payload.action}` }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      snapshot: result.snapshot,
      meta: result.meta || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Simulacra action error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
