'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { patches, loadPatch, createPatch, setView, deletePatch, updatePatch } = useAppStore();
  const [selectedPatchIds, setSelectedPatchIds] = useState<string[]>([]);
  const [renamingPatchId, setRenamingPatchId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const patchList = Object.values(patches);

  useEffect(() => {
    const availablePatchIds = new Set(patchList.map((patch) => patch.id));
    setSelectedPatchIds((prev) => prev.filter((id) => availablePatchIds.has(id)));
  }, [patchList]);

  const handleCreatePatch = () => {
    const newPatch = createPatch(`PATCH_${String(patchList.length + 1).padStart(3, '0')}`);
    loadPatch(newPatch.id);
    setView('workflowCanvas');
  };

  const handleOpenPatch = (patchId: string) => {
    loadPatch(patchId);
    setView('workflowCanvas');
  };

  const handleTogglePatchSelection = (patchId: string) => {
    setSelectedPatchIds((prev) => (
      prev.includes(patchId)
        ? prev.filter((id) => id !== patchId)
        : [...prev, patchId]
    ));
  };

  const handleDeleteSelected = () => {
    if (selectedPatchIds.length === 0) return;
    selectedPatchIds.forEach((patchId) => deletePatch(patchId));
    setSelectedPatchIds([]);
    if (renamingPatchId && selectedPatchIds.includes(renamingPatchId)) {
      setRenamingPatchId(null);
      setRenameDraft('');
    }
  };

  const selectedCount = selectedPatchIds.length;
  const selectedCountLabel = useMemo(
    () => String(selectedCount).padStart(2, '0'),
    [selectedCount]
  );

  const startRename = (patchId: string, patchName: string) => {
    setRenamingPatchId(patchId);
    setRenameDraft(patchName);
  };

  const commitRename = (patchId: string, previousName: string) => {
    const nextName = renameDraft.trim().toUpperCase();
    if (!nextName) {
      setRenamingPatchId(null);
      setRenameDraft('');
      return;
    }

    if (nextName !== previousName) {
      updatePatch(patchId, { name: nextName });
    }
    setRenamingPatchId(null);
    setRenameDraft('');
  };

  return (
    <div className="flex-1 bg-bg-primary p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-lg tracking-widest uppercase mb-2">Dashboard</h1>
          <p className="text-text-secondary text-xs">
            MANAGE YOUR SKILL WORKFLOWS
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-border bg-bg-secondary p-4">
            <div className="text-2xs text-text-secondary uppercase tracking-wide mb-1">
              Total Workflows
            </div>
            <div className="text-2xl font-mono">
              {String(patchList.length).padStart(3, '0')}
            </div>
          </div>
          <div className="border border-border bg-bg-secondary p-4">
            <div className="text-2xs text-text-secondary uppercase tracking-wide mb-1">
              Active
            </div>
            <div className="text-2xl font-mono text-text-primary">
              {String(patchList.filter(p => p.isRunning).length).padStart(3, '0')}
            </div>
          </div>
          <div className="border border-border bg-bg-secondary p-4">
            <div className="text-2xs text-text-secondary uppercase tracking-wide mb-1">
              Avg Fitness
            </div>
            <div className="text-2xl font-mono">
              {patchList.length > 0
                ? Math.floor(patchList.reduce((acc, p) => acc + p.fitness.overall, 0) / patchList.length)
                : 0}
              /100
            </div>
          </div>
          <div className="border border-border bg-bg-secondary p-4">
            <div className="text-2xs text-text-secondary uppercase tracking-wide mb-1">
              Total Modules
            </div>
            <div className="text-2xl font-mono">
              {String(patchList.reduce((acc, p) => acc + p.modules.length, 0)).padStart(3, '0')}
            </div>
          </div>
        </div>

        {/* Workflows Grid */}
        <div className="mb-4 sticky top-0 z-20 bg-bg-primary py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm tracking-wide uppercase">Your Workflows</h2>
            <span className="text-2xs text-text-secondary uppercase">
              SELECTED:{selectedCountLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSelected}
              disabled={selectedCount === 0}
              className={cn(
                'h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase transition-colors',
                selectedCount === 0
                  ? 'opacity-50 cursor-not-allowed text-text-tertiary'
                  : 'hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              [−] DELETE SELECTED
            </button>
            <button
              onClick={handleCreatePatch}
              className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              [+] NEW WORKFLOW
            </button>
          </div>
        </div>

        {patchList.length === 0 ? (
          <div className="border border-border bg-bg-secondary p-12 text-center">
            <div className="text-text-tertiary text-xs uppercase tracking-wide mb-4">
              NO WORKFLOWS FOUND
            </div>
            <button
              onClick={handleCreatePatch}
              className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              CREATE YOUR FIRST WORKFLOW
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {patchList.map((patch) => (
              <div
                key={patch.id}
                onClick={() => handleOpenPatch(patch.id)}
                className={cn(
                  'border border-border bg-bg-secondary p-4 cursor-pointer relative',
                  'hover:border-border-light transition-colors',
                  selectedPatchIds.includes(patch.id) && 'border-border-light'
                )}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTogglePatchSelection(patch.id);
                  }}
                  className={cn(
                    'absolute top-2 right-2 z-20 w-5 h-5 border border-border bg-bg-primary text-2xs font-mono',
                    'hover:bg-bg-elevated transition-colors',
                    selectedPatchIds.includes(patch.id) && 'border-text-primary text-text-primary'
                  )}
                  title={selectedPatchIds.includes(patch.id) ? 'Deselect workflow' : 'Select workflow'}
                >
                  {selectedPatchIds.includes(patch.id) ? '✓' : ''}
                </button>

                {/* Workflow visual thumbnail */}
                <div className="h-24 bg-bg-primary border border-border mb-4 relative overflow-hidden">
                  {/* Mini module representation */}
                  {patch.modules.slice(0, 4).map((module, i) => (
                    <div
                      key={module.id}
                      className="absolute w-8 h-6 bg-bg-tertiary border border-border"
                      style={{
                        left: 10 + (i % 2) * 50,
                        top: 10 + Math.floor(i / 2) * 30
                      }}
                    />
                  ))}
                  {patch.modules.length > 4 && (
                    <div className="absolute bottom-2 right-2 text-2xs text-text-tertiary">
                      +{patch.modules.length - 4}
                    </div>
                  )}
                </div>

                {/* Workflow info */}
                <div className="flex items-center justify-between mb-2">
                  {renamingPatchId === patch.id ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setRenameDraft(event.target.value.toUpperCase())}
                      onBlur={() => commitRename(patch.id, patch.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitRename(patch.id, patch.name);
                        }
                        if (event.key === 'Escape') {
                          setRenamingPatchId(null);
                          setRenameDraft('');
                        }
                      }}
                      className="h-7 w-full max-w-[140px] bg-bg-primary border border-border text-xs font-mono uppercase px-2 outline-none focus:border-accent"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        startRename(patch.id, patch.name);
                      }}
                      className="font-mono text-xs uppercase truncate max-w-[140px] text-left"
                      title="Double-click to rename"
                    >
                      {patch.name}
                    </button>
                  )}
                  <span className={cn(
                    'text-2xs',
                    patch.isRunning ? 'text-text-primary' : 'text-text-tertiary'
                  )}>
                    {patch.isRunning ? 'RUNNING' : 'IDLE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-2xs text-text-secondary">
                  <div>
                    <span className="text-text-tertiary">GEN:</span> {String(patch.generation).padStart(3, '0')}
                  </div>
                  <div>
                    <span className="text-text-tertiary">FIT:</span> {String(patch.fitness.overall).padStart(3, '0')}
                  </div>
                  <div>
                    <span className="text-text-tertiary">MODS:</span> {String(patch.modules.length).padStart(2, '0')}
                  </div>
                </div>
              </div>
            ))}

            {/* Create new card */}
            <button
              onClick={handleCreatePatch}
              className="border border-border bg-bg-secondary p-4 flex flex-col items-center justify-center h-full min-h-[200px] hover:border-border-light transition-colors"
            >
              <div className="text-4xl text-text-tertiary mb-2">+</div>
              <span className="text-2xs uppercase tracking-wide text-text-secondary">
                Create New Workflow
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
