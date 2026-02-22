'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn, getBezierPath } from '@/lib/utils';
import { useSimulacra } from '@/modules/simulacra/hooks/useSimulacra';
import { proposeConnection } from '@/modules/simulacra/services/simulacraService';

const NODE_WIDTH = 230;
const NODE_HALF_WIDTH = NODE_WIDTH / 2;
const NODE_HALF_HEIGHT = 68;

function energyTone(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio <= 0.2) return 'border-red-500/70 text-red-300';
  if (ratio <= 0.45) return 'border-orange-500/70 text-orange-200';
  if (ratio <= 0.75) return 'border-emerald-500/60 text-emerald-200';
  return 'border-cyan-500/60 text-cyan-200';
}

function stageBadge(stage: string): string {
  if (stage === 'embryo') return 'bg-blue-500/20 text-blue-200';
  if (stage === 'infant') return 'bg-indigo-500/20 text-indigo-200';
  if (stage === 'juvenile') return 'bg-emerald-500/20 text-emerald-200';
  if (stage === 'adult') return 'bg-cyan-500/20 text-cyan-200';
  if (stage === 'elder') return 'bg-amber-500/20 text-amber-200';
  return 'bg-zinc-700/40 text-zinc-300';
}

function portPosition(node: { position: { x: number; y: number } }, isOutput: boolean): { x: number; y: number } {
  return {
    x: isOutput ? node.position.x + NODE_HALF_WIDTH : node.position.x - NODE_HALF_WIDTH,
    y: node.position.y,
  };
}

export function Simulacra() {
  const {
    projectId,
    snapshot,
    positionedNodes,
    selectedNode,
    selectedNodeId,
    selectedForPollination,
    draftIdea,
    setDraftIdea,
    setSelectedNodeId,
    togglePollinationCandidate,
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
  } = useSimulacra();

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [nodePositionOverrides, setNodePositionOverrides] = useState<Record<string, { x: number; y: number }>>({});

  const panStateRef = useRef<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const nodeDragStateRef = useRef<{ nodeId: string; startX: number; startY: number; nodeStartX: number; nodeStartY: number } | null>(null);
  const suppressCanvasClickRef = useRef(false);

  useEffect(() => {
    setNodePositionOverrides({});
    setSelectedConnectionId(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [projectId]);

  useEffect(() => {
    const visibleNodeIds = new Set(positionedNodes.map((node) => node.id));
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
  }, [positionedNodes]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const nodeDragState = nodeDragStateRef.current;
      if (nodeDragState) {
        const dx = (event.clientX - nodeDragState.startX) / zoom;
        const dy = (event.clientY - nodeDragState.startY) / zoom;

        setNodePositionOverrides((prev) => ({
          ...prev,
          [nodeDragState.nodeId]: {
            x: nodeDragState.nodeStartX + dx,
            y: nodeDragState.nodeStartY + dy,
          },
        }));
        suppressCanvasClickRef.current = true;
        return;
      }

      const panState = panStateRef.current;
      if (!panState) return;

      setPan({
        x: panState.panStartX + (event.clientX - panState.startX),
        y: panState.panStartY + (event.clientY - panState.startY),
      });
      suppressCanvasClickRef.current = true;
    };

    const handleMouseUp = () => {
      if (nodeDragStateRef.current) {
        nodeDragStateRef.current = null;
        setIsDraggingNode(false);
      }
      if (panStateRef.current) {
        panStateRef.current = null;
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [zoom]);

  const displayedNodes = useMemo(() => {
    return positionedNodes.map((node) => {
      const override = nodePositionOverrides[node.id];
      if (!override) return node;
      return {
        ...node,
        position: override,
      };
    });
  }, [nodePositionOverrides, positionedNodes]);

  const nodeById = useMemo(() => {
    return new Map(displayedNodes.map((node) => [node.id, node]));
  }, [displayedNodes]);

  const connectionCounts = useMemo(() => {
    const counts = new Map<string, { inbound: number; outbound: number }>();

    displayedNodes.forEach((node) => {
      counts.set(node.id, { inbound: 0, outbound: 0 });
    });

    snapshot.connections.forEach((connection) => {
      const source = counts.get(connection.sourceId);
      if (source) source.outbound += 1;
      const target = counts.get(connection.targetId);
      if (target) target.inbound += 1;
    });

    return counts;
  }, [displayedNodes, snapshot.connections]);

  const canvasBounds = useMemo(() => {
    const maxX = displayedNodes.length ? Math.max(...displayedNodes.map((node) => node.position.x)) : 0;
    const maxY = displayedNodes.length ? Math.max(...displayedNodes.map((node) => node.position.y)) : 0;
    const minX = displayedNodes.length ? Math.min(...displayedNodes.map((node) => node.position.x)) : 0;
    const minY = displayedNodes.length ? Math.min(...displayedNodes.map((node) => node.position.y)) : 0;

    return {
      width: Math.max(1400, maxX - minX + 900),
      height: Math.max(900, maxY - minY + 640),
    };
  }, [displayedNodes]);

  const pollinationPreview = useMemo(() => {
    if (selectedForPollination.length < 2) return null;
    const parentA = snapshot.nodes.find((node) => node.id === selectedForPollination[0]);
    const parentB = snapshot.nodes.find((node) => node.id === selectedForPollination[1]);
    if (!parentA || !parentB) return null;

    return {
      parentA,
      parentB,
      compatibility: proposeConnection(parentA, parentB).compatibility,
    };
  }, [selectedForPollination, snapshot.nodes]);

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

  const handleCanvasClick = useCallback(() => {
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }
    setSelectedConnectionId(null);
  }, []);

  return (
    <div className="flex-1 bg-bg-primary flex overflow-hidden">
      <aside className="w-[290px] border-r border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 border-b border-border flex items-center justify-between">
          <span className="text-2xs uppercase tracking-wide font-medium">Agent Panel</span>
          <span className="text-2xs text-text-tertiary">[{snapshot.agents.length}]</span>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {snapshot.agents.map((agent) => (
            <div key={agent.id} className="border border-border bg-bg-secondary p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase">{agent.name}</div>
                  <div className="text-2xs text-text-secondary uppercase">{agent.role}</div>
                </div>
                <span className="text-2xs text-text-tertiary">Q:{agent.queue.length}</span>
              </div>
              <div className="mt-2 text-2xs text-text-tertiary leading-relaxed">
                C:{Math.round(agent.curiosity * 100)}% | Cr:{Math.round(agent.creativity * 100)}% | T:{Math.round(agent.thoroughness * 100)}%
              </div>
            </div>
          ))}

          <div className="border border-border bg-bg-secondary p-3 space-y-2">
            <div className="text-2xs uppercase text-text-secondary">Run Agent Cycles</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runAgentCycle('explore')}
                className="h-8 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
              >
                Explore
              </button>
              <button
                onClick={() => runAgentCycle('expand')}
                className="h-8 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
              >
                Expand
              </button>
              <button
                onClick={() => runAgentCycle('synthesize')}
                className="h-8 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
              >
                Pollinate
              </button>
              <button
                onClick={() => runAgentCycle('full')}
                className="h-8 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
              >
                Full Cycle
              </button>
            </div>

            <button
              onClick={() => setAutoCycle(!autoCycle)}
              className={cn(
                'w-full h-8 border text-2xs uppercase transition-colors',
                autoCycle
                  ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                  : 'border-border bg-bg-primary hover:bg-bg-elevated'
              )}
            >
              Auto Cycle: {autoCycle ? 'On' : 'Off'}
            </button>
          </div>

          <div className="border border-border bg-bg-secondary p-3 space-y-2">
            <div className="text-2xs uppercase text-text-secondary">Cross-Pollination Queue</div>
            <div className="text-2xs text-text-tertiary">
              Selected: {selectedForPollination.length}/2
            </div>
            {pollinationPreview ? (
              <div className="text-2xs text-text-secondary leading-relaxed">
                {pollinationPreview.parentA.id.slice(0, 6)} × {pollinationPreview.parentB.id.slice(0, 6)}
                <br />
                Compatibility: {Math.round(pollinationPreview.compatibility * 100)}%
              </div>
            ) : (
              <div className="text-2xs text-text-tertiary">Pick two nodes from the graph to synthesize offspring.</div>
            )}
            <button
              onClick={() => runPollination()}
              disabled={selectedForPollination.length < 2}
              className={cn(
                'w-full h-8 border text-2xs uppercase transition-colors',
                selectedForPollination.length < 2
                  ? 'border-border bg-bg-primary text-text-tertiary opacity-60 cursor-not-allowed'
                  : 'border-emerald-400 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
              )}
            >
              Synthesize Offspring
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="h-10 px-4 border-b border-border bg-bg-tertiary flex items-center gap-2">
          <input
            value={draftIdea}
            onChange={(event) => setDraftIdea(event.target.value)}
            placeholder="Seed a new organism idea..."
            className="flex-1 h-7 bg-bg-primary border border-border px-2 text-xs outline-none focus:border-accent"
          />
          <button
            onClick={submitDraftIdea}
            className="h-7 px-3 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
          >
            Spawn
          </button>
          <button
            onClick={runMetabolismTick}
            className="h-7 px-3 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
          >
            Tick
          </button>
          <button
            onClick={runConnectionDiscovery}
            className="h-7 px-3 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
          >
            Discover
          </button>
          <span className="ml-auto text-2xs uppercase text-text-tertiary">
            {isSyncing ? 'SYNCING' : 'SYNCED'} • {projectId.slice(0, 12)}
          </span>
        </div>

        {lastError && (
          <div className="px-4 py-2 border-b border-border text-2xs text-red-300 bg-red-500/10 uppercase">
            Simulacra API error: {lastError}
          </div>
        )}

        <div
          className={cn(
            'flex-1 overflow-hidden bg-bg-primary bg-grid relative',
            isDraggingNode || isPanning ? 'cursor-grabbing' : 'cursor-grab'
          )}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
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
              if (target.closest('[data-simulacra-node="true"]')) return;
              if (target.closest('button,input,textarea,select,a,[data-connection="true"]')) return;

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

            <div
              className="relative"
              style={{ width: canvasBounds.width, height: canvasBounds.height }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-1">
                <defs>
                  <marker
                    id="simulacra-arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 6 3, 0 6" fill="#444" />
                  </marker>
                  <marker
                    id="simulacra-dot"
                    viewBox="0 0 10 10"
                    markerWidth="4"
                    markerHeight="4"
                    refX="5"
                    refY="5"
                  >
                    <circle cx="5" cy="5" r="5" fill="#fff" />
                  </marker>
                </defs>

                {snapshot.connections.map((connection) => {
                  const source = nodeById.get(connection.sourceId);
                  const target = nodeById.get(connection.targetId);
                  if (!source || !target) return null;

                  const start = portPosition(source, true);
                  const end = portPosition(target, false);
                  const path = getBezierPath(start.x, start.y, end.x, end.y);
                  const isSelected = selectedConnectionId === connection.id;
                  const isActive = connection.activationCount > 0;

                  return (
                    <g key={connection.id}>
                      {isActive && (
                        <path
                          d={path}
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth={4}
                        />
                      )}

                      <path
                        data-connection="true"
                        d={path}
                        fill="none"
                        stroke={isSelected ? '#fff' : isActive ? '#fff' : '#444'}
                        strokeWidth={isSelected ? 2 : 1}
                        strokeDasharray={isActive ? '4 4' : undefined}
                        className={isActive ? 'cable-flow pointer-events-auto cursor-pointer' : 'pointer-events-auto cursor-pointer'}
                        markerEnd={isActive ? 'url(#simulacra-dot)' : 'url(#simulacra-arrowhead)'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedConnectionId((current) => (current === connection.id ? null : connection.id));
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {displayedNodes.map((node) => {
                const counts = connectionCounts.get(node.id) || { inbound: 0, outbound: 0 };

                return (
                  <article
                    key={node.id}
                    data-simulacra-node="true"
                    className={cn(
                      'absolute w-[230px] border bg-bg-secondary shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-3 select-none transition-colors',
                      energyTone(node.energy.current, node.energy.max),
                      selectedNodeId === node.id ? 'ring-1 ring-accent z-10' : 'hover:border-border-light z-2',
                      isDraggingNode ? 'cursor-grabbing' : 'cursor-grab'
                    )}
                    style={{ left: node.position.x - NODE_HALF_WIDTH, top: node.position.y - NODE_HALF_HEIGHT }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      const target = event.target as HTMLElement;
                      if (target.closest('button,input,textarea,select,a')) return;

                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedNodeId(node.id);
                      nodeDragStateRef.current = {
                        nodeId: node.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        nodeStartX: node.position.x,
                        nodeStartY: node.position.y,
                      };
                      setIsDraggingNode(true);
                    }}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <div
                      className={cn(
                        'absolute left-[-5px] top-1/2 -translate-y-1/2 w-2 h-2 border border-text-tertiary bg-bg-primary',
                        counts.inbound > 0 && 'bg-text-tertiary'
                      )}
                    />
                    <div
                      className={cn(
                        'absolute right-[-5px] top-1/2 -translate-y-1/2 w-2 h-2 border border-text-tertiary bg-bg-primary',
                        counts.outbound > 0 && 'bg-text-tertiary',
                        counts.outbound > 0 && 'shadow-[0_0_4px_rgba(255,255,255,0.5)]'
                      )}
                    />

                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-2xs text-text-tertiary">{node.id.slice(0, 6)}</span>
                      <span className={cn('text-2xs uppercase px-1.5 py-0.5 rounded-sm', stageBadge(node.lifecycle.stage))}>
                        {node.lifecycle.stage}
                      </span>
                    </div>
                    <div className="text-xs leading-snug min-h-[44px] overflow-hidden">{node.content}</div>

                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-2xs text-text-secondary">
                        <span>Energy</span>
                        <span>{Math.round(node.energy.current)}/{Math.round(node.energy.max)}</span>
                      </div>
                      <div className="h-1 bg-border">
                        <div
                          className="h-full bg-text-primary"
                          style={{ width: `${Math.min(100, (node.energy.current / Math.max(1, node.energy.max)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {node.dna.keywords.slice(0, 3).map((keyword) => (
                        <span key={keyword} className="text-2xs px-1.5 py-0.5 border border-border text-text-secondary uppercase">
                          {keyword}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          feedNode(node.id, 10);
                        }}
                        className="h-6 px-2 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
                      >
                        Feed
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePollinationCandidate(node.id);
                        }}
                        className={cn(
                          'h-6 px-2 border text-2xs uppercase transition-colors',
                          selectedForPollination.includes(node.id)
                            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                            : 'border-border bg-bg-primary hover:bg-bg-elevated'
                        )}
                      >
                        Select
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex border border-border bg-bg-tertiary/95 z-20">
            <button
              onClick={(event) => {
                event.stopPropagation();
                setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
              }}
              className="w-8 h-8 border-r border-border text-xs hover:bg-bg-elevated transition-colors"
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setZoom(1);
              }}
              className="h-8 px-3 border-r border-border text-2xs uppercase tracking-wide hover:bg-bg-elevated transition-colors"
              title="Reset zoom"
            >
              100%
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
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

          <div className="absolute bottom-3 right-4 text-2xs text-text-secondary uppercase tracking-wide pointer-events-none">
            {selectedConnectionId
              ? 'CONNECTION SELECTED'
              : isDraggingNode
                ? 'DRAGGING NODE…'
                : isPanning
                  ? 'PANNING…'
                  : 'DRAG NODES OR PAN CANVAS'}
          </div>
        </div>

        <div className="h-9 border-t border-border bg-bg-tertiary px-4 flex items-center gap-5 text-2xs uppercase text-text-secondary">
          <span>Nodes: {ecosystemStats.nodes}</span>
          <span>Alive: {ecosystemStats.alive}</span>
          <span>Dormant: {ecosystemStats.dormant}</span>
          <span>Connections: {ecosystemStats.connections}</span>
          <span>Pollinations: {ecosystemStats.pollinations}</span>
          <span>Avg Energy: {ecosystemStats.avgEnergy}</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </main>

      <aside className="w-[340px] border-l border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 border-b border-border flex items-center justify-between">
          <span className="text-2xs uppercase tracking-wide font-medium">Inspector</span>
          <span className="text-2xs text-text-tertiary">{selectedNode ? selectedNode.id.slice(0, 6) : '---'}</span>
        </div>

        <div className="p-4 border-b border-border space-y-3">
          {selectedNode ? (
            <>
              <div>
                <div className="text-2xs text-text-secondary uppercase mb-1">Content</div>
                <div className="text-xs leading-relaxed">{selectedNode.content}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="border border-border bg-bg-secondary p-2">
                  <div className="text-text-tertiary uppercase">Lifecycle</div>
                  <div className="mt-1 uppercase">{selectedNode.lifecycle.stage}</div>
                  <div className="text-text-secondary">{selectedNode.lifecycle.ageHours.toFixed(1)}h</div>
                </div>
                <div className="border border-border bg-bg-secondary p-2">
                  <div className="text-text-tertiary uppercase">Health</div>
                  <div className="mt-1">{Math.round(selectedNode.lifecycle.health * 100)}%</div>
                  <div className="text-text-secondary uppercase">{selectedNode.status}</div>
                </div>
              </div>

              <div>
                <div className="text-2xs text-text-secondary uppercase mb-1">DNA Traits</div>
                <div className="space-y-1">
                  {selectedNode.dna.traits.slice(0, 5).map((trait) => (
                    <div key={trait.name} className="flex justify-between text-2xs">
                      <span className="text-text-tertiary uppercase">{trait.name}</span>
                      <span>{Math.round(trait.value * 100)}% (h{Math.round(trait.heritability * 100)})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-2xs text-text-secondary uppercase mb-1">Parents</div>
                {selectedNode.parentIds.length === 0 ? (
                  <div className="text-2xs text-text-tertiary">Root organism</div>
                ) : (
                  <div className="text-2xs text-text-secondary break-all">{selectedNode.parentIds.join(', ')}</div>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs uppercase text-text-tertiary">Select a node</div>
          )}
        </div>

        <div className="h-8 px-4 border-b border-border flex items-center justify-between">
          <span className="text-2xs uppercase tracking-wide font-medium">Activity Stream</span>
          <button
            onClick={() => runAgentCycle('full')}
            className="h-6 px-2 border border-border bg-bg-primary text-2xs uppercase hover:bg-bg-elevated transition-colors"
          >
            Cycle
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {snapshot.activity.map((event) => (
            <div key={event.id} className="border border-border bg-bg-secondary p-2">
              <div className="text-2xs text-text-tertiary uppercase mb-1">{event.type}</div>
              <div className="text-2xs text-text-secondary leading-relaxed">{event.message}</div>
              <div className="text-2xs text-text-tertiary mt-1">{new Date(event.time).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
