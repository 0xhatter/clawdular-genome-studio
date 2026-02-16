'use client';

import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';
import { Inspector } from '@/components/layout/Inspector';
import { PatchBayCanvas } from '@/components/patchbay/PatchBayCanvas';
import { Dashboard } from '@/components/views/Dashboard';
import { GenomeEditor } from '@/components/views/GenomeEditor';
import { Evolution } from '@/components/views/Evolution';
import { useAppStore } from '@/store/appStore';

export default function Home() {
  const { currentView, initializeRuntimeEvents } = useAppStore();

  useEffect(() => {
    initializeRuntimeEvents();
  }, [initializeRuntimeEvents]);

  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'patchbay':
        return <PatchBayCanvas />;
      case 'genome':
        return <GenomeEditor />;
      case 'evolution':
        return <Evolution />;
      default:
        return <PatchBayCanvas />;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {renderMainContent()}
        <Inspector />
      </div>
      
      <Footer />
    </div>
  );
}
