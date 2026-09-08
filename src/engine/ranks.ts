/**
 * Rank titles and chain words — pure lookup from legacy game.js.
 */
import { RANK_TITLES, CHAIN_WORDS } from './constants';
import type { RankTitle } from './types';

export function rankInfoFor(bestTier: number): RankTitle {
  let r = RANK_TITLES[0];
  for (const cand of RANK_TITLES) {
    if (bestTier >= cand.min) r = cand;
  }
  return r;
}

export function rankFor(bestTier: number): string {
  return rankInfoFor(bestTier).name;
}

export function chainWord(chain: number): string {
  if (chain >= 6) return 'LEGENDARY';
  if (chain >= 5) return 'INSANE';
  return CHAIN_WORDS[chain] || 'LEGENDARY';
}
