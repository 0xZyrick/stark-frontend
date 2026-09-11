/**
 * Pre-login trial — Outer L1 + L2 only, local save under trial id.
 * On Privy login, merge into the real account.
 */
import { loadProgress, saveProgress, type SavedProgress } from './accountStore';

export const TRIAL_ACCOUNT_ID = 'stark-trial-local';

/** Levels playable without login */
export const TRIAL_LEVEL_IDS = ['outer-1', 'outer-2'] as const;

export function isTrialLevel(levelId: string): boolean {
  return (TRIAL_LEVEL_IDS as readonly string[]).includes(levelId);
}

export function mergeTrialIntoAccount(userId: string): SavedProgress | null {
  const trial = loadProgress(TRIAL_ACCOUNT_ID);
  if (!trial) return loadProgress(userId);

  const existing = loadProgress(userId);
  const guestLevelBest = { ...(existing?.guestLevelBest || {}) };
  for (const [k, v] of Object.entries(trial.guestLevelBest || {})) {
    guestLevelBest[k] = Math.max(guestLevelBest[k] || 0, v || 0);
  }
  const cleared = new Set([
    ...(existing?.guestClearedLevels || []),
    ...(trial.guestClearedLevels || []),
  ]);
  const merged: Partial<SavedProgress> = {
    playerName:
      existing?.playerName && existing.playerName.toLowerCase() !== 'player'
        ? existing.playerName
        : trial.playerName,
    guestLevelBest,
    guestClearedLevels: [...cleared],
    spireClearedFloors: [
      ...new Set([
        ...(existing?.spireClearedFloors || []),
        ...(trial.spireClearedFloors || []),
      ]),
    ],
    mainHighScore: Math.max(existing?.mainHighScore || 0, trial.mainHighScore || 0),
    shards: Math.max(existing?.shards || 0, trial.shards || 0),
    bestTierReached: Math.max(
      existing?.bestTierReached || 0,
      trial.bestTierReached || 0,
    ),
    dailyBest: Math.max(existing?.dailyBest || 0, trial.dailyBest || 0),
    dailyBestDate: existing?.dailyBestDate || trial.dailyBestDate,
  };
  saveProgress(userId, merged);
  return loadProgress(userId);
}
