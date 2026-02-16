'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { ModuleNode } from './ModuleNode';
import { CableLayer } from './CableLayer';
import { PortRef, Point } from '@/types';
import { cn } from '@/lib/utils';

export function PatchBayCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { 
    patches, 
    hasHydrated,
    currentPatchId, 
    selectedModuleId, 
    selectModule,
    createConnection,
    removeConnection,
    executePatch,
    stopPatch,
    evolvePatch,
    removeModule,
    clonePatch,
  } = useAppStore();

  const [connectingFrom, setConnectingFrom] = useState<PortRef | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const suppressCanvasClickRef = useRef(false);

  const currentPatch = currentPatchId ? patches[currentPatchId] : null;

  const handlePortClick = useCallback((portRef: PortRef, isOutput: boolean) => {
    if (isOutput) {
      // Start connection from output
      setConnectingFrom(portRef);
    } else if (connectingFrom) {
      // Complete connection to input
      if (currentPatchId) {
        createConnection(currentPatchId, connectingFrom, portRef);
      }
      setConnectingFrom(null);
    }
  }, [connectingFrom, currentPatchId, createConnection]);

  const handleCanvasClick = useCallback(() => {
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }
    setConnectingFrom(null);
    selectModule(null);
  }, [selectModule]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      });
    }
  }, [zoom, pan.x, pan.y]);

  const handleConnectionDelete = useCallback((connectionId: string) => {
    if (!currentPatchId) return;
    removeConnection(currentPatchId, connectionId);
  }, [currentPatchId, removeConnection]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.min(2, Math.max(0.5, Number((prev + direction).toFixed(2)))));
      return;
    }

    // Trackpad/touch mouse pan.
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedModuleId && currentPatchId) {
        removeModule(currentPatchId, selectedModuleId);
      }
    }
    if (e.key === 'Escape') {
      setConnectingFrom(null);
      selectModule(null);
    }
  }, [selectedModuleId, currentPatchId, removeModule, selectModule]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Create a demo patch if none exists
  useEffect(() => {
    if (!hasHydrated) return;

    const { patches, createPatch, addModule, createConnection, selectModule } = useAppStore.getState();
    if (Object.keys(patches).length === 0) {
      const patch = createPatch('NEURO_FEED');
      
      // Add some demo modules
      setTimeout(() => {
        addModule(patch.id, 'gmail-trigger', { x: 100, y: 100 });
        addModule(patch.id, 'text-processor', { x: 430, y: 250 });
        addModule(patch.id, 'slack-notify', { x: 430, y: 100 });

        // Wire initial demo connections to match the design intent.
        setTimeout(() => {
          const freshState = useAppStore.getState();
          const freshPatch = freshState.patches[patch.id];
          if (!freshPatch) return;

          const gmail = freshPatch.modules.find((m) => m.skillId === 'gmail-trigger');
          const slack = freshPatch.modules.find((m) => m.skillId === 'slack-notify');
          const textProcessor = freshPatch.modules.find((m) => m.skillId === 'text-processor');

          if (gmail && slack && textProcessor) {
            if (gmail.outputs[0] && slack.inputs[0]) {
              createConnection(
                patch.id,
                { moduleId: gmail.id, portId: gmail.outputs[0].id },
                { moduleId: slack.id, portId: slack.inputs[0].id }
              );
            }

            if (gmail.outputs[0] && textProcessor.inputs[0]) {
              createConnection(
                patch.id,
                { moduleId: gmail.id, portId: gmail.outputs[0].id },
                { moduleId: textProcessor.id, portId: textProcessor.inputs[0].id }
              );
            }

            selectModule(textProcessor.id);
          }
        }, 50);
      }, 100);
    }
  }, [hasHydrated]);

  if (!currentPatch) {
    return (
      <div 
        className="flex-1 relative overflow-hidden bg-bg-primary bg-grid"
        onClick={handleCanvasClick}
      >
        <div className="absolute inset-0 bg-grid-major" />
        <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs uppercase tracking-wide">
          SELECT OR CREATE A PATCH TO BEGIN
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={canvasRef}
      className="flex-1 relative overflow-hidden bg-bg-primary bg-grid cursor-grab active:cursor-grabbing"
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
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
          if (target.closest('[data-module-node="true"]')) return;
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

        {/* Cables */}
        <CableLayer
          modules={currentPatch.modules}
          connections={currentPatch.connections}
          onConnectionClick={handleConnectionDelete}
          previewConnection={connectingFrom ? {
            from: connectingFrom,
            to: mousePos
          } : null}
        />

        {/* Modules */}
        {currentPatch.modules.map((module) => (
          <ModuleNode
            key={module.id}
            module={module}
            isSelected={selectedModuleId === module.id}
            onSelect={() => selectModule(module.id)}
            onPortClick={handlePortClick}
            connectingFrom={connectingFrom}
            viewportScale={zoom}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex">
        <button
          onClick={(e) => {
            e.stopPropagation();
            executePatch(currentPatch.id);
          }}
          disabled={currentPatch.isRunning}
          className={cn(
            'h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase',
            'hover:bg-bg-elevated hover:text-text-primary transition-colors',
            'border-r-0',
            currentPatch.isRunning && 'opacity-50 cursor-not-allowed'
          )}
        >
          [▶] EXECUTE
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            stopPatch(currentPatch.id);
          }}
          disabled={!currentPatch.isRunning}
          className={cn(
            'h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase',
            'hover:bg-bg-elevated hover:text-text-primary transition-colors',
            'border-r-0',
            !currentPatch.isRunning && 'opacity-50 cursor-not-allowed'
          )}
        >
          [■] STOP
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            evolvePatch(currentPatch.id, 'splice');
          }}
          className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors border-r-0"
        >
          [✂] SPLICE
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            clonePatch(currentPatch.id);
          }}
          className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase text-text-tertiary hover:text-text-primary transition-colors"
        >
          [⎘] CLONE
        </button>
      </div>

      {/* Patch info overlay */}
      <div className="absolute top-4 left-4 text-2xs text-text-secondary font-mono space-y-1 pointer-events-none">
        <div>PATCH: <span className="text-text-primary">{currentPatch.name}</span></div>
        <div>GEN: <span className="text-text-primary">{String(currentPatch.generation).padStart(3, '0')}</span></div>
        <div>FIT: <span className="text-text-primary">{String(currentPatch.fitness.overall).padStart(3, '0')}/100</span></div>
        <div>MODS: <span className="text-text-primary">{String(currentPatch.modules.length).padStart(3, '0')}</span></div>
        <div>CONN: <span className="text-text-primary">{String(currentPatch.connections.length).padStart(3, '0')}</span></div>
        <div>ZOOM: <span className="text-text-primary">{Math.round(zoom * 100)}%</span></div>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex border border-border bg-bg-tertiary/95">
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
          100%
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
        className="absolute top-14 left-1/2 -translate-x-1/2 h-7 px-3 border border-border bg-bg-tertiary/95 text-2xs uppercase tracking-wide hover:bg-bg-elevated transition-colors"
        title="Reset pan"
      >
        Reset Pan
      </button>

      {currentPatch.connections.length > 0 && (
        <div className="absolute top-4 right-4 w-72 border border-border bg-bg-tertiary/95 backdrop-blur-sm">
          <div className="h-7 px-3 border-b border-border flex items-center justify-between text-2xs uppercase tracking-wide">
            <span>Connections</span>
            <span className="text-text-secondary">Click line to remove</span>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {currentPatch.connections.map((connection) => (
              <button
                key={connection.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConnectionDelete(connection.id);
                }}
                className="w-full px-3 py-2 text-left text-2xs border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors"
              >
                <span className="text-text-secondary">{truncateConnection(connection.id)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-20 right-4 text-2xs text-text-secondary uppercase tracking-wide pointer-events-none">
        {isPanning ? 'PANNING…' : 'Hold Left-Drag Empty Space to Pan'}
      </div>
    </div>
  );
}

function truncateConnection(id: string) {
  return `CONN_${id.slice(0, 6).toUpperCase()}`;
}
