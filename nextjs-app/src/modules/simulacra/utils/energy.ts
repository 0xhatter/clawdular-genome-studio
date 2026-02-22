import type { EnergyState, IdeaNode, Vitality } from '@/modules/simulacra/types';

export function vitalityFromEnergy(current: number, max: number): Vitality {
  const ratio = max <= 0 ? 0 : current / max;
  if (ratio <= 0.1) return 'dormant';
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 0.45) return 'struggling';
  if (ratio <= 0.75) return 'stable';
  return 'thriving';
}

export function calculateMetabolism(node: IdeaNode): number {
  const stageModifiers: Record<string, number> = {
    embryo: 1.9,
    infant: 1.35,
    juvenile: 1,
    adult: 0.8,
    elder: 0.55,
    fossil: 0,
  };

  const baseCost = node.energy.decayRate;
  const complexityCost = 0.25 * node.dna.complexity;
  const maturityCost = 0.2 * node.lifecycle.maturity;
  const stageCost = stageModifiers[node.lifecycle.stage] ?? 1;
  const attentionDiscount = Math.min(0.25, node.energy.attentionScore * 0.03);

  const rawCost = (baseCost + complexityCost + maturityCost) * stageCost;
  return Number(Math.max(0.05, rawCost - attentionDiscount).toFixed(2));
}

export function applyMetabolism(energy: EnergyState, cost: number, nowIso: string): EnergyState {
  const nextCurrent = Math.max(0, Number((energy.current - cost).toFixed(2)));
  const vitality = vitalityFromEnergy(nextCurrent, energy.max);

  return {
    ...energy,
    current: nextCurrent,
    lastActivity: nowIso,
    vitality,
  };
}

export function feedEnergy(energy: EnergyState, amount: number, nowIso: string): EnergyState {
  const nextCurrent = Math.min(energy.max, Number((energy.current + amount).toFixed(2)));
  return {
    ...energy,
    current: nextCurrent,
    attentionScore: Number((energy.attentionScore + Math.max(0.1, amount / 12)).toFixed(2)),
    lastActivity: nowIso,
    vitality: vitalityFromEnergy(nextCurrent, energy.max),
  };
}

export function drainEnergy(energy: EnergyState, amount: number, nowIso: string): EnergyState {
  const nextCurrent = Math.max(0, Number((energy.current - amount).toFixed(2)));
  return {
    ...energy,
    current: nextCurrent,
    lastActivity: nowIso,
    vitality: vitalityFromEnergy(nextCurrent, energy.max),
  };
}

export function energyTransferFromParents(parentA: IdeaNode, parentB: IdeaNode): number {
  const transfer = (parentA.energy.current + parentB.energy.current) * 0.12;
  return Number(Math.max(18, Math.min(45, transfer)).toFixed(2));
}
