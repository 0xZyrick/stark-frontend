/**
 * Quests / missions / daily / hidden — pure data + pure check helpers.
 * Check functions take an explicit context so they stay free of closed-over state.
 */
import {
  GUEST_QUESTS,
  SESSION_MISSIONS,
  DAILY_MISSIONS,
  HIDDEN_QUESTS,
} from './constants';
import type { GuestQuest, MissionDef } from './types';

export type RunContext = {
  score: number;
  tier: number;
  maxChainThisRun: number;
  mergesThisRun: number;
  bestTileThisRun: number;
  dropsThisRun: number;
  usedHoldThisRun: boolean;
  survivedDangerThisRun: boolean;
  highTilesThisRun: number;
  relicsThisRun: number;
  rerollsUsedThisRun: number;
  gameOver: boolean;
  vaultSize: number;
  lifetimeRuns: number;
};

export function guestQuestAt(index: number): GuestQuest {
  return GUEST_QUESTS[index % GUEST_QUESTS.length];
}

export function guestQuestProgress(
  quest: GuestQuest,
  ctx: {
    score: number;
    scoreAtStart: number;
    merges: number;
    mergesAtStart: number;
    bestTile: number;
    maxChain: number;
    drops: number;
  }
): { current: number; target: number; done: boolean } {
  const { type, target } = quest;
  let current = 0;
  switch (type) {
    case 'score':
      current = ctx.score;
      break;
    case 'merges':
      current = ctx.merges - ctx.mergesAtStart;
      break;
    case 'tile':
      current = ctx.bestTile;
      break;
    case 'limited-score':
      current = ctx.score - ctx.scoreAtStart;
      break;
    case 'chain':
      current = ctx.maxChain;
      break;
  }
  return { current, target, done: current >= target };
}

/** Session mission checks — pure against RunContext. */
export function sessionMissionChecks(): Record<
  string,
  (ctx: RunContext) => boolean
> {
  return {
    m_depth2: (c) => c.tier >= 1,
    m_relic3: (c) => c.vaultSize >= 3,
    m_chain4: (c) => c.maxChainThisRun >= 4,
    m_noreroll: (c) => c.gameOver && c.rerollsUsedThisRun === 0,
    m_danger: (c) => c.survivedDangerThisRun,
    m_score5k: (c) => c.score >= 5000,
    m_relicEarly: (c) => c.relicsThisRun >= 1 && c.tier < 2,
    m_runs3: (c) => c.lifetimeRuns >= 3,
  };
}

export function dailyMissionChecks(): Record<
  string,
  (ctx: RunContext) => boolean
> {
  return {
    d_score3k: (c) => c.score >= 3000,
    d_depth3: (c) => c.tier >= 2,
    d_chain3: (c) => c.maxChainThisRun >= 3,
  };
}

export function hiddenQuestChecks(): Record<
  string,
  (ctx: RunContext) => boolean
> {
  return {
    hq_silent: () => false, // placeholder in original
    hq_nohold: (c) => c.score >= 3000 && !c.usedHoldThisRun,
    hq_double: (c) => c.highTilesThisRun >= 2,
    hq_edge: (c) => c.survivedDangerThisRun,
    hq_first: (c) => c.relicsThisRun >= 1 && c.tier === 0,
  };
}

export function evaluateMissions(
  defs: MissionDef[],
  checks: Record<string, (ctx: RunContext) => boolean>,
  ctx: RunContext,
  alreadyDone: Set<string>
): MissionDef[] {
  const newly: MissionDef[] = [];
  for (const m of defs) {
    if (alreadyDone.has(m.id)) continue;
    const fn = checks[m.id];
    if (fn && fn(ctx)) newly.push(m);
  }
  return newly;
}

export {
  GUEST_QUESTS,
  SESSION_MISSIONS,
  DAILY_MISSIONS,
  HIDDEN_QUESTS,
};
