/**
 * Achievements — pure evaluation against a snapshot context.
 */
import { ACHIEVEMENTS } from './constants';
import type { AchievementDef, AchievementContext } from './types';

export function evaluateAchievements(
  ctx: AchievementContext,
  alreadyOwned: Set<string>
): AchievementDef[] {
  const newly: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (alreadyOwned.has(a.id)) continue;
    try {
      if (a.check(ctx)) newly.push(a);
    } catch {
      // never throw into the game loop
    }
  }
  return newly;
}

export function awardAchievements(
  newly: AchievementDef[],
  owned: Set<string>
): { owned: Set<string>; shardsGained: number } {
  const next = new Set(owned);
  let shardsGained = 0;
  for (const a of newly) {
    if (next.has(a.id)) continue;
    next.add(a.id);
    shardsGained += a.reward;
  }
  return { owned: next, shardsGained };
}

export function achievementProgress(owned: Set<string>): {
  done: number;
  total: number;
} {
  return { done: owned.size, total: ACHIEVEMENTS.length };
}

export { ACHIEVEMENTS };
