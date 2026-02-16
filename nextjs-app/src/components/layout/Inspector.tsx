'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn, truncateId } from '@/lib/utils';
import { MiniGene } from '@/components/genome';
import { buildGeneViewModel } from '@/lib/geneView';

export function Inspector() {
  const {
    patches,
    currentPatchId,
    selectedModuleId,
    updateModuleMetadata,
    setModuleOperationMode,
    updateModuleParameter,
  } = useAppStore();

  const currentPatch = currentPatchId ? patches[currentPatchId] : null;
  const selectedModule = selectedModuleId && currentPatch
    ? currentPatch.modules.find((m) => m.id === selectedModuleId)
    : null;

  const moduleName = selectedModule?.genome.chromosomes.metadata?.name || selectedModule?.skillId || '';
  const geneGrowthEnabled = process.env.NEXT_PUBLIC_GENE_GROWTH_UI === 'true';
  const operationMode = useMemo<'extract' | 'replace'>(() => {
    const mode = selectedModule?.genome.chromosomes.action.operations?.[0]?.config?.mode;
    return mode === 'replace' ? 'replace' : 'extract';
  }, [selectedModule]);
  const patchHistory = useMemo(() => Object.values(patches), [patches]);
  const geneModel = useMemo(() => {
    if (!selectedModule) return null;
    return buildGeneViewModel(selectedModule, patchHistory, selectedModule.executionState || selectedModule.state);
  }, [patchHistory, selectedModule]);

  const [draftName, setDraftName] = useState(moduleName);

  useEffect(() => {
    setDraftName(moduleName);
  }, [moduleName, selectedModule?.id]);

  if (!currentPatch) {
    return (
      <aside className="w-inspector border-l border-border bg-bg-tertiary flex flex-col z-5">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary uppercase">
          <span className="text-2xs tracking-wide font-medium">Node Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs uppercase tracking-wide">
          NO PATCH SELECTED
        </div>
      </aside>
    );
  }

  if (!selectedModule) {
    return (
      <aside className="w-inspector border-l border-border bg-bg-tertiary flex flex-col z-5">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary uppercase">
          <span className="text-2xs tracking-wide font-medium">Node Inspector</span>
          <span className="text-text-tertiary text-2xs">[ID:---]</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs uppercase tracking-wide">
          SELECT A MODULE
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-inspector border-l border-border bg-bg-tertiary flex flex-col z-5">
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary uppercase">
        <span className="text-2xs tracking-wide font-medium">Node Inspector</span>
        <span className="text-text-tertiary text-2xs">[ID:{truncateId(selectedModule.id, 3).toUpperCase()}]</span>
      </div>

      <div className="p-4 border-b border-border space-y-3">
        <div>
          <label className="block text-2xs text-text-secondary uppercase tracking-wide mb-1">Module Name</label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value.toUpperCase())}
            onBlur={() => {
              const safeName = draftName.trim() || selectedModule.skillId;
              if (safeName !== moduleName) {
                updateModuleMetadata(currentPatch.id, selectedModule.id, safeName);
              }
            }}
            className="w-full bg-bg-primary border border-border text-text-primary px-2 py-2 text-xs font-mono uppercase outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-2xs text-text-secondary uppercase tracking-wide mb-1">Operation Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setModuleOperationMode(currentPatch.id, selectedModule.id, 'extract')}
              className={cn(
                'flex-1 h-8 border text-2xs tracking-wide uppercase transition-colors',
                operationMode === 'extract'
                  ? 'border-text-primary bg-text-primary text-bg-primary'
                  : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              EXTRACT
            </button>
            <button
              onClick={() => setModuleOperationMode(currentPatch.id, selectedModule.id, 'replace')}
              className={cn(
                'flex-1 h-8 border text-2xs tracking-wide uppercase transition-colors',
                operationMode === 'replace'
                  ? 'border-text-primary bg-text-primary text-bg-primary'
                  : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              REPLACE
            </button>
          </div>
        </div>

        {selectedModule.parameters.length > 0 && (
          <div>
            <label className="block text-2xs text-text-secondary uppercase tracking-wide mb-1">Parameters</label>
            <div className="space-y-1.5">
              {selectedModule.parameters.map((parameter) => (
                <div key={parameter.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <span className="text-2xs text-text-tertiary uppercase">{parameter.name}</span>
                  {parameter.type === 'toggle' ? (
                    <button
                      onClick={() => updateModuleParameter(currentPatch.id, selectedModule.id, parameter.id, !parameter.value)}
                      className={cn(
                        'h-6 px-2 border text-2xs uppercase transition-colors',
                        parameter.value
                          ? 'border-text-primary bg-text-primary text-bg-primary'
                          : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-elevated'
                      )}
                    >
                      {parameter.value ? 'ON' : 'OFF'}
                    </button>
                  ) : parameter.type === 'select' ? (
                    <select
                      value={String(parameter.value)}
                      onChange={(e) => updateModuleParameter(currentPatch.id, selectedModule.id, parameter.id, e.target.value)}
                      className="h-6 bg-bg-primary border border-border text-2xs px-2 uppercase outline-none focus:border-accent"
                    >
                      {(parameter.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={String(parameter.value ?? '')}
                      onChange={(e) => updateModuleParameter(currentPatch.id, selectedModule.id, parameter.id, e.target.value)}
                      className="h-6 w-28 bg-bg-primary border border-border text-2xs px-2 uppercase outline-none focus:border-accent"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary uppercase">
        <span className="text-2xs tracking-wide font-medium">Genome Sequence</span>
        <span className="text-text-secondary text-2xs">VER:{selectedModule.genome.version}</span>
      </div>

      <div className="p-4 bg-[#020202] flex-1 overflow-hidden flex flex-col items-center justify-center">
        {geneGrowthEnabled && geneModel ? (
          <MiniGene gene={geneModel} />
        ) : (
          <div className="font-mono text-2xs leading-3 text-text-secondary text-center whitespace-pre">
            <div>      <span className="text-text-primary">G</span>-7A      </div>
            <div>    ╱   ╲    </div>
            <div>   ╱     ╲   </div>
            <div>  ●=======●  </div>
            <div>   ╲     ╱   </div>
            <div>    ╲   ╱    </div>
            <div>      <span className="text-text-primary">C</span>-3B      </div>
            <div>    ╱   ╲    </div>
            <div>   ╱     ╲   </div>
            <div>  ○-------○  </div>
            <div>   ╲     ╱   </div>
            <div>    ╲   ╱    </div>
            <div>      <span className="text-text-primary">A</span>-9F      </div>
          </div>
        )}

        <div className="mt-6 w-full">
          <div className="flex justify-between text-text-secondary font-mono text-2xs mb-1">
            <span>FITNESS</span>
            <span>{selectedModule.genome.fitness.overall}%</span>
          </div>
          <div className="h-0.5 bg-[#222] w-full">
            <div className="h-full bg-text-primary" style={{ width: `${selectedModule.genome.fitness.overall}%` }} />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="font-mono text-2xs mb-2">CONSOLE_OUTPUT:</div>
        <div className="font-mono text-2xs text-text-secondary h-24 overflow-hidden space-y-0.5">
          <div className="text-text-tertiary">&gt; INIT_SEQUENCE_{truncateId(selectedModule.id, 3).toUpperCase()}</div>
          <div>&gt; CONNECTED TO [GMAIL_HOOK]</div>
          <div>&gt; WAITING FOR PAYLOAD...</div>
          <div>&gt; <span className="animate-blink">_</span></div>
        </div>
      </div>
    </aside>
  );
}
