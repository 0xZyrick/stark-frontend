/**
 * Scoring + depth objectives — score, shape-collect, move-limited, etc.
 */
import type { Objective, RunStats, GuestQuest } from './types';
import { SCORE_STAGE_THRESHOLDS, MERGE_SCORE_CAP, SCORE_MULTIPLIER } from './constants';
import { symbolFor } from './tiles';

export function scoreMultiplierForTier(_tier: number): number {
  return SCORE_MULTIPLIER;
}

export function pointsForMerge(newValue: number, chain: number): number {
  let pts = Math.max(2, newValue) * SCORE_MULTIPLIER;
  if (chain >= 2) pts = Math.floor(pts * (1 + 0.25 * Math.min(chain - 1, 4)));
  return Math.min(MERGE_SCORE_CAP, pts);
}

/**
 * Depth objectives — mix of score, shape collection, and move limits.
 * Shapes use gameplay glyphs (★ ☀ etc.), not plain text.
 */
export const LEVEL_OBJECTIVES: Objective[] = [
  { type: 'score', target: 1000, label: 'Reach 1,000' },
  // Multi-shape more often than single-shape
  {
    type: 'shapes',
    target: 8,
    symbols: ['★', '☀'],
    label: 'Collect 8 ★ and 8 ☀',
  },
  { type: 'score', target: 5000, label: 'Reach 5,000' },
  {
    type: 'shapes',
    target: 10,
    symbols: ['✦', '✧', '◆'],
    label: 'Collect 10 ✦ · 10 ✧ · 10 ◆',
  },
  { type: 'limited-score', target: 8000, moves: 25, label: 'Reach 8,000 in 25 drops' },
  {
    type: 'shapes',
    target: 12,
    symbols: ['★', '☀', '◆'],
    label: 'Collect 12 ★ · 12 ☀ · 12 ◆',
  },
  { type: 'score', target: 15000, label: 'Reach 15,000' },
  { type: 'chain', target: 4, label: 'Hit a 4-step chain' },
  {
    type: 'shapes',
    target: 15,
    symbols: ['✧', '☀', '☄'],
    label: 'Collect 15 ✧ · 15 ☀ · 15 ☄',
  },
  // Occasional single-shape (less frequent)
  { type: 'shape', target: 22, symbol: '★', label: 'Collect 22 ★ star orbs' },
  { type: 'score', target: 25000, label: 'Reach 25,000' },
  {
    type: 'shapes',
    target: 14,
    symbols: ['◆', '✹', '✺'],
    label: 'Collect 14 ◆ · 14 ✹ · 14 ✺',
  },
  { type: 'limited-score', target: 30000, moves: 30, label: 'Reach 30,000 in 30 drops' },
  {
    type: 'shapes',
    target: 18,
    symbols: ['★', '✦', '✧', '☀'],
    label: 'Collect 18 of ★ ✦ ✧ ☀ each',
  },
  { type: 'score', target: 40000, label: 'Reach 40,000' },
];

export function objectiveForTier(tier: number): Objective {
  if (tier < LEVEL_OBJECTIVES.length) return LEVEL_OBJECTIVES[tier];
  const last = SCORE_STAGE_THRESHOLDS[SCORE_STAGE_THRESHOLDS.length - 1] || 55000;
  const target = last + (tier - LEVEL_OBJECTIVES.length + 1) * 5000;
  // Endless: multi-shape more often (every 3rd); single-shape rarer (every 11th)
  if (tier % 3 === 0) {
    const pool = ['★', '☀', '◆', '✦', '✧', '☄', '✺', '✹'];
    const n = 2 + (tier % 3); // 2–4 shapes
    const symbols = [];
    for (let i = 0; i < n; i++) symbols.push(pool[(tier + i * 3) % pool.length]);
    const each = 10 + (tier % 8);
    return {
      type: 'shapes',
      target: each,
      symbols,
      label: `Collect ${each} of ${symbols.join(' ')} each`,
    };
  }
  if (tier % 11 === 0) {
    const shapes = ['★', '☀', '◆', '✦', '☄', '✺'];
    const sym = shapes[tier % shapes.length];
    return {
      type: 'shape',
      target: 20 + (tier % 10),
      symbol: sym,
      label: `Collect ${20 + (tier % 10)} ${sym} orbs`,
    };
  }
  if (tier % 5 === 0) {
    return {
      type: 'limited-score',
      target,
      moves: 28,
      label: `Reach ${target.toLocaleString()} in 28 drops`,
    };
  }
  return { type: 'score', target, label: `Reach ${target.toLocaleString()}` };
}

export function scoreAtTierStart(startTier: number): number {
  if (startTier <= 0) return 0;
  // Prefer explicit objective targets for score-type depths
  if (startTier <= SCORE_STAGE_THRESHOLDS.length) {
    return SCORE_STAGE_THRESHOLDS[startTier - 1] || 0;
  }
  return SCORE_STAGE_THRESHOLDS[SCORE_STAGE_THRESHOLDS.length - 1] || 0;
}

/** Progress toward current objective using full run stats */
export function objectiveProgress(
  obj: Objective,
  stats: RunStats,
  scoreAtDepthStart: number
): { current: number; target: number; pct: number; done: boolean; failed?: boolean } {
  const target = obj.target;
  let current = 0;
  let failed = false;

  switch (obj.type) {
    case 'score':
      current = stats.score;
      break;
    case 'limited-score':
      current = Math.max(0, stats.score - scoreAtDepthStart);
      if (obj.moves != null && stats.drops > obj.moves && current < target) {
        failed = true;
      }
      break;
    case 'merges':
      current = stats.merges;
      break;
    case 'tile':
      current = stats.bestTile;
      break;
    case 'chain':
      current = stats.maxChain;
      break;
    case 'shape':
      current = (obj.symbol && stats.shapeCounts[obj.symbol]) || 0;
      break;
    case 'shapes': {
      const syms = obj.symbols || [];
      if (syms.length === 0) {
        current = 0;
        break;
      }
      // Progress = how close the weakest required shape is (all must hit target)
      let minC = Infinity;
      for (const sym of syms) {
        const c = stats.shapeCounts[sym] || 0;
        if (c < minC) minC = c;
      }
      current = minC === Infinity ? 0 : minC;
      break;
    }
    default:
      current = stats.score;
  }

  const pct = Math.min(100, Math.floor((current / Math.max(1, target)) * 100));
  let done = current >= target && !failed;
  // Multi-shape: every listed glyph must reach target
  if (obj.type === 'shapes' && obj.symbols?.length) {
    done =
      !failed &&
      obj.symbols.every((sym) => (stats.shapeCounts[sym] || 0) >= target);
  }
  return { current, target, pct, done, failed };
}

/** Legacy helper still used by some UI */
export function depthProgress(score: number, tier: number) {
  const obj = objectiveForTier(tier);
  if (obj.type === 'score' || obj.type === 'limited-score') {
    let prev = 0;
    if (tier > 0 && tier <= SCORE_STAGE_THRESHOLDS.length) {
      prev = SCORE_STAGE_THRESHOLDS[tier - 1] || 0;
    }
    const span = Math.max(1, obj.target - prev);
    const current = Math.max(0, score - prev);
    return {
      current,
      target: obj.target,
      pct: Math.min(100, Math.floor((current / span) * 100)),
      prevThreshold: prev,
    };
  }
  return { current: 0, target: obj.target, pct: 0, prevThreshold: 0 };
}

export { symbolFor };


/** Practice / guest mode uses the rotating guest quest as the sole objective. */
export function guestQuestToObjective(q: GuestQuest): Objective {
  return {
    type: q.type,
    target: q.target,
    label: q.description || q.name,
    moves: q.moves,
    symbol: q.symbol,
    symbols: q.symbols,
  };
}
