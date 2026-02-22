import type { IdeaNode, LifecycleStage, LifecycleState, NodeStatus } from '@/modules/simulacra/types';

export function hoursBetween(nowIso: string, createdAtIso: string): number {
  const deltaMs = new Date(nowIso).getTime() - new Date(createdAtIso).getTime();
  return Math.max(0, deltaMs / (1000 * 60 * 60));
}

export function stageFromAge(ageHours: number): LifecycleStage {
  if (ageHours < 1) return 'embryo';
  if (ageHours < 6) return 'infant';
  if (ageHours < 24) return 'juvenile';
  if (ageHours < 72) return 'adult';
  if (ageHours < 168) return 'elder';
  return 'fossil';
}

export function statusFromLifecycle(lifecycle: LifecycleState): NodeStatus {
  if (lifecycle.stage === 'fossil') return 'archived';
  if (lifecycle.health <= 0.2) return 'dormant';
  if (lifecycle.maturity < 0.2) return 'seed';
  if (lifecycle.maturity < 0.55) return 'growing';
  if (lifecycle.maturity >= 0.85) return 'mature';
  return 'refining';
}

export function updateLifecycle(node: IdeaNode, nowIso: string): LifecycleState {
  const ageHours = Number(hoursBetween(nowIso, node.createdAt).toFixed(2));
  const stage = stageFromAge(ageHours);
  const maturity = Number(Math.min(1, ageHours / 24).toFixed(2));
  const energyRatio = node.energy.max > 0 ? node.energy.current / node.energy.max : 0;
  const health = Number(Math.max(0, Math.min(1, (maturity * 0.45) + (energyRatio * 0.55))).toFixed(2));

  const nextStageAt = (() => {
    const created = new Date(node.createdAt).getTime();
    const hoursToNextStage = stage === 'embryo' ? 1 : stage === 'infant' ? 6 : stage === 'juvenile' ? 24 : stage === 'adult' ? 72 : stage === 'elder' ? 168 : undefined;
    if (hoursToNextStage === undefined) return undefined;
    return new Date(created + hoursToNextStage * 60 * 60 * 1000).toISOString();
  })();

  return {
    stage,
    ageHours,
    maturity,
    health,
    nextStageAt,
    canReproduce: ['juvenile', 'adult', 'elder'].includes(stage) && health > 0.35,
    canPollinate: ['adult', 'elder'].includes(stage) && health > 0.45,
  };
}
