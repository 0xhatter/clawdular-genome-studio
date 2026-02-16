'use client';

import { useMemo } from 'react';
import { Module, Connection, Point } from '@/types';
import { getBezierPath } from '@/lib/utils';

interface CableLayerProps {
  modules: Module[];
  connections: Connection[];
  previewConnection: { from: { moduleId: string; portId: string }; to: Point } | null;
  onConnectionClick?: (connectionId: string) => void;
}

export function CableLayer({ modules, connections, previewConnection, onConnectionClick }: CableLayerProps) {
  const moduleMap = useMemo(() => {
    const map = new Map<string, Module>();
    modules.forEach(m => map.set(m.id, m));
    return map;
  }, [modules]);

  const getPortPosition = (moduleId: string, portId: string, isOutput: boolean): { x: number; y: number } | null => {
    const module = moduleMap.get(moduleId);
    if (!module) return null;

    const ports = isOutput ? module.outputs : module.inputs;
    const portIndex = ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return null;

    const portHeight = 24;
    const headerHeight = 48; // 24px header + 24px config row
    const y = module.position.y + headerHeight + (portIndex * portHeight) + (portHeight / 2);
    const x = isOutput 
      ? module.position.x + 180 // Module width
      : module.position.x;

    return { x, y };
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-1">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#444" />
        </marker>
        <marker
          id="dot"
          viewBox="0 0 10 10"
          markerWidth="4"
          markerHeight="4"
          refX="5"
          refY="5"
        >
          <circle cx="5" cy="5" r="5" fill="#fff" />
        </marker>
      </defs>

      {/* Existing connections */}
      {connections.map((connection) => {
        const start = getPortPosition(connection.from.moduleId, connection.from.portId, true);
        const end = getPortPosition(connection.to.moduleId, connection.to.portId, false);

        if (!start || !end) return null;

        const path = getBezierPath(start.x, start.y, end.x, end.y);

        return (
          <g key={connection.id}>
            {/* Glow effect for active connections */}
            {connection.active && (
              <path
                d={path}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={4}
              />
            )}
            {/* Main cable */}
            <path
              d={path}
              fill="none"
              stroke={connection.active ? '#fff' : '#444'}
              strokeWidth={1}
              strokeDasharray={connection.active ? '4 4' : undefined}
              className={connection.active ? 'cable-flow pointer-events-auto cursor-pointer' : 'pointer-events-auto cursor-pointer'}
              markerEnd={connection.active ? 'url(#dot)' : 'url(#arrowhead)'}
              onClick={() => onConnectionClick?.(connection.id)}
            />
          </g>
        );
      })}

      {/* Preview connection while dragging */}
      {previewConnection && (() => {
        const start = getPortPosition(previewConnection.from.moduleId, previewConnection.from.portId, true);
        if (!start) return null;

        const path = getBezierPath(start.x, start.y, previewConnection.to.x, previewConnection.to.y);

        return (
          <path
            d={path}
            fill="none"
            stroke="#fff"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
        );
      })()}
    </svg>
  );
}
