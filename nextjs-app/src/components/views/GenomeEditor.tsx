'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn, incrementVersion, truncateId } from '@/lib/utils';
import { GeneGrowthCanvas } from '@/components/genome';
import { buildGeneViewModel } from '@/lib/geneView';

export function GenomeEditor() {
  const {
    patches,
    currentPatchId,
    selectedModuleId,
    updateModuleGenome,
    mutateModule,
    breedModules,
    evolvePatch,
    cloneModule,
  } = useAppStore();
  const [activeChromosome, setActiveChromosome] = useState<'trigger' | 'action' | 'behavior' | 'metadata'>('trigger');
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');
  const [mutationIntensity, setMutationIntensity] = useState(0.3);
  const [editorValue, setEditorValue] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);

  const currentPatch = currentPatchId ? patches[currentPatchId] : null;
  const selectedModule = selectedModuleId && currentPatch
    ? currentPatch.modules.find(m => m.id === selectedModuleId)
    : null;
  const chromosome = selectedModule ? selectedModule.genome.chromosomes[activeChromosome] : null;
  const geneModel = useMemo(() => {
    if (!selectedModule) return null;
    const history = currentPatch ? [currentPatch] : [];
    return buildGeneViewModel(selectedModule, history, selectedModule.executionState || selectedModule.state);
  }, [currentPatch, selectedModule]);

  useEffect(() => {
    if (!selectedModule || !chromosome) return;
    setEditorValue(JSON.stringify(chromosome, null, 2));
    setEditorError(null);
  }, [activeChromosome, selectedModule, chromosome]);

  if (!selectedModule) {
    return (
      <div className="flex-1 bg-bg-primary flex items-center justify-center">
        <div className="text-text-tertiary text-xs uppercase tracking-wide text-center">
          <div className="mb-4 text-4xl">🧬</div>
          SELECT A MODULE TO EDIT ITS GENOME
        </div>
      </div>
    );
  }

  const genome = selectedModule.genome;

  const handleApplyChromosome = () => {
    if (!currentPatch) return;

    try {
      const parsedChromosome = JSON.parse(editorValue);
      updateModuleGenome(currentPatch.id, selectedModule.id, {
        ...genome,
        version: incrementVersion(genome.version),
        chromosomes: {
          ...genome.chromosomes,
          [activeChromosome]: parsedChromosome,
        },
        mutations: [
          ...genome.mutations,
          {
            timestamp: Date.now(),
            type: 'behavioral',
            changes: [{ chromosome: activeChromosome, operation: 'edit' }],
            parentGenomes: [genome.id],
          },
        ],
      });
      setEditorError(null);
    } catch {
      setEditorError('INVALID JSON');
    }
  };

  const handleMutate = () => {
    if (!currentPatch) return;
    mutateModule(currentPatch.id, selectedModule.id, 'parameter', mutationIntensity);
  };

  const handleExtractMode = () => {
    if (!currentPatch) return;

    const nextGenome = {
      ...genome,
      chromosomes: {
        ...genome.chromosomes,
        action: {
          ...genome.chromosomes.action,
          operations: (genome.chromosomes.action.operations || []).map((operation, index) =>
            index === 0
              ? {
                  ...operation,
                  config: {
                    ...operation.config,
                    mode: 'extract',
                  },
                }
              : operation
          ),
        },
      },
    };

    updateModuleGenome(currentPatch.id, selectedModule.id, nextGenome);
  };

  const handleBreed = () => {
    if (!currentPatch) return;
    const partner = currentPatch.modules.find(m => m.id !== selectedModule.id);
    if (!partner) return;
    breedModules(currentPatch.id, selectedModule.id, partner.id);
    evolvePatch(currentPatch.id, 'breed');
  };

  return (
    <div className="flex-1 bg-bg-primary flex overflow-hidden">
      {/* Left Panel - Genome Overview */}
      <div className="w-80 border-r border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Genome Overview</span>
        </div>

        <div className="p-4 space-y-4">
          {/* DNA Helix */}
          <div className="bg-bg-secondary p-4 border border-border">
            <div className="font-mono text-xs space-y-0 leading-3 text-text-secondary text-center">
              <div><span className="text-text-primary">G</span>-{truncateId(genome.id, 2).toUpperCase()}</div>
              <div>╱   ╲</div>
              <div>╱     ╲</div>
              <div>●═══════●</div>
              <div>╲     ╱</div>
              <div>╲   ╱</div>
              <div><span className="text-text-primary">C</span>-{String(selectedModule.generation).padStart(2, '0')}</div>
              <div>╱   ╲</div>
              <div>╱     ╲</div>
              <div>○───────○</div>
              <div>╲     ╱</div>
              <div>╲   ╱</div>
              <div><span className="text-text-primary">A</span>-{String(genome.fitness.overall).padStart(2, '0')}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Version</span>
              <span className="font-mono">{genome.version}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Generation</span>
              <span className="font-mono">{String(selectedModule.generation).padStart(3, '0')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Mutations</span>
              <span className="font-mono">{String(genome.mutations.length).padStart(3, '0')}</span>
            </div>
          </div>

          {/* Fitness */}
          <div>
            <div className="flex justify-between text-2xs text-text-secondary uppercase mb-1">
              <span>Fitness Score</span>
              <span>{genome.fitness.overall}/100</span>
            </div>
            <div className="h-1 bg-border">
              <div 
                className="h-full bg-text-primary"
                style={{ width: `${genome.fitness.overall}%` }}
              />
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="space-y-1">
            {Object.entries(genome.fitness.components).map(([key, value]) => (
              <div key={key} className="flex justify-between text-2xs">
                <span className="text-text-tertiary uppercase">{key}</span>
                <span className="font-mono">{String(value).padStart(3, '0')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mutation History */}
        <div className="flex-1 border-t border-border overflow-y-auto">
          <div className="h-8 px-4 flex items-center border-b border-border bg-bg-tertiary">
            <span className="text-2xs tracking-wide uppercase">Mutation History</span>
          </div>
          <div className="p-2 space-y-1">
            {genome.mutations.length === 0 ? (
              <div className="text-text-tertiary text-2xs text-center py-4">
                NO MUTATIONS
              </div>
            ) : (
              genome.mutations.slice().reverse().map((mutation, i) => (
                <div key={i} className="p-2 border border-border bg-bg-secondary text-2xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-secondary uppercase">{mutation.type}</span>
                    <span className="text-text-tertiary">
                      {new Date(mutation.timestamp).toISOString().split('T')[0]}
                    </span>
                  </div>
                  <div className="text-text-tertiary">
                    {mutation.changes.length} change{mutation.changes.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Center Panel - Chromosome Editor */}
      <div className="flex-1 flex flex-col">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Chromosome Editor</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('visual')}
              className={cn(
                'h-6 px-2 border text-2xs uppercase',
                viewMode === 'visual'
                  ? 'border-text-primary bg-text-primary text-bg-primary'
                  : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated'
              )}
            >
              Gene View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={cn(
                'h-6 px-2 border text-2xs uppercase',
                viewMode === 'raw'
                  ? 'border-text-primary bg-text-primary text-bg-primary'
                  : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated'
              )}
            >
              JSON
            </button>
            <span className="text-text-tertiary text-2xs">VER:{genome.version}</span>
          </div>
        </div>

        {viewMode === 'visual' && geneModel ? (
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <GeneGrowthCanvas
              gene={geneModel}
              width={860}
              height={420}
              onPartClick={(part) => {
                if (part.type === 'regulator' && part.metadata?.rateLimit) {
                  setViewMode('raw');
                  setActiveChromosome('behavior');
                }
              }}
            />
            <div className="border border-border bg-bg-secondary p-3 text-2xs text-text-secondary uppercase">
              Click a gene part to inspect it. Regulator parts jump to Behavior JSON.
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['trigger', 'action', 'behavior', 'metadata'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveChromosome(tab)}
                  className={cn(
                    'flex-1 h-8 text-2xs tracking-wide uppercase border-r border-border last:border-r-0',
                    'hover:bg-bg-elevated transition-colors',
                    activeChromosome === tab ? 'bg-bg-secondary text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Editor Content */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="border border-border bg-bg-secondary p-4 font-mono text-xs space-y-3">
                <textarea
                  value={editorValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  spellCheck={false}
                  className="w-full min-h-[420px] bg-bg-primary border border-border text-text-secondary p-3 outline-none focus:border-accent resize-y"
                />
                {editorError && (
                  <div className="text-2xs text-text-primary">{editorError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditorValue(JSON.stringify(chromosome, null, 2));
                      setEditorError(null);
                    }}
                    className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
                  >
                    RESET
                  </button>
                  <button
                    onClick={handleApplyChromosome}
                    className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
                  >
                    APPLY JSON
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Panel - Operations */}
      <div className="w-72 border-l border-border bg-bg-tertiary flex flex-col">
        <div className="h-8 px-4 flex items-center border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">Operations</span>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={handleExtractMode}
            className="w-full h-10 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center justify-center gap-2"
          >
            <span>⬇</span> EXTRACT
          </button>
          <button
            onClick={() => currentPatch && evolvePatch(currentPatch.id, 'splice')}
            className="w-full h-10 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center justify-center gap-2"
          >
            <span>✂</span> SPLICE
          </button>
          <button
            onClick={handleBreed}
            className="w-full h-10 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center justify-center gap-2"
          >
            <span>⚭</span> BREED
          </button>
          <button
            onClick={handleMutate}
            className="w-full h-10 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center justify-center gap-2"
          >
            <span>⚡</span> MUTATE
          </button>
          <button
            onClick={() => currentPatch && cloneModule(currentPatch.id, selectedModule.id)}
            className="w-full h-10 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center justify-center gap-2"
          >
            <span>⎘</span> CLONE
          </button>
        </div>

        <div className="p-4 border-t border-border">
          <div className="text-2xs text-text-secondary uppercase tracking-wide mb-2">
            Mutation Presets
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setMutationIntensity(0.1)}
              className={cn(
                'w-full h-8 border border-border text-2xs transition-colors',
                mutationIntensity === 0.1
                  ? 'bg-bg-secondary text-text-primary'
                  : 'bg-bg-primary hover:bg-bg-elevated'
              )}
            >
              CONSERVATIVE (10%)
            </button>
            <button
              onClick={() => setMutationIntensity(0.3)}
              className={cn(
                'w-full h-8 border border-border text-2xs transition-colors',
                mutationIntensity === 0.3
                  ? 'bg-bg-secondary text-text-primary'
                  : 'bg-bg-primary hover:bg-bg-elevated'
              )}
            >
              MODERATE (30%)
            </button>
            <button
              onClick={() => setMutationIntensity(0.5)}
              className={cn(
                'w-full h-8 border border-border text-2xs transition-colors',
                mutationIntensity === 0.5
                  ? 'bg-bg-secondary text-text-primary'
                  : 'bg-bg-primary hover:bg-bg-elevated'
              )}
            >
              AGGRESSIVE (50%)
            </button>
            <button
              onClick={() => setMutationIntensity(0.7)}
              className={cn(
                'w-full h-8 border border-border text-2xs transition-colors',
                mutationIntensity === 0.7
                  ? 'bg-bg-secondary text-text-primary'
                  : 'bg-bg-primary hover:bg-bg-elevated text-text-tertiary'
              )}
            >
              CHAOS MODE (70%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
