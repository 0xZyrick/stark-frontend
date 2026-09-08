/** Shared pure types for the STARK engine — no DOM, no browser APIs. */

export type BoardSize = { cols: number; rows: number };

export type WorldId = 'outer' | 'mid' | 'core' | 'endless';

export type World = {
  id: WorldId;
  name: string;
  icon: string;
  scene: string;
  start: number;
  end: number;
};

/** Depth / quest objective kinds */
export type ObjectiveType =
  | 'score'
  | 'merges'
  | 'tile'
  | 'chain'
  | 'limited-score'
  | 'shape' // single glyph collect
  | 'shapes'; // multi-glyph collect (each must reach target)

export type Objective = {
  type: ObjectiveType;
  target: number;
  label: string;
  moves?: number;
  /** Glyph when type === 'shape' */
  symbol?: string;
  /** Glyphs when type === 'shapes' — each needs `target` collects */
  symbols?: string[];
};

export type GuestQuest = {
  name: string;
  description: string;
  type: ObjectiveType;
  target: number;
  cols: number;
  rows: number;
  moves?: number;
  symbol?: string;
  symbols?: string[];
};

export type RankTitle = {
  min: number;
  name: string;
  icon: string;
  iconSrc?: string;
  color: string;
  line: string;
};

export type SpirePower = {
  id: 'collapse' | 'echo' | 'silence' | 'forge';
  name: string;
  icon: string;
  tip: string;
};

export type ShopBoost = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
  color: string;
};

export type ShopSkin = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
};

export type Relic = {
  name: string;
  symbol: string;
  desc: string;
  unlock: string;
};

export type Sigil = {
  id: string;
  name: string;
  icon: string;
  /** Image path for badge art */
  iconSrc?: string;
  desc: string;
  /** Min tier (or mode) required */
  minTier?: number;
};

export type AchievementDef = {
  id: string;
  label: string;
  icon: string;
  cat: string;
  reward: number;
  check: (ctx: AchievementContext) => boolean;
};

export type AchievementContext = {
  tier: number;
  score: number;
  chain: number;
  vaultSize: number;
  lifetimeMerges: number;
  purchases: number;
  skinChanges: number;
  shapeCounts?: Record<string, number>;
  isGuest?: boolean;
};

export type MissionDef = {
  id: string;
  label: string;
  reward: number;
  icon: string;
  desc?: string;
  sigil?: string;
};

export type Tile = {
  id: number;
  col: number;
  row: number;
  value: number;
};

export type SkinId = 'classic' | 'neon' | 'sunset' | 'aurora' | 'codex' | string;

/** Live run counters for objective progress */
export type RunStats = {
  score: number;
  merges: number;
  bestTile: number;
  maxChain: number;
  drops: number;
  /** Count of orbs created per glyph this run */
  shapeCounts: Record<string, number>;
};
