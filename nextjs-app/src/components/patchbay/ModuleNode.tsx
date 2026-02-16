'use client';

import { useRef, useEffect, useState } from 'react';
import { Module, Port, PortRef } from '@/types';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

interface ModuleNodeProps {
  module: Module;
  isSelected: boolean;
  onSelect: () => void;
  onPortClick: (portRef: PortRef, isOutput: boolean) => void;
  connectingFrom: PortRef | null;
  viewportScale: number;
}

export function ModuleNode({ 
  module, 
  isSelected, 
  onSelect, 
  onPortClick,
  connectingFrom,
  viewportScale,
}: ModuleNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const { updateModulePosition, currentPatchId } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    moduleStartX: number;
    moduleStartY: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || !currentPatchId) return;

      const dx = (event.clientX - dragState.startX) / viewportScale;
      const dy = (event.clientY - dragState.startY) / viewportScale;

      updateModulePosition(currentPatchId, module.id, {
        x: dragState.moduleStartX + dx,
        y: dragState.moduleStartY + dy,
      });
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentPatchId, module.id, updateModulePosition, viewportScale]);

  const handlePortClick = (e: React.MouseEvent, port: Port, isOutput: boolean) => {
    e.stopPropagation();
    onPortClick(
      { moduleId: module.id, portId: port.id },
      isOutput
    );
  };

  const moduleName = module.genome.chromosomes.metadata?.name || module.skillId;

  return (
    <div
      ref={nodeRef}
      data-module-node="true"
      className={cn(
        'absolute w-[180px] bg-bg-tertiary border border-border z-2 select-none',
        'hover:border-border-light transition-colors',
        isSelected && 'border-accent z-10',
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-grab'
      )}
      style={{
        left: module.position.x,
        top: module.position.y,
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-port="true"]')) return;

        event.preventDefault();
        event.stopPropagation();
        onSelect();
        setIsDragging(true);
        dragStateRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          moduleStartX: module.position.x,
          moduleStartY: module.position.y,
        };
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header */}
      <div className={cn(
        'h-6 px-2 flex items-center gap-2 border-b border-dashed border-border',
        'bg-bg-elevated text-xs font-mono uppercase',
        isSelected && 'bg-bg-secondary'
      )}>
        <span>▓</span>
        <span className="truncate">{moduleName}</span>
      </div>

      {/* Config row */}
      <div className="h-6 px-2 flex items-center justify-between border-b border-dashed border-border text-2xs text-text-secondary">
        <span>GEN:{String(module.generation).padStart(3, '0')}</span>
        <span className="font-mono text-text-tertiary">ID:{module.id.slice(0, 4).toUpperCase()}</span>
      </div>

      {/* Input ports */}
      {module.inputs.map((input) => (
        <div
          key={input.id}
          data-port="true"
          className="h-6 px-2 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
          onClick={(e) => handlePortClick(e, input, false)}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 border border-text-tertiary',
                input.connectedTo.length > 0 && 'bg-text-tertiary',
                connectingFrom && 'animate-pulse border-accent'
              )}
            />
            <span className="text-2xs font-mono text-text-secondary">{input.name}</span>
          </div>
        </div>
      ))}

      {/* Separator */}
      {(module.inputs.length > 0 || module.outputs.length > 0) && (
        <div className="h-px bg-border" />
      )}

      {/* Output ports */}
      {module.outputs.map((output) => (
        <div
          key={output.id}
          data-port="true"
          className="h-6 px-2 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
          onClick={(e) => handlePortClick(e, output, true)}
        >
          <span></span>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-text-secondary">{output.name}</span>
            <div
              className={cn(
                'w-2 h-2 border border-text-tertiary',
                output.connectedTo.length > 0 && 'bg-text-tertiary',
                module.state === 'running' && output.connectedTo.length > 0 && 'bg-accent border-accent shadow-[0_0_4px_rgba(255,255,255,0.5)]'
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
