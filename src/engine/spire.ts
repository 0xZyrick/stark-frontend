/**
 * Spire wing — underground floors (offline). Not the Guest campaign.
 */
import type { Objective } from './types';

export type SpireFloor = {
  id: string;
  depth: number;
  name: string;
  tagline: string;
  cols: number;
  rows: number;
  objective: Objective;
};

/** Vertical shaft — different pressure mix than Guest worlds */
export const SPIRE_FLOORS: SpireFloor[] = [
  {
    id: 'spire-1',
    depth: 1,
    name: 'Threshold Pit',
    tagline: 'First step under the compound',
    cols: 4,
    rows: 5,
    objective: { type: 'score', target: 1200, label: '1,200 in the pit' },
  },
  {
    id: 'spire-2',
    depth: 2,
    name: 'Lantern Vein',
    tagline: 'Light dies in the corners',
    cols: 4,
    rows: 5,
    objective: { type: 'chain', target: 3, label: '3-step chain' },
  },
  {
    id: 'spire-3',
    depth: 3,
    name: 'Pressure Hall',
    tagline: 'Moves are rationed',
    cols: 3,
    rows: 5,
    objective: {
      type: 'limited-score',
      target: 2000,
      moves: 16,
      label: '2,000 in 16 drops',
    },
  },
  {
    id: 'spire-4',
    depth: 4,
    name: 'Echo Gallery',
    tagline: 'Shapes that only form deep',
    cols: 4,
    rows: 4,
    objective: {
      type: 'shapes',
      target: 6,
      symbols: ['☄', '✺'],
      label: '6 ☄ and 6 ✺',
    },
  },
  {
    id: 'spire-5',
    depth: 5,
    name: 'Null Bridge',
    tagline: 'Narrow crossing',
    cols: 3,
    rows: 4,
    objective: { type: 'score', target: 4500, label: '4,500 across the bridge' },
  },
  {
    id: 'spire-6',
    depth: 6,
    name: 'Forge Mouth',
    tagline: 'Chain or break',
    cols: 4,
    rows: 5,
    objective: { type: 'chain', target: 4, label: '4-step chain' },
  },
  {
    id: 'spire-7',
    depth: 7,
    name: 'Quiet Core',
    tagline: 'Tight board, hard truth',
    cols: 3,
    rows: 3,
    objective: {
      type: 'limited-score',
      target: 3500,
      moves: 20,
      label: '3,500 in 20 drops',
    },
  },
  {
    id: 'spire-8',
    depth: 8,
    name: 'Root Seal',
    tagline: 'Bottom of the offline shaft',
    cols: 4,
    rows: 4,
    objective: {
      type: 'shapes',
      target: 5,
      symbols: ['❂', '♦', '✹'],
      label: '5 of ❂ ♦ ✹ each',
    },
  },
];

export function spireFloorById(id: string): SpireFloor | undefined {
  return SPIRE_FLOORS.find((f) => f.id === id);
}

export function isSpireFloorUnlocked(
  floorId: string,
  cleared: string[],
): boolean {
  const idx = SPIRE_FLOORS.findIndex((f) => f.id === floorId);
  if (idx <= 0) return true;
  const prev = SPIRE_FLOORS[idx - 1];
  return cleared.includes(prev.id);
}
