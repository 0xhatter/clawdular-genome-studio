'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn, humanizeLabel } from '@/lib/utils';

export function Sidebar() {
  const { 
    patches, 
    currentPatchId, 
    loadPatch, 
    createPatch,
    skillLibrary,
    currentView,
    addModule
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGenomeSidebarCollapsed, setIsGenomeSidebarCollapsed] = useState(false);

  const patchList = Object.values(patches);
  const isCollapsibleWorkflowSidebarView = currentView === 'genome' || currentView === 'rhizome' || currentView === 'evolution';
  const isCollapsedGenomeSidebar = isCollapsibleWorkflowSidebarView && isGenomeSidebarCollapsed;

  useEffect(() => {
    if (!isCollapsibleWorkflowSidebarView) {
      setIsGenomeSidebarCollapsed(false);
    }
  }, [isCollapsibleWorkflowSidebarView]);

  const filteredSkills = skillLibrary.filter(skill => {
    const matchesSearch = `${skill.name} ${humanizeLabel(skill.name)}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const logicSkillCount = skillLibrary.filter((skill) => skill.category === 'logic').length;

  const handleCreatePatch = () => {
    const newPatch = createPatch(`WORKFLOW_${String(patchList.length + 1).padStart(3, '0')}`);
    loadPatch(newPatch.id);
  };

  const handleAddModule = (skillId: string) => {
    if (!currentPatchId) return;
    
    // Add module at a random position in the canvas
    const position = {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200
    };
    
    addModule(currentPatchId, skillId, position);
  };

  if (currentView === 'dashboard') {
    return (
      <aside className="w-sidebar border-r border-border bg-bg-tertiary flex flex-col z-5">
        <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-2xs tracking-wide uppercase font-medium">All Workflows</span>
          <span className="text-text-tertiary text-2xs">[{String(patchList.length).padStart(3, '0')}]</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {patchList.length === 0 ? (
            <div className="p-4 text-text-tertiary text-xs text-center">
              NO WORKFLOWS FOUND
            </div>
          ) : (
            patchList.map((patch) => (
              <div
                key={patch.id}
                onClick={() => loadPatch(patch.id)}
                className={cn(
                  'px-4 py-2 border-b border-border cursor-pointer flex justify-between items-center text-xs',
                  'hover:bg-bg-elevated hover:text-text-primary transition-colors',
                  currentPatchId === patch.id && 'bg-bg-elevated border-l-2 border-l-accent pl-3.5 text-text-primary'
                )}
              >
                <span className="font-mono uppercase">{patch.name}</span>
                <span className={cn(
                  'text-2xs',
                  patch.isRunning ? 'text-text-primary' : 'text-text-tertiary'
                )}>
                  {patch.isRunning ? 'RUNNING' : 'IDLE'}
                </span>
              </div>
            ))
          )}
        </div>

        <button
          onClick={handleCreatePatch}
          className="h-8 px-4 flex items-center justify-center border-t border-border bg-bg-tertiary text-2xs tracking-wide uppercase hover:bg-bg-elevated transition-colors"
        >
          [+] NEW WORKFLOW
        </button>
      </aside>
    );
  }

  if (isCollapsedGenomeSidebar) {
    return (
      <aside className="w-14 border-r border-border bg-bg-tertiary flex flex-col z-5">
        <div className="h-8 px-2 flex items-center justify-between border-b border-border bg-bg-tertiary">
          <span className="text-text-tertiary text-2xs">[{String(patchList.length).padStart(3, '0')}]</span>
          <button
            onClick={() => setIsGenomeSidebarCollapsed(false)}
            className="w-5 h-5 border border-border bg-bg-primary text-2xs hover:bg-bg-elevated transition-colors"
            title="Expand active workflows"
          >
            ›
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-sidebar border-r border-border bg-bg-tertiary flex flex-col z-5">
      {/* Active Workflows */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-tertiary">
        <span className="text-2xs tracking-wide uppercase font-medium">Active Workflows</span>
        <div className="flex items-center gap-1">
          <span className="text-text-tertiary text-2xs">[{String(patchList.length).padStart(3, '0')}]</span>
          {isCollapsibleWorkflowSidebarView && (
            <button
              onClick={() => setIsGenomeSidebarCollapsed(true)}
              className="w-5 h-5 border border-border bg-bg-primary text-2xs hover:bg-bg-elevated transition-colors"
              title="Collapse active workflows"
            >
              ‹
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[200px]">
        {patchList.map((patch) => (
          <div
            key={patch.id}
            onClick={() => loadPatch(patch.id)}
            className={cn(
              'px-4 py-2 border-b border-border cursor-pointer flex justify-between items-center text-xs',
              'hover:bg-bg-elevated hover:text-text-primary transition-colors',
              currentPatchId === patch.id && 'bg-bg-elevated border-l-2 border-l-accent pl-3.5 text-text-primary'
            )}
          >
            <span className="font-mono uppercase">{patch.name}</span>
            <span className={cn(
              'text-2xs',
              patch.isRunning ? 'text-text-primary' : 'text-text-tertiary'
            )}>
              {patch.isRunning ? 'RUNNING' : 'IDLE'}
            </span>
          </div>
        ))}
      </div>

      {/* Module Library */}
      <div className="h-8 px-4 flex items-center justify-between border-t border-b border-border bg-bg-tertiary">
        <span className="text-2xs tracking-wide uppercase font-medium">Module Library</span>
        <span className="text-text-tertiary text-2xs">[LOG:{String(logicSkillCount).padStart(2, '0')}]</span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="w-full bg-bg-primary border border-border text-text-primary px-2 py-2 text-xs font-mono outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {['input', 'process', 'output', 'logic'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={cn(
                'h-8 border border-border bg-bg-primary text-2xs tracking-wide uppercase',
                'hover:bg-bg-elevated hover:text-text-primary transition-colors',
                selectedCategory === cat && 'bg-text-primary text-bg-primary border-text-primary'
              )}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          {filteredSkills.length === 0 ? (
            <div className="px-2 py-4 text-center text-2xs text-text-tertiary uppercase">
              No matching modules
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => handleAddModule(skill.id)}
                disabled={!currentPatchId}
                className={cn(
                  'w-full px-3 py-2 border border-border bg-bg-primary text-left text-xs font-mono uppercase',
                  'hover:bg-bg-elevated hover:border-border-light transition-colors',
                  !currentPatchId && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex justify-between items-center">
                  <span>{humanizeLabel(skill.name)}</span>
                  <span className="text-text-tertiary text-2xs">{skill.category.toUpperCase()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
