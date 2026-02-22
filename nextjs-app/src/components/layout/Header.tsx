'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/store/appStore';
import { ViewType } from '@/types';
import { cn } from '@/lib/utils';

const navItems: { id: ViewType; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'workflowCanvas', label: 'Workflow Canvas' },
  { id: 'genome', label: 'Genome' },
  { id: 'rhizome', label: 'Rhizome' },
  { id: 'simulacra', label: 'Simulacra' },
  { id: 'evolution', label: 'Evolution' },
];

export function Header() {
  const { currentView, setView, undo, redo, canUndo, canRedo, exportCurrentPatchJSON, importPatchFromJSON } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = exportCurrentPatchJSON();
    if (!payload) return;

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `clawdular-workflow-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    importPatchFromJSON(text);
  };

  return (
    <header className="h-header bg-bg-primary border-b border-border flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-3">
        <div className="relative w-[36px] h-[36px]">
          <Image
            src="/clawdular.svg"
            alt="Clawdular Logo"
            fill
            className="object-contain"
          />
        </div>
        <span className="text-xs font-press-start uppercase tracking-normal text-text-primary mt-1">
          CLAWDULAR DNA SEQUENCER
        </span>
      </div>

      <nav className="flex h-full">
        {navItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'flex items-center px-6 h-full text-2xs tracking-wide uppercase border-l border-border',
              'text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors',
              'relative',
              index === navItems.length - 1 && 'border-r border-border',
              currentView === item.id && 'text-text-primary bg-bg-secondary',
              currentView === item.id && 'after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-accent'
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <div className="flex items-center">
          <button
            onClick={undo}
            disabled={!canUndo()}
            className={cn(
              'w-8 h-8 border border-border bg-bg-primary text-text-secondary text-xs',
              'hover:text-text-primary hover:bg-bg-elevated transition-colors border-r-0',
              !canUndo() && 'opacity-50 cursor-not-allowed'
            )}
            title="Undo"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className={cn(
              'w-8 h-8 border border-border bg-bg-primary text-text-secondary text-xs',
              'hover:text-text-primary hover:bg-bg-elevated transition-colors',
              !canRedo() && 'opacity-50 cursor-not-allowed'
            )}
            title="Redo"
          >
            ↷
          </button>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleExport}
            className="h-8 px-2 border border-border bg-bg-primary text-text-secondary text-2xs uppercase tracking-wide hover:text-text-primary hover:bg-bg-elevated transition-colors border-r-0"
            title="Export current workflow"
          >
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-2 border border-border bg-bg-primary text-text-secondary text-2xs uppercase tracking-wide hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Import workflow JSON"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImportFile(file);
              }
              e.currentTarget.value = '';
            }}
          />
        </div>
        <span className="text-2xs text-text-secondary uppercase tracking-wide">
          SYS: ONLINE
        </span>
        <button className="w-8 h-8 border border-border bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors flex items-center justify-center text-xs">
          ×
        </button>
      </div>
    </header>
  );
}
