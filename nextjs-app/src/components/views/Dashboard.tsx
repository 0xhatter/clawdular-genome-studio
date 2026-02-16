'use client';

import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { patches, loadPatch, createPatch, setView } = useAppStore();
  const patchList = Object.values(patches);
  const recentActivity = patchList
    .flatMap((patch) => patch.activityLog || [])
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12);

  const handleCreatePatch = () => {
    const newPatch = createPatch(`PATCH_${String(patchList.length + 1).padStart(3, '0')}`);
    loadPatch(newPatch.id);
    setView('patchbay');
  };

  const handleOpenPatch = (patchId: string) => {
    loadPatch(patchId);
    setView('patchbay');
  };

  return (
    <div className="flex-1 bg-bg-primary p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-lg tracking-widest uppercase mb-2">Dashboard</h1>
          <p className="text-text-secondary text-xs">
            MANAGE YOUR PATCHES AND WORKFLOWS
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-border bg-bg-secondary p-4">
            <div className="text-2xs text-text-secondary uppercase tracking-wide mb-1">
              Total Patches
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

        {/* Patches Grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm tracking-wide uppercase">Your Patches</h2>
          <button
            onClick={handleCreatePatch}
            className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            [+] NEW PATCH
          </button>
        </div>

        {patchList.length === 0 ? (
          <div className="border border-border bg-bg-secondary p-12 text-center">
            <div className="text-text-tertiary text-xs uppercase tracking-wide mb-4">
              NO PATCHES FOUND
            </div>
            <button
              onClick={handleCreatePatch}
              className="h-8 px-4 border border-border bg-bg-primary text-2xs tracking-wide uppercase hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              CREATE YOUR FIRST PATCH
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {patchList.map((patch) => (
              <div
                key={patch.id}
                onClick={() => handleOpenPatch(patch.id)}
                className={cn(
                  'border border-border bg-bg-secondary p-4 cursor-pointer',
                  'hover:border-border-light transition-colors'
                )}
              >
                {/* Patch visual thumbnail */}
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

                {/* Patch info */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs uppercase">{patch.name}</span>
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
                Create New Patch
              </span>
            </button>
          </div>
        )}

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-sm tracking-wide uppercase mb-4">Recent Activity</h2>
          <div className="border border-border bg-bg-secondary">
            <div className="grid grid-cols-4 gap-4 p-3 border-b border-border text-2xs text-text-secondary uppercase tracking-wide">
              <span>Time</span>
              <span>Action</span>
              <span>Patch</span>
              <span>Status</span>
            </div>
            {recentActivity.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-4 gap-4 p-3 border-b border-border last:border-b-0 text-xs hover:bg-bg-elevated transition-colors"
              >
                <span className="font-mono text-text-secondary">
                  {new Date(event.timestamp).toISOString().split('T')[1].split('.')[0]}
                </span>
                <span className="uppercase">
                  {event.action}
                </span>
                <span className="font-mono uppercase">{event.patchName}</span>
                <span className={event.status === 'SUCCESS' ? 'text-text-primary' : 'text-text-secondary'}>
                  {event.status}
                </span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="p-8 text-center text-text-tertiary text-xs uppercase">
                NO ACTIVITY YET
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
