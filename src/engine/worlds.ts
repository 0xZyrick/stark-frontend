/**
 * World / depth naming + board size / tier-from-score — pure from legacy game.js.
 */
import {
  WORLDS,
  DEPTH_NAMES,
  LORE_LINES,
  LEVEL_BOARD_SIZES,
  ENDLESS_BOARDS,
  SCORE_STAGE_THRESHOLDS,
  MAX_TIER,
} from './constants';
import type { World, BoardSize } from './types';

export function worldForTier(tier: number): World {
  if (tier <= 3) return WORLDS[0];
  if (tier <= 7) return WORLDS[1];
  if (tier <= 11) return WORLDS[2];
  return WORLDS[3];
}

export function depthInWorld(tier: number): number {
  if (tier <= 3) return tier + 1;
  if (tier <= 7) return tier - 3;
  if (tier <= 11) return tier - 7;
  return tier - 11;
}

export function depthNameFor(tier: number): string {
  if (tier < DEPTH_NAMES.length) return DEPTH_NAMES[tier];
  return `Endless ${tier - DEPTH_NAMES.length + 1}`;
}

export function loreLineFor(tier: number): string {
  return LORE_LINES[tier % LORE_LINES.length];
}

/** Board cols/rows for a campaign or endless depth. */
export function boardSizeForTier(tier: number): BoardSize {
  if (tier < LEVEL_BOARD_SIZES.length) return LEVEL_BOARD_SIZES[tier];
  return ENDLESS_BOARDS[(tier - LEVEL_BOARD_SIZES.length) % ENDLESS_BOARDS.length];
}

/** Score → depth tier (same climb rules as legacy currentTier). */
export function tierFromScore(score: number): number {
  let t = 0;
  for (const threshold of SCORE_STAGE_THRESHOLDS) {
    if (score >= threshold) t++;
    else break;
  }
  if (t >= SCORE_STAGE_THRESHOLDS.length) {
    let last = SCORE_STAGE_THRESHOLDS[SCORE_STAGE_THRESHOLDS.length - 1];
    let extra = score - last;
    let step = 2200;
    while (extra >= step && t < MAX_TIER) {
      t++;
      extra -= step;
      step = Math.floor(step * 1.15);
    }
  }
  return t;
}

export { WORLDS, DEPTH_NAMES, LORE_LINES };
