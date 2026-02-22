import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ExecutionMetrics } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[1].split('.')[0];
}

export function truncateId(id: string, length: number = 8): string {
  return id.slice(0, length);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function getBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const controlPoint1X = startX + 50;
  const controlPoint1Y = startY;
  const controlPoint2X = endX - 50;
  const controlPoint2Y = endY;

  return `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;
}

export function calculateFitness(metrics: ExecutionMetrics): number {
  const reliability = metrics.totalRuns > 0 
    ? (metrics.successfulRuns / metrics.totalRuns) * 100 
    : 50;
  
  const efficiency = Math.max(0, 100 - (metrics.avgTokenUsage / 100));
  const utility = Math.min(metrics.usageCount / 10, 1) * 100;
  const satisfaction = metrics.ratings.length > 0
    ? (metrics.ratings.reduce((a, b) => a + b, 0) / metrics.ratings.length) * 20
    : 50;
  const adaptability = metrics.totalErrors > 0
    ? (metrics.recoveredErrors / metrics.totalErrors) * 100
    : 50;

  return Math.round((reliability + efficiency + utility + satisfaction + adaptability) / 5);
}

export function incrementVersion(version: string): string {
  const parts = version.split('.');
  const patch = parseInt(parts[2] || '0') + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

export function humanizeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
