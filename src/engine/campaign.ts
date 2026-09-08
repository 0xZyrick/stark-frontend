/**
 * World → Level grid for guest practice.
 * Shape quests target mid/high glyphs (merge products), not starter ✦/✧.
 */
import type { Objective, WorldId } from './types';

export type CampaignLevel = {
  id: string;
  worldId: WorldId;
  level: number;
  name: string;
  cols: number;
  rows: number;
  objective: Objective;
  unlockHint?: string;
};

export type CampaignWorld = {
  id: WorldId;
  name: string;
  tagline: string;
  icon: string;
  iconSrc: string;
  scene: string;
  accent: string;
  levels: CampaignLevel[];
};

export const CAMPAIGN: CampaignWorld[] = [
  {
    id: 'outer',
    name: 'Outer Spire',
    tagline: 'First proofs in the shaft',
    icon: 'O',
    iconSrc: '/images/worlds/icon-outer.svg',
    scene: 'scene-outer',
    accent: '#ff9f1c',
    levels: [
      {
        id: 'outer-1',
        worldId: 'outer',
        level: 1,
        name: 'Threshold',
        cols: 4,
        rows: 4,
        objective: { type: 'score', target: 1200, label: 'Reach 1,200 score' },
      },
      {
        id: 'outer-2',
        worldId: 'outer',
        level: 2,
        name: 'Solar Pair',
        cols: 5,
        rows: 4,
        objective: {
          type: 'shapes',
          target: 6,
          symbols: ['★', '☀'],
          label: 'Merge 6 ★ and 6 ☀',
        },
      },
      {
        id: 'outer-3',
        worldId: 'outer',
        level: 3,
        name: 'Tight Gate',
        cols: 3,
        rows: 4,
        objective: {
          type: 'limited-score',
          target: 2000,
          moves: 18,
          label: 'Reach 2,000 in 18 drops',
        },
      },
      {
        id: 'outer-4',
        worldId: 'outer',
        level: 4,
        name: 'Comet Triad',
        cols: 4,
        rows: 5,
        objective: {
          type: 'shapes',
          target: 5,
          symbols: ['☀', '☄', '✺'],
          label: 'Merge 5 ☀ · 5 ☄ · 5 ✺',
        },
      },
    ],
  },
  {
    id: 'mid',
    name: 'Mid Spire',
    tagline: 'Pressure builds in the mid shaft',
    icon: 'M',
    iconSrc: '/images/worlds/icon-mid.svg',
    scene: 'scene-mid',
    accent: '#2ec4b6',
    levels: [
      {
        id: 'mid-1',
        worldId: 'mid',
        level: 1,
        name: 'Chain Test',
        cols: 6,
        rows: 5,
        objective: { type: 'chain', target: 4, label: 'Hit a 4-step chain' },
      },
      {
        id: 'mid-2',
        worldId: 'mid',
        level: 2,
        name: 'Nova Stack',
        cols: 6,
        rows: 4,
        objective: {
          type: 'shapes',
          target: 7,
          symbols: ['☄', '✺', '❂'],
          label: 'Merge 7 ☄ · 7 ✺ · 7 ❂',
        },
      },
      {
        id: 'mid-3',
        worldId: 'mid',
        level: 3,
        name: 'Sprint',
        cols: 5,
        rows: 5,
        objective: {
          type: 'limited-score',
          target: 6000,
          moves: 22,
          label: 'Reach 6,000 in 22 drops',
        },
      },
      {
        id: 'mid-4',
        worldId: 'mid',
        level: 4,
        name: 'Prism Deep',
        cols: 6,
        rows: 3,
        objective: {
          type: 'shapes',
          target: 5,
          symbols: ['✺', '❂', '♦'],
          label: 'Merge 5 ✺ · 5 ❂ · 5 ♦',
        },
      },
    ],
  },
  {
    id: 'core',
    name: 'Core',
    tagline: 'Heat of the sealed core',
    icon: 'C',
    iconSrc: '/images/worlds/icon-core.svg',
    scene: 'scene-core',
    accent: '#ff6b6b',
    levels: [
      {
        id: 'core-1',
        worldId: 'core',
        level: 1,
        name: 'Forge',
        cols: 5,
        rows: 5,
        objective: { type: 'score', target: 12000, label: 'Reach 12,000 score' },
      },
      {
        id: 'core-2',
        worldId: 'core',
        level: 2,
        name: 'Crown Path',
        cols: 4,
        rows: 4,
        objective: {
          type: 'shapes',
          target: 4,
          symbols: ['❂', '♦', '✹'],
          label: 'Merge 4 ❂ · 4 ♦ · 4 ✹',
        },
      },
      {
        id: 'core-3',
        worldId: 'core',
        level: 3,
        name: 'Insane Link',
        cols: 4,
        rows: 4,
        objective: { type: 'chain', target: 6, label: 'Hit a 6-step chain' },
      },
      {
        id: 'core-4',
        worldId: 'core',
        level: 4,
        name: 'Core Gate',
        cols: 3,
        rows: 3,
        objective: {
          type: 'limited-score',
          target: 18000,
          moves: 24,
          label: 'Reach 18,000 in 24 drops',
        },
      },
    ],
  },
  {
    id: 'endless',
    name: 'Endless Spire',
    tagline: 'No ceiling — offline free play',
    icon: '∞',
    iconSrc: '/images/worlds/icon-endless.svg',
    scene: 'scene-endless',
    accent: '#8b5cf6',
    levels: [
      {
        id: 'endless-1',
        worldId: 'endless',
        level: 1,
        name: 'Drift',
        cols: 4,
        rows: 5,
        objective: {
          type: 'score',
          target: 25000,
          label: 'Reach 25,000 score',
        },
      },
      {
        id: 'endless-2',
        worldId: 'endless',
        level: 2,
        name: 'Storm',
        cols: 3,
        rows: 5,
        objective: {
          type: 'shapes',
          target: 8,
          symbols: ['☄', '✺', '❂'],
          label: 'Merge 8 ☄ · 8 ✺ · 8 ❂',
        },
      },
      {
        id: 'endless-3',
        worldId: 'endless',
        level: 3,
        name: 'Abyss',
        cols: 4,
        rows: 4,
        objective: {
          type: 'score',
          target: 50000,
          label: 'Reach 50,000 score',
        },
      },
    ],
  },
];

export function worldById(id: WorldId): CampaignWorld | undefined {
  return CAMPAIGN.find((w) => w.id === id);
}

export function levelById(id: string): CampaignLevel | undefined {
  for (const w of CAMPAIGN) {
    const lv = w.levels.find((l) => l.id === id);
    if (lv) return lv;
  }
  return undefined;
}

/** Next level in same world, if any */
export function nextLevelInWorld(levelId: string): CampaignLevel | undefined {
  for (const w of CAMPAIGN) {
    const i = w.levels.findIndex((l) => l.id === levelId);
    if (i >= 0 && i + 1 < w.levels.length) return w.levels[i + 1];
  }
  return undefined;
}
