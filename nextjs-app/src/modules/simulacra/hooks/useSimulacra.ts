import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { simulacraClient } from '@/lib/simulacraClient';
import type { IdeaNode, PositionedIdeaNode, SimulacraSnapshot } from '@/modules/simulacra/types';
import { assignNodePositions, createSeedEcosystem } from '@/modules/simulacra/services/simulacraService';

const FALLBACK_PROJECT_ID = 'global-simulacra';

function initialSnapshot(projectId: string): SimulacraSnapshot {
  return {
    projectId,
    ...createSeedEcosystem(projectId),
  };
}

export function useSimulacra() {
  const { currentPatchId } = useAppStore();
  const projectId = currentPatchId || FALLBACK_PROJECT_ID;

  const [snapshot, setSnapshot] = useState<SimulacraSnapshot>(() => initialSnapshot(projectId));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => snapshot.nodes[0]?.id || null);
  const [selectedForPollination, setSelectedForPollination] = useState<string[]>([]);
  const [draftIdea, setDraftIdea] = useState('');
  const [autoCycle, setAutoCycle] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (targetProjectId: string) => {
    setIsSyncing(true);
    const result = await simulacraClient.getSnapshot(targetProjectId);

    if (!result.ok) {
      setLastError(result.error);
      setIsSyncing(false);
      return;
    }

    setSnapshot(result.data.snapshot);
    setSelectedNodeId((prev) => {
      if (prev && result.data.snapshot.nodes.some((node) => node.id === prev)) {
        return prev;
      }
      return result.data.snapshot.nodes[0]?.id || null;
    });
    setLastError(null);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    setSelectedForPollination([]);
    void loadSnapshot(projectId);
  }, [loadSnapshot, projectId]);

  useEffect(() => {
    if (!selectedNodeId && snapshot.nodes.length > 0) {
      setSelectedNodeId(snapshot.nodes[0].id);
      return;
    }

    if (selectedNodeId && !snapshot.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(snapshot.nodes[0]?.id || null);
    }
  }, [selectedNodeId, snapshot.nodes]);

  const positionedNodes = useMemo<PositionedIdeaNode[]>(() => assignNodePositions(snapshot.nodes), [snapshot.nodes]);
  const selectedNode = useMemo(
    () => snapshot.nodes.find((node) => node.id === selectedNodeId) || null,
    [snapshot.nodes, selectedNodeId]
  );

  const ecosystemStats = useMemo(() => {
    const alive = snapshot.nodes.filter((node) => node.status !== 'archived').length;
    const dormant = snapshot.nodes.filter((node) => node.status === 'dormant').length;
    const avgEnergy = snapshot.nodes.length > 0
      ? Math.round(snapshot.nodes.reduce((sum, node) => sum + node.energy.current, 0) / snapshot.nodes.length)
      : 0;

    return {
      nodes: snapshot.nodes.length,
      alive,
      dormant,
      connections: snapshot.connections.length,
      pollinations: snapshot.pollinations.length,
      avgEnergy,
    };
  }, [snapshot]);

  const runAction = useCallback(async (
    payload:
      | { action: 'createIdea'; content: string; parentId?: string; createdBy?: IdeaNode['createdBy'] }
      | { action: 'feed'; nodeId: string; amount?: number }
      | { action: 'tick' }
      | { action: 'discover' }
      | { action: 'pollinate'; parentAId?: string; parentBId?: string }
      | { action: 'agentCycle'; mode?: 'explore' | 'expand' | 'synthesize' | 'full' }
  ) => {
    setIsSyncing(true);
    const result = await simulacraClient.action(projectId, payload);
    if (!result.ok) {
      setLastError(result.error);
      setIsSyncing(false);
      return null;
    }

    setSnapshot(result.data.snapshot);
    setLastError(null);
    setIsSyncing(false);
    return result.data;
  }, [projectId]);

  const createIdea = useCallback(async (content: string, parentId?: string, createdBy: IdeaNode['createdBy'] = 'human') => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const result = await runAction({
      action: 'createIdea',
      content: trimmed,
      parentId,
      createdBy,
    });

    const createdNodeId = result?.meta?.createdNodeId;
    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  }, [runAction]);

  const feedNode = useCallback((nodeId: string, amount = 12) => {
    void runAction({ action: 'feed', nodeId, amount });
  }, [runAction]);

  const runMetabolismTick = useCallback(() => {
    void runAction({ action: 'tick' });
  }, [runAction]);

  const runConnectionDiscovery = useCallback(() => {
    void runAction({ action: 'discover' });
  }, [runAction]);

  const runPollination = useCallback((parentAId?: string, parentBId?: string) => {
    const resolvedParentA = parentAId || selectedForPollination[0];
    const resolvedParentB = parentBId || selectedForPollination[1];

    void (async () => {
      const result = await runAction({
        action: 'pollinate',
        parentAId: resolvedParentA,
        parentBId: resolvedParentB,
      });
      setSelectedForPollination([]);
      if (result?.meta?.offspringNodeId) {
        setSelectedNodeId(result.meta.offspringNodeId);
      }
    })();
  }, [runAction, selectedForPollination]);

  const runAgentCycle = useCallback((mode: 'explore' | 'expand' | 'synthesize' | 'full' = 'full') => {
    void (async () => {
      const result = await runAction({ action: 'agentCycle', mode });
      if (result?.meta?.offspringNodeId) {
        setSelectedNodeId(result.meta.offspringNodeId);
      } else if (result?.meta?.createdNodeId) {
        setSelectedNodeId(result.meta.createdNodeId);
      }
    })();
  }, [runAction]);

  const togglePollinationCandidate = useCallback((nodeId: string) => {
    setSelectedForPollination((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }
      if (prev.length >= 2) {
        return [prev[1], nodeId];
      }
      return [...prev, nodeId];
    });
  }, []);

  const submitDraftIdea = useCallback(() => {
    void createIdea(draftIdea, selectedNodeId || undefined, 'human');
    setDraftIdea('');
  }, [createIdea, draftIdea, selectedNodeId]);

  useEffect(() => {
    if (!autoCycle) return;

    const intervalId = window.setInterval(() => {
      runAgentCycle('full');
    }, 9000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoCycle, runAgentCycle]);

  return {
    projectId,
    snapshot,
    positionedNodes,
    selectedNode,
    selectedNodeId,
    selectedForPollination,
    draftIdea,
    setDraftIdea,
    setSelectedNodeId,
    setSelectedForPollination,
    togglePollinationCandidate,
    createIdea,
    submitDraftIdea,
    feedNode,
    runMetabolismTick,
    runConnectionDiscovery,
    runPollination,
    runAgentCycle,
    autoCycle,
    setAutoCycle,
    ecosystemStats,
    isSyncing,
    lastError,
  };
}
