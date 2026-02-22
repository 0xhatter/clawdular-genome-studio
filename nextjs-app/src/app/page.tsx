'use client';

import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';
import { Inspector } from '@/components/layout/Inspector';
import { DashboardActivityPanel } from '@/components/layout/DashboardActivityPanel';
import { WorkflowCanvas } from '@/components/workflowCanvas/WorkflowCanvas';
import { Dashboard } from '@/components/views/Dashboard';
import { GenomeEditor } from '@/components/views/GenomeEditor';
import { Rhizome } from '@/components/views/Rhizome';
import { Simulacra } from '@/components/views/Simulacra';
import { Evolution } from '@/components/views/Evolution';
import { useAppStore } from '@/store/appStore';

export default function Home() {
  const { currentView, initializeRuntimeEvents, loadSkillLibrary } = useAppStore();

  useEffect(() => {
    initializeRuntimeEvents();
    loadSkillLibrary();
  }, [initializeRuntimeEvents, loadSkillLibrary]);

  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'workflowCanvas':
        return <WorkflowCanvas />;
      case 'genome':
        return <GenomeEditor />;
      case 'rhizome':
        return <Rhizome />;
      case 'simulacra':
        return <Simulacra />;
      case 'evolution':
        return <Evolution />;
      default:
        return <WorkflowCanvas />;
    }
  };

  const isSimulacraView = currentView === 'simulacra';

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {!isSimulacraView && <Sidebar />}
        {renderMainContent()}
        {currentView === 'dashboard' && <DashboardActivityPanel />}
        {(currentView === 'workflowCanvas' || currentView === 'genome' || currentView === 'evolution') && <Inspector />}
      </div>
      
      <Footer />
    </div>
  );
}
