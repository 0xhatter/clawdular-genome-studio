'use client';

import { RhizomeLayoutNode } from '@/types/rhizome';
import { cn } from '@/lib/utils';
import { useMemo, useEffect, useRef, useState } from 'react';

interface RhizomeNodeComponentProps {
  node: RhizomeLayoutNode;
  isSelected: boolean;
  onSelect: () => void;
  onPositionChange: (nodeId: string, position: { x: number; y: number }) => void;
  viewportScale: number;
}

function getNodeStyles(node: RhizomeLayoutNode) {
  if (node.type === 'group') {
    return {
      bg: 'bg-zinc-800/30',
      border: 'border-zinc-500',
      text: 'text-zinc-400',
      headerBg: 'bg-zinc-800/50',
    };
  }
  switch (node.chromosome) {
    case 'trigger':
      return {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-400',
        text: 'text-cyan-400',
        headerBg: 'bg-cyan-500/20',
      };
    case 'action':
      return {
        bg: 'bg-zinc-100/5',
        border: 'border-zinc-300',
        text: 'text-zinc-300',
        headerBg: 'bg-zinc-100/10',
      };
    case 'behavior':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500',
        text: 'text-amber-500',
        headerBg: 'bg-amber-500/20',
      };
    case 'metadata':
      return {
        bg: 'bg-zinc-500/10',
        border: 'border-zinc-500',
        text: 'text-zinc-500',
        headerBg: 'bg-zinc-500/20',
      };
    default:
      return {
        bg: 'bg-white/5',
        border: 'border-white/20',
        text: 'text-white/50',
        headerBg: 'bg-white/10',
      };
  }
}

export function RhizomeNodeComponent({
  node,
  isSelected,
  onSelect,
  onPositionChange,
  viewportScale,
}: RhizomeNodeComponentProps) {
  const styles = useMemo(() => getNodeStyles(node), [node]);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const dx = (event.clientX - dragState.startX) / viewportScale;
      const dy = (event.clientY - dragState.startY) / viewportScale;

      onPositionChange(node.id, {
        x: dragState.nodeStartX + dx,
        y: dragState.nodeStartY + dy,
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
  }, [node.id, onPositionChange, viewportScale]);

  return (
    <div
      data-rhizome-node="true"
      className={cn(
        'absolute select-none transition-colors border shadow-sm backdrop-blur-sm',
        'flex flex-col items-center justify-center p-2 text-center', // Center content for bubble
        styles.bg,
        styles.border,
        isSelected && 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10',
        !isSelected && 'hover:brightness-125 z-0',
        node.type === 'group' && 'border-dashed',
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-grab'
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        borderRadius: '50%', // Perfect circle
        overflow: 'hidden'
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        onSelect();
        setIsDragging(true);
        dragStateRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          nodeStartX: node.x,
          nodeStartY: node.y,
        };
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className={cn('text-[10px] font-mono uppercase mb-0.5 opacity-80', styles.text)}>
        {node.type === 'group' ? 'LANE' : node.type}
      </div>
      <div className="text-xs font-medium uppercase text-zinc-100 leading-tight line-clamp-2 w-full px-1" title={node.label}>
        {node.label}
      </div>
      {node.type !== 'patch' && (
        <div className="text-[9px] uppercase text-zinc-400 mt-1">
          {node.type === 'group' ? node.details : `${Math.round(node.fitness * 100)}% FIT`}
        </div>
      )}
    </div>
  );
}
