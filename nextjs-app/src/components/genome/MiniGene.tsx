'use client';

import type { GeneViewModel } from '@/types/geneView';
import { cn } from '@/lib/utils';
import { getPartColor } from '@/lib/geneView';

interface MiniGeneProps {
  gene: GeneViewModel;
  width?: number;
  height?: number;
  onClick?: () => void;
}

export function MiniGene({ gene, width = 300, height = 80, onClick }: MiniGeneProps) {
  const bodyY = Math.round(height * 0.45);
  const bodyHeight = Math.max(12, Math.round(height * 0.22));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left border border-border bg-bg-secondary p-3 transition-colors',
        onClick && 'hover:bg-bg-elevated'
      )}
    >
      <div className="mb-2 flex items-center justify-between text-2xs uppercase tracking-wide">
        <span className="text-text-secondary">Gene Stage: {gene.stage}</span>
        <span className="text-text-tertiary">Expr: {gene.expressionState}</span>
      </div>

      <svg width={width} height={height} className="w-full overflow-visible">
        <rect x="0" y={bodyY} width={width} height={bodyHeight} fill="#0f172a" stroke="#334155" strokeWidth="1" />
        {gene.parts.map((part) => {
          const x = part.start * width;
          const partWidth = Math.max((part.end - part.start) * width, 3);
          const opacity = 0.45 + part.intensity * 0.55;
          return (
            <rect
              key={part.id}
              x={x}
              y={bodyY + 1}
              width={partWidth}
              height={bodyHeight - 2}
              fill={getPartColor(part.type, gene.expressionState)}
              fillOpacity={opacity}
              rx="1"
            />
          );
        })}
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-2xs uppercase">
        <span className="text-text-secondary">Gen {String(gene.generation).padStart(3, '0')}</span>
        <span className="text-text-secondary">Fit {Math.round(gene.fitness)}/100</span>
        <span className="text-text-secondary">Load {Math.round(gene.mutationLoad * 100)}%</span>
      </div>
    </button>
  );
}
