'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

export function DashboardActivityPanel() {
  const { patches } = useAppStore();
  const recentActivity = useMemo(
    () => Object.values(patches)
      .flatMap((patch) => patch.activityLog || [])
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40),
    [patches]
  );

  return (
    <aside className="w-inspector border-l border-border bg-bg-tertiary flex flex-col z-5">
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary uppercase">
        <span className="text-2xs tracking-wide font-medium">Recent Activity</span>
        <span className="text-text-tertiary text-2xs">[{String(recentActivity.length).padStart(3, '0')}]</span>
      </div>

      {recentActivity.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs uppercase tracking-wide">
          NO ACTIVITY YET
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {recentActivity.map((event) => (
            <div
              key={event.id}
              className="px-4 py-2 border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors"
            >
              <div className="flex items-center justify-between text-2xs text-text-secondary mb-1">
                <span className="font-mono">
                  {new Date(event.timestamp).toISOString().split('T')[1].split('.')[0]}
                </span>
                <span className={cn(
                  event.status === 'SUCCESS' && 'text-text-primary',
                  event.status === 'WARN' && 'text-text-secondary',
                  event.status === 'ERROR' && 'text-text-primary'
                )}>
                  {event.status}
                </span>
              </div>
              <div className="text-xs uppercase">{event.action}</div>
              <div className="text-2xs text-text-tertiary font-mono uppercase mt-0.5">
                {event.patchName}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
