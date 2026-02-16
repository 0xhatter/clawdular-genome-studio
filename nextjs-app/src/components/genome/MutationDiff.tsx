'use client';

import type { GeneViewModel, MutationImpact } from '@/types/geneView';

interface MutationDiffProps {
  parentGenes: GeneViewModel[];
  childGene: GeneViewModel;
  impact: MutationImpact;
}

export function MutationDiff({ parentGenes, childGene, impact }: MutationDiffProps) {
  return (
    <div className="border border-border bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between text-2xs uppercase tracking-wide">
        <span className="text-text-secondary">Mutation Diff</span>
        <span className="text-text-tertiary">
          {impact.type} / {impact.severity}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {parentGenes.map((parent) => (
          <div key={parent.moduleId} className="border border-border bg-bg-primary p-3">
            <div className="text-2xs text-text-secondary uppercase mb-2">Parent {parent.moduleId.slice(0, 6)}</div>
            <div className="space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Stage</span>
                <span>{parent.stage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Fitness</span>
                <span>{Math.round(parent.fitness)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Load</span>
                <span>{Math.round(parent.mutationLoad * 100)}%</span>
              </div>
            </div>
          </div>
        ))}

        <div className="border border-border bg-bg-primary p-3">
          <div className="text-2xs text-text-primary uppercase mb-2">Child {childGene.moduleId.slice(0, 6)}</div>
          <div className="space-y-1 text-2xs">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Stage</span>
              <span>{childGene.stage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Fitness</span>
              <span>{Math.round(childGene.fitness)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Load</span>
              <span>{Math.round(childGene.mutationLoad * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-2xs text-text-secondary uppercase">Changed Parts</div>
        <div className="flex flex-wrap gap-1">
          {impact.changedParts.length > 0 ? (
            impact.changedParts.map((id) => (
              <span key={id} className="px-2 py-1 border border-border text-2xs bg-bg-primary">
                {id}
              </span>
            ))
          ) : (
            <span className="text-2xs text-text-tertiary">No significant part changes detected.</span>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-2xs text-text-secondary uppercase mb-1">
          <span>Impact Confidence</span>
          <span>{Math.round(impact.confidence * 100)}%</span>
        </div>
        <div className="h-1 bg-border">
          <div className="h-full bg-text-primary" style={{ width: `${Math.round(impact.confidence * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
