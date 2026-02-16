'use client';

import { useAppStore } from '@/store/appStore';

export function Footer() {
  const { currentPatchId, patches } = useAppStore();
  const currentPatch = currentPatchId ? patches[currentPatchId] : null;

  const now = new Date();
  const timeString = now.toISOString().split('T')[1].split('.')[0];

  return (
    <footer className="h-status bg-bg-tertiary border-t border-border flex items-center px-4 text-2xs justify-between text-text-secondary">
      <div className="flex gap-4">
        <div className="flex gap-2">
          <span className="text-text-primary">CPU:</span>
          <span>12%</span>
        </div>
        <div className="flex gap-2">
          <span className="text-text-primary">MEM:</span>
          <span>4.2GB</span>
        </div>
        <div className="flex gap-2">
          <span className="text-text-primary">NET:</span>
          <span>1.2MB/s</span>
        </div>
      </div>

      <div className="flex gap-4">
        {currentPatch && (
          <>
            <div className="flex gap-2">
              <span>PATCH:</span>
              <span className="text-text-primary uppercase">{currentPatch.name}</span>
            </div>
            <div className="flex gap-2">
              <span>STATUS:</span>
              <span className={currentPatch.isRunning ? 'text-text-primary' : ''}>
                {currentPatch.isRunning ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-4">
        <span>{timeString} UTC</span>
      </div>
    </footer>
  );
}
