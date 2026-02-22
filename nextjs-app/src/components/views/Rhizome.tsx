'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { RHIZOME_CHROMOSOMES, buildRhizomeGraph, layoutRhizomeGraph } from '@/lib/rhizome';
import { rhizomeCortexClient } from '@/lib/rhizomeCortexClient';
import type { RhizomeChromosome, RhizomeEdge, RhizomeLayoutNode } from '@/types/rhizome';
import { cn, getBezierPath } from '@/lib/utils';
import { RhizomeNodeComponent } from './RhizomeNodeComponent';

const CHROMOSOME_OPTIONS: Array<{ id: RhizomeChromosome; label: string }> = [
  { id: 'trigger', label: 'Trigger' },
  { id: 'action', label: 'Action' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'metadata', label: 'Metadata' },
];

// lanes removed as we are using a radial layout now

function edgeColor(edge: RhizomeEdge): string {
  if (edge.type === 'triggered') return '#22d3ee';
  if (edge.type === 'updated') return '#f8fafc';
  if (edge.type === 'caused') return '#737373';
  return '#a3a3a3';
}

export function Rhizome() {
  const {
    patches,
    currentPatchId,
    runtimeEventMemory,
    clearRuntimeEventMemory,
    importRhizomeMarkdownMemory,
  } = useAppStore();
  const [selectedChromosome, setSelectedChromosome] = useState<RhizomeChromosome | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [collapsedChromosomes, setCollapsedChromosomes] = useState<Record<RhizomeChromosome, boolean>>({
    trigger: false,
    action: false,
    behavior: false,
    metadata: false,
  });
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [importReplaceMode, setImportReplaceMode] = useState(false);
  const [markdownInput, setMarkdownInput] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [cortexStatus, setCortexStatus] = useState<string | null>(null);
  const [cortexQuery, setCortexQuery] = useState('');
  const [cortexSummary, setCortexSummary] = useState<string | null>(null);
  const [cortexGraphStats, setCortexGraphStats] = useState<{ nodes: number; edges: number } | null>(null);
  const [nodePositionOverrides, setNodePositionOverrides] = useState<Record<string, { x: number; y: number }>>({});

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Initial pan will be calculated in useEffect
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const suppressCanvasClickRef = useRef(false);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.min(2, Math.max(0.5, Number((prev + direction).toFixed(2)))));
      return;
    }

    event.preventDefault();
    setPan((prev) => ({
      x: prev.x - event.deltaX,
      y: prev.y - event.deltaY,
    }));
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      const panState = panStateRef.current;
      if (!panState) return;

      const nextX = panState.panStartX + (event.clientX - panState.startX);
      const nextY = panState.panStartY + (event.clientY - panState.startY);
      setPan({ x: nextX, y: nextY });
      suppressCanvasClickRef.current = true;
    };

    const handlePointerUp = () => {
      if (!panStateRef.current) return;
      panStateRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, []);

  const currentPatch = currentPatchId ? patches[currentPatchId] : null;
  const runtimeEvents = currentPatchId ? runtimeEventMemory[currentPatchId] || [] : [];

  useEffect(() => {
    setNodePositionOverrides({});
  }, [currentPatchId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const baseGraph = useMemo(() => {
    if (!currentPatch) return null;
    return buildRhizomeGraph(currentPatch, runtimeEvents);
  }, [currentPatch, runtimeEvents, clockTick]);

  const graph = useMemo(() => {
    if (!baseGraph) return null;
    return layoutRhizomeGraph(baseGraph, {
      filterChromosome: selectedChromosome,
      collapsedChromosomes,
    });
  }, [baseGraph, selectedChromosome, collapsedChromosomes]);

  useEffect(() => {
    if (!graph) return;

    setPan({
      x: window.innerWidth / 2 - (graph.canvas.width / 2),
      y: window.innerHeight / 2 - (graph.canvas.height / 2)
    });

    if (!selectedNodeId || !graph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(graph.nodes[0]?.id || null);
    }
  }, [graph?.canvas.width, graph?.canvas.height]); // Only run when graph canvas dimensions change

  useEffect(() => {
    if (!graph) return;
    const visibleNodeIds = new Set(graph.nodes.map((node) => node.id));
    setNodePositionOverrides((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      let changed = false;

      Object.entries(prev).forEach(([nodeId, position]) => {
        if (visibleNodeIds.has(nodeId)) {
          next[nodeId] = position;
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [graph]);

  if (!currentPatch) {
    return (
      <div className="flex-1 bg-bg-primary flex items-center justify-center">
        <div className="text-text-tertiary text-xs uppercase tracking-wide text-center">
          SELECT A WORKFLOW TO VIEW RHIZOME MEMORY
        </div>
      </div>
    );
  }

  if (!graph || !baseGraph) {
    return (
      <div className="flex-1 bg-bg-primary flex items-center justify-center">
        <div className="text-text-tertiary text-xs uppercase tracking-wide text-center">
          RHIZOME GRAPH UNAVAILABLE
        </div>
      </div>
    );
  }

  const positionedNodes = graph.nodes.map((node) => {
    const override = nodePositionOverrides[node.id];
    if (!override) return node;
    return {
      ...node,
      x: override.x,
      y: override.y,
    };
  });

  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;
  const avgFitness = positionedNodes.length > 0
    ? Math.round((positionedNodes.reduce((sum, node) => sum + node.fitness, 0) / positionedNodes.length) * 100)
    : 0;
  const recentEvents = baseGraph.nodes
    .filter((node) => node.type === 'activity' || node.type === 'runtime')
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12);
  const laneCounts = RHIZOME_CHROMOSOMES.reduce<Record<RhizomeChromosome, number>>(
    (acc, chromosome) => {
      acc[chromosome] = baseGraph.nodes.filter((node) => node.chromosome === chromosome && node.type !== 'patch').length;
      return acc;
    },
    {
      trigger: 0,
      action: 0,
      behavior: 0,
      metadata: 0,
    }
  );

  const handleToggleCollapse = (chromosome: RhizomeChromosome) => {
    setCollapsedChromosomes((state) => ({
      ...state,
      [chromosome]: !state[chromosome],
    }));
  };

  const handleSelectRecentEvent = (node: (typeof recentEvents)[number]) => {
    if (collapsedChromosomes[node.chromosome]) {
      setCollapsedChromosomes((state) => ({
        ...state,
        [node.chromosome]: false,
      }));
    }
    setSelectedNodeId(node.id);
  };

  const handleNodeClick = (node: RhizomeLayoutNode) => {
    if (node.type === 'group') {
      setCollapsedChromosomes((state) => ({
        ...state,
        [node.chromosome]: false,
      }));
    }
    setSelectedNodeId(node.id);
  };

  const handleNodePositionChange = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodePositionOverrides((prev) => {
      const current = prev[nodeId];
      if (current && current.x === position.x && current.y === position.y) {
        return prev;
      }
      return {
        ...prev,
        [nodeId]: position,
      };
    });
    suppressCanvasClickRef.current = true;
  }, []);

  const handleImportMarkdown = () => {
    if (!currentPatchId) return;
    setImportMessage(null);
    const result = importRhizomeMarkdownMemory(currentPatchId, markdownInput, { replace: importReplaceMode });
    if (!result.ok) {
      setImportMessage(result.error || 'Import failed');
      return;
    }
    void (async () => {
      const migrated = await rhizomeCortexClient.migrateMarkdown(
        currentPatchId,
        markdownInput,
        currentPatch?.modules || []
      );
      if (!migrated.ok) {
        setImportMessage(`LOCAL IMPORTED A:${result.importedActivity} R:${result.importedRuntime} | CORTEX ERROR`);
        return;
      }
      setImportMessage(`IMPORTED A:${result.importedActivity} R:${result.importedRuntime} | CORTEX:${migrated.data.ingested}`);
    })();
    setMarkdownInput('');
  };

  const handleSyncCortex = () => {
    if (!currentPatch || !currentPatchId) return;
    setCortexStatus('SYNCING...');
    void (async () => {
      const activityEvents = (currentPatch.activityLog || []).slice(0, 80).map((event) => ({
        patchId: currentPatchId,
        source: 'activity' as const,
        text: `${event.action} ${event.status}`,
        timestamp: event.timestamp,
        moduleId: currentPatch.modules[0]?.id,
        status: event.status,
      }));
      const runtimeIngestEvents = runtimeEvents.slice(0, 120).map((event) => ({
        patchId: currentPatchId,
        source: 'runtime' as const,
        text: `module=${event.moduleId} state=${event.executionState || 'idle'} trigger=${String(event.triggerActive)} success=${String(event.lastExecutionSuccess)}`,
        timestamp: event.timestamp,
        moduleId: event.moduleId,
        status: event.lastExecutionSuccess === false ? 'ERROR' as const : 'INFO' as const,
      }));
      const ingest = await rhizomeCortexClient.ingest(currentPatchId, [...activityEvents, ...runtimeIngestEvents]);
      if (!ingest.ok) {
        setCortexStatus(`SYNC FAILED: ${ingest.error}`);
        return;
      }
      const graph = await rhizomeCortexClient.graph(currentPatchId);
      if (graph.ok) {
        setCortexGraphStats({
          nodes: graph.data.graph.nodes.length,
          edges: graph.data.graph.edges.length,
        });
      }
      setCortexStatus(`SYNCED ${ingest.data.ingested} EVENTS`);
    })();
  };

  const handleCortexQuery = () => {
    if (!currentPatchId || !cortexQuery.trim()) return;
    setCortexSummary('QUERYING...');
    void (async () => {
      const result = await rhizomeCortexClient.query(currentPatchId, cortexQuery.trim(), 8);
      if (!result.ok) {
        setCortexSummary(`QUERY FAILED: ${result.error}`);
        return;
      }
      setCortexSummary(result.data.summary || 'No summary returned');
    })();
  };

  return (
    <div className="flex-1 bg-bg-primary flex overflow-hidden">
      <div className="w-72 border-r border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Rhizome</span>
          <span className="text-text-tertiary text-2xs">[{String(graph.nodes.length).padStart(3, '0')}]</span>
        </div>

        <div className="p-4 border-b border-border space-y-2">
          <div className="text-2xs text-text-secondary uppercase tracking-wide">Chromosome Filter</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedChromosome(null)}
              className={cn(
                'h-7 border text-2xs uppercase transition-colors',
                selectedChromosome === null
                  ? 'border-text-primary bg-text-primary text-bg-primary'
                  : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              All
            </button>
            {CHROMOSOME_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedChromosome(option.id)}
                className={cn(
                  'h-7 border text-2xs uppercase transition-colors',
                  selectedChromosome === option.id
                    ? 'border-text-primary bg-text-primary text-bg-primary'
                    : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-border space-y-2">
          <div className="text-2xs text-text-secondary uppercase tracking-wide">Node Groups</div>
          <div className="space-y-1">
            {CHROMOSOME_OPTIONS.map((option) => (
              <div key={option.id} className="border border-border bg-bg-secondary p-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs uppercase">{option.label}</span>
                  <span className="text-2xs text-text-tertiary">{laneCounts[option.id]}</span>
                </div>
                <button
                  onClick={() => handleToggleCollapse(option.id)}
                  className={cn(
                    'mt-2 w-full h-6 border text-2xs uppercase transition-colors',
                    collapsedChromosomes[option.id]
                      ? 'border-text-primary bg-text-primary text-bg-primary'
                      : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  )}
                >
                  {collapsedChromosomes[option.id] ? 'Expand Lane' : 'Collapse Lane'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-border space-y-2">
          <div className="text-2xs text-text-secondary uppercase tracking-wide">Phase 2 Migration</div>
          <div className="flex gap-2">
            <button
              onClick={() => setImportPanelOpen((state) => !state)}
              className="flex-1 h-7 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              {importPanelOpen ? 'Close Import' : 'Import Md'}
            </button>
            <button
              onClick={() => currentPatchId && clearRuntimeEventMemory(currentPatchId)}
              className="flex-1 h-7 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              Clear Runtime
            </button>
          </div>
          <button
            onClick={handleSyncCortex}
            className="w-full h-7 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            Sync Cortex
          </button>
          {cortexStatus && <div className="text-2xs text-text-secondary uppercase">{cortexStatus}</div>}
          {importPanelOpen && (
            <div className="space-y-2">
              <textarea
                value={markdownInput}
                onChange={(event) => setMarkdownInput(event.target.value)}
                className="w-full min-h-[96px] bg-bg-primary border border-border text-text-secondary p-2 text-2xs font-mono outline-none focus:border-accent resize-y"
                placeholder="# Legacy memory markdown"
              />
              <button
                onClick={() => setImportReplaceMode((state) => !state)}
                className={cn(
                  'w-full h-6 border text-2xs uppercase transition-colors',
                  importReplaceMode
                    ? 'border-text-primary bg-text-primary text-bg-primary'
                    : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                {importReplaceMode ? 'Mode: Replace Existing' : 'Mode: Append Existing'}
              </button>
              <button
                onClick={handleImportMarkdown}
                className="w-full h-7 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
              >
                Apply Markdown Migration
              </button>
              {importMessage && <div className="text-2xs text-text-secondary uppercase">{importMessage}</div>}
            </div>
          )}
        </div>

        <div className="h-8 px-4 flex items-center border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Recent Memory Events</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {recentEvents.length === 0 ? (
            <div className="text-2xs text-text-tertiary uppercase text-center py-4">No events recorded</div>
          ) : (
            recentEvents.map((node) => (
              <button
                key={node.id}
                onClick={() => handleSelectRecentEvent(node)}
                className={cn(
                  'w-full text-left px-2 py-2 border bg-bg-secondary text-2xs transition-colors',
                  selectedNodeId === node.id
                    ? 'border-text-primary text-text-primary'
                    : 'border-border text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                <div className="uppercase">{node.label}</div>
                <div className="text-text-tertiary">{new Date(node.timestamp).toISOString().split('T')[1].split('.')[0]} UTC</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary z-20 relative">
          <span className="text-2xs tracking-wide uppercase font-medium">Rhizome Memory Graph</span>
          <span className="text-text-secondary text-2xs">PATCH:{currentPatch.name}</span>
        </div>

        <div
          className="flex-1 overflow-hidden bg-bg-primary relative cursor-grab active:cursor-grabbing bg-grid"
          onWheel={handleWheel}
          onClick={() => {
            if (suppressCanvasClickRef.current) {
              suppressCanvasClickRef.current = false;
              return;
            }
            setSelectedNodeId(null);
          }}
        >
          <div
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              const target = event.target as HTMLElement;
              if (target.closest('[data-rhizome-node="true"]')) return;
              if (target.closest('button,input,textarea,select,a')) return;

              event.preventDefault();
              panStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                panStartX: pan.x,
                panStartY: pan.y,
              };
              setIsPanning(true);
            }}
          >
            <div className="absolute inset-0 bg-grid-major pointer-events-none" />
            <svg className="absolute inset-0 pointer-events-none" width={Math.max(graph?.canvas?.width || 2000, 2000)} height={Math.max(graph?.canvas?.height || 2000, 2000)} style={{ overflow: 'visible' }}>
              {graph.edges.map((edge) => {
                const source = nodeById.get(edge.source);
                const target = nodeById.get(edge.target);
                if (!source || !target) return null;
                const x1 = source.x + source.width / 2;
                const y1 = source.y + source.height / 2;
                const x2 = target.x + target.width / 2;
                const y2 = target.y + target.height / 2;
                const path = getBezierPath(x1, y1, x2, y2);

                return (
                  <path
                    key={edge.id}
                    d={path}
                    stroke={edgeColor(edge)}
                    strokeWidth={Math.max(1, edge.weight * 2.6)}
                    fill="none"
                    className={edge.active ? 'cable-flow' : undefined}
                    style={edge.active ? { strokeDasharray: '6 6' } : undefined}
                    opacity={edge.active ? 0.9 : 0.35}
                  />
                );
              })}
            </svg>

            {positionedNodes.map((node) => (
              <RhizomeNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                onSelect={() => handleNodeClick(node)}
                onPositionChange={handleNodePositionChange}
                viewportScale={zoom}
              />
            ))}
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex border border-border bg-bg-tertiary/95 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
              }}
              className="w-8 h-8 border-r border-border text-xs hover:bg-bg-elevated transition-colors"
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom(1);
              }}
              className="h-8 px-3 border-r border-border text-2xs uppercase tracking-wide hover:bg-bg-elevated transition-colors"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom((prev) => Math.min(2, Number((prev + 0.1).toFixed(2))));
              }}
              className="w-8 h-8 text-xs hover:bg-bg-elevated transition-colors"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              setPan({ x: 0, y: 0 });
            }}
            className="absolute top-14 left-1/2 -translate-x-1/2 h-7 px-3 border border-border bg-bg-tertiary/95 text-2xs uppercase tracking-wide hover:bg-bg-elevated transition-colors z-20"
            title="Reset pan"
          >
            Reset Pan
          </button>
        </div>
      </div>

      <div className="w-72 border-l border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 flex items-center border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Expression Stats</span>
        </div>

        <div className="p-4 border-b border-border space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-border bg-bg-secondary p-2">
              <div className="text-2xs text-text-secondary uppercase">Nodes</div>
              <div className="text-sm">{graph.nodes.length}</div>
            </div>
            <div className="border border-border bg-bg-secondary p-2">
              <div className="text-2xs text-text-secondary uppercase">Edges</div>
              <div className="text-sm">{graph.edges.length}</div>
            </div>
            <div className="border border-border bg-bg-secondary p-2">
              <div className="text-2xs text-text-secondary uppercase">Avg Fitness</div>
              <div className="text-sm">{avgFitness}%</div>
            </div>
            <div className="border border-border bg-bg-secondary p-2">
              <div className="text-2xs text-text-secondary uppercase">Runtime Logs</div>
              <div className="text-sm">{runtimeEvents.length}</div>
            </div>
            <div className="border border-border bg-bg-secondary p-2">
              <div className="text-2xs text-text-secondary uppercase">Cortex Graph</div>
              <div className="text-sm">
                {cortexGraphStats ? `${cortexGraphStats.nodes}N / ${cortexGraphStats.edges}E` : 'NOT SYNCED'}
              </div>
            </div>
          </div>

          {CHROMOSOME_OPTIONS.map((lane) => {
            const density = graph.expressionDensity[lane.id];
            return (
              <div key={lane.id}>
                <div className="flex justify-between text-2xs uppercase mb-1">
                  <span className="text-text-secondary">{lane.label}</span>
                  <span>{Math.round(density * 100)}%</span>
                </div>
                <div className="h-1 bg-border">
                  <div className="h-full bg-text-primary" style={{ width: `${Math.round(density * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-8 px-4 flex items-center border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Node Inspector</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-border bg-bg-secondary p-2 mb-3 space-y-2">
            <div className="text-2xs text-text-secondary uppercase">Cortex Query</div>
            <input
              value={cortexQuery}
              onChange={(event) => setCortexQuery(event.target.value)}
              className="w-full h-7 bg-bg-primary border border-border text-text-secondary px-2 text-2xs outline-none focus:border-accent"
              placeholder="query memory..."
            />
            <button
              onClick={handleCortexQuery}
              className="w-full h-7 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              Query Cortex
            </button>
            {cortexSummary && <div className="text-2xs text-text-secondary break-words">{cortexSummary}</div>}
          </div>
          {!selectedNode ? (
            <div className="text-2xs text-text-tertiary uppercase text-center py-4">Select a node</div>
          ) : (
            <div className="space-y-2 text-2xs">
              <div className="border border-border bg-bg-secondary p-2">
                <div className="text-text-secondary uppercase mb-1">Label</div>
                <div className="uppercase">{selectedNode.label}</div>
              </div>
              <div className="border border-border bg-bg-secondary p-2">
                <div className="text-text-secondary uppercase mb-1">Type</div>
                <div className="uppercase">{selectedNode.type}</div>
              </div>
              <div className="border border-border bg-bg-secondary p-2">
                <div className="text-text-secondary uppercase mb-1">Chromosome</div>
                <div className="uppercase">{selectedNode.chromosome}</div>
              </div>
              <div className="border border-border bg-bg-secondary p-2">
                <div className="text-text-secondary uppercase mb-1">Fitness</div>
                <div>{Math.round(selectedNode.fitness * 100)}%</div>
              </div>
              <div className="border border-border bg-bg-secondary p-2">
                <div className="text-text-secondary uppercase mb-1">Timestamp</div>
                <div>{new Date(selectedNode.timestamp).toISOString()}</div>
              </div>
              {selectedNode.details && (
                <div className="border border-border bg-bg-secondary p-2">
                  <div className="text-text-secondary uppercase mb-1">Details</div>
                  <div className="break-all">{selectedNode.details}</div>
                </div>
              )}
              {selectedNode.type === 'group' && (
                <button
                  onClick={() => setCollapsedChromosomes((state) => ({ ...state, [selectedNode.chromosome]: false }))}
                  className="w-full h-7 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
                >
                  Expand {selectedNode.chromosome} lane
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
