'use client';

import type { GenePart, GeneViewModel } from '@/types/geneView';
import { getPartColor } from '@/lib/geneView';

interface GeneGrowthCanvasProps {
  gene: GeneViewModel;
  width?: number;
  height?: number;
  onPartClick?: (part: GenePart) => void;
}

const laneByType: Record<GenePart['type'], number> = {
  promoter: 0,
  utr5: 1,
  exon: 2,
  intron: 3,
  utr3: 4,
  regulator: 5,
  mark: 6,
};

export function GeneGrowthCanvas({ gene, width = 800, height = 400, onPartClick }: GeneGrowthCanvasProps) {
  const laneHeight = height / 8;

  return (
    <div className="border border-border bg-bg-secondary p-4">
      <div className="mb-3 flex items-center justify-between text-2xs uppercase tracking-wide">
        <span className="text-text-secondary">Module {gene.moduleId.slice(0, 8)}</span>
        <span className="text-text-tertiary">
          {gene.stage} / {gene.expressionState}
        </span>
      </div>
      <svg width={width} height={height} className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
        <rect x="0" y="0" width={width} height={height} fill="#020617" />
        {Object.entries(laneByType).map(([laneName, laneIndex]) => (
          <g key={laneName}>
            <line
              x1="0"
              y1={laneHeight * (laneIndex + 1)}
              x2={width}
              y2={laneHeight * (laneIndex + 1)}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text x="8" y={laneHeight * (laneIndex + 1) - 6} fill="#64748b" fontSize="10">
              {laneName.toUpperCase()}
            </text>
          </g>
        ))}

        {gene.parts.map((part) => {
          const lane = laneByType[part.type];
          const x = part.start * width;
          const y = laneHeight * (lane + 0.25);
          const w = Math.max((part.end - part.start) * width, 6);
          const h = laneHeight * 0.45;

          return (
            <g key={part.id} onClick={() => onPartClick?.(part)} style={{ cursor: onPartClick ? 'pointer' : 'default' }}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={3}
                fill={getPartColor(part.type, gene.expressionState)}
                fillOpacity={0.35 + part.intensity * 0.65}
                stroke="#0f172a"
                strokeWidth={1}
              />
              {w > 48 && (
                <text x={x + 6} y={y + h / 2 + 4} fill="#020617" fontSize="10">
                  {part.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
