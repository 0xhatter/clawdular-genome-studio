'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { MutationDiff } from '@/components/genome';
import { buildGeneViewModel, deriveMutationImpact } from '@/lib/geneView';

export function Evolution() {
  const { patches, currentPatchId, evolvePatch } = useAppStore();
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);

  const currentPatch = currentPatchId ? patches[currentPatchId] : null;
  const selectedEvent = useMemo(
    () => currentPatch?.evolutionHistory.find((event) => event.generation === selectedGeneration) || null,
    [currentPatch, selectedGeneration]
  );
  const diffData = useMemo(() => {
    if (!currentPatch || !selectedEvent) return null;

    const childModule =
      currentPatch.modules.find((module) => module.generation === selectedEvent.generation) ||
      currentPatch.modules.slice().sort((a, b) => b.generation - a.generation)[0];
    if (!childModule) return null;

    const parentModules = (childModule.parentIds || [])
      .map((id) => currentPatch.modules.find((module) => module.id === id))
      .filter((module): module is NonNullable<typeof module> => Boolean(module));
    const fallbackParent =
      currentPatch.modules.find((module) => module.id !== childModule.id && module.generation <= childModule.generation) || null;

    const parentSelection = parentModules.length > 0 ? parentModules : fallbackParent ? [fallbackParent] : [];
    if (parentSelection.length === 0) return null;

    const history = [currentPatch];
    const childGene = buildGeneViewModel(childModule, history, childModule.executionState || childModule.state);
    const parentGenes = parentSelection.map((module) =>
      buildGeneViewModel(module, history, module.executionState || module.state)
    );

    return {
      childGene,
      parentGenes,
      impact: deriveMutationImpact(parentGenes, childGene),
    };
  }, [currentPatch, selectedEvent]);

  if (!currentPatch) {
    return (
      <div className="flex-1 bg-bg-primary flex items-center justify-center">
        <div className="text-text-tertiary text-xs uppercase tracking-wide text-center">
          SELECT A PATCH TO VIEW EVOLUTION
        </div>
      </div>
    );
  }

  const generations = currentPatch.evolutionHistory;

  return (
    <div className="flex-1 bg-bg-primary flex overflow-hidden">
      {/* Left Panel - Evolution Timeline */}
      <div className="w-96 border-r border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Evolution Timeline</span>
          <span className="text-text-tertiary text-2xs">
            GEN:{String(currentPatch.generation).padStart(3, '0')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Timeline visualization */}
          <div className="relative mb-8">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            
            {/* Genesis */}
            <div className="relative flex items-center gap-4 mb-6">
              <div className="w-8 h-8 border border-border bg-bg-primary flex items-center justify-center z-10">
                <div className="w-2 h-2 bg-text-primary" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase">GENESIS</div>
                <div className="text-2xs text-text-secondary">
                  {new Date(currentPatch.createdAt).toISOString().split('T')[0]}
                </div>
              </div>
            </div>

            {/* Evolution events */}
            {generations.map((event, i) => (
              <div 
                key={i}
                className={cn(
                  'relative flex items-center gap-4 mb-6 cursor-pointer',
                  selectedGeneration === event.generation && 'opacity-100'
                )}
                onClick={() => setSelectedGeneration(event.generation)}
              >
                <div className={cn(
                  'w-8 h-8 border flex items-center justify-center z-10',
                  selectedGeneration === event.generation 
                    ? 'border-accent bg-bg-secondary' 
                    : 'border-border bg-bg-primary'
                )}>
                  <div className={cn(
                    'w-2 h-2',
                    selectedGeneration === event.generation ? 'bg-accent' : 'bg-text-tertiary'
                  )} />
                </div>
                <div>
                  <div className="text-xs font-mono uppercase">
                    GENERATION {String(event.generation).padStart(3, '0')}
                  </div>
                  <div className="text-2xs text-text-secondary uppercase">
                    {event.strategy}
                  </div>
                  <div className="text-2xs text-text-tertiary">
                    {new Date(event.timestamp).toISOString().split('T')[0]}
                  </div>
                </div>
              </div>
            ))}

            {/* Current */}
            <div className="relative flex items-center gap-4">
              <div className="w-8 h-8 border-2 border-accent bg-bg-primary flex items-center justify-center z-10">
                <div className="w-3 h-3 bg-accent" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-text-primary">
                  CURRENT [GEN {String(currentPatch.generation).padStart(3, '0')}]
                </div>
                <div className="text-2xs text-text-secondary">
                  FITNESS: {currentPatch.fitness.overall}/100
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evolution Controls */}
        <div className="p-4 border-t border-border">
          <div className="text-2xs text-text-secondary uppercase tracking-wide mb-2">
            Evolution Strategy
          </div>
          <div className="space-y-1">
            <button 
              onClick={() => evolvePatch(currentPatch.id, 'mutate')}
              className="w-full h-8 border border-border bg-bg-primary text-2xs hover:bg-bg-elevated hover:text-text-primary transition-colors text-left px-3"
            >
              [⚡] MUTATE
            </button>
            <button 
              onClick={() => evolvePatch(currentPatch.id, 'breed')}
              className="w-full h-8 border border-border bg-bg-primary text-2xs hover:bg-bg-elevated hover:text-text-primary transition-colors text-left px-3"
            >
              [⚭] BREED
            </button>
            <button 
              onClick={() => evolvePatch(currentPatch.id, 'optimize')}
              className="w-full h-8 border border-border bg-bg-primary text-2xs hover:bg-bg-elevated hover:text-text-primary transition-colors text-left px-3"
            >
              [◈] OPTIMIZE
            </button>
            <button 
              onClick={() => evolvePatch(currentPatch.id, 'auto')}
              className="w-full h-8 border border-border bg-bg-secondary text-2xs text-text-primary transition-colors text-left px-3"
            >
              [▶] AUTO EVOLVE
            </button>
          </div>
        </div>
      </div>

      {/* Center Panel - Comparison */}
      <div className="flex-1 flex flex-col">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">
            Generation Comparison
          </span>
        </div>

        <div className="flex-1 p-8">
          {selectedGeneration && diffData ? (
            <MutationDiff
              parentGenes={diffData.parentGenes}
              childGene={diffData.childGene}
              impact={diffData.impact}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-tertiary text-xs uppercase tracking-wide">
              SELECT A GENERATION TO COMPARE
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Stats */}
      <div className="w-72 border-l border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 flex items-center border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Statistics</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="border border-border bg-bg-secondary p-3">
            <div className="text-2xs text-text-secondary uppercase mb-1">Current Fitness</div>
            <div className="text-3xl font-mono">{currentPatch.fitness.overall}</div>
            <div className="text-2xs text-text-tertiary">/100</div>
          </div>

          <div className="space-y-2">
            {Object.entries(currentPatch.fitness.components).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-2xs mb-1">
                  <span className="text-text-secondary uppercase">{key}</span>
                  <span className="font-mono">{value}</span>
                </div>
                <div className="h-1 bg-border">
                  <div 
                    className="h-full bg-text-secondary"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-2xs text-text-secondary uppercase mb-2">Evolution Summary</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Total Generations</span>
                <span className="font-mono">{currentPatch.generation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Mutations</span>
                <span className="font-mono">
                  {currentPatch.modules.reduce((acc, m) => acc + m.genome.mutations.length, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Improvement</span>
                <span className="font-mono text-text-primary">
                  +{currentPatch.fitness.overall}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
