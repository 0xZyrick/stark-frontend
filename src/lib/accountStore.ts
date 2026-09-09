/**
 * Per-account local progress (guest scores, cleared levels, main best).
 * Keyed by Privy user id so refresh keeps progression.
 */

export type SavedProgress = {
  playerName: string;
  guestLevelBest: Record<string, number>;
  /** Level ids cleared in guest mode (unlocks next level / world). */
  guestClearedLevels: string[];
  mainHighScore: number;
  shards: number;
  bestTierReached: number;
  updatedAt: number;
};

const prefix = 'stark-progress:';

function empty(): SavedProgress {
  return {
    playerName: 'Player',
    guestLevelBest: {},
    guestClearedLevels: [],
    mainHighScore: 0,
    shards: 0,
    bestTierReached: 0,
    updatedAt: 0,
  };
}

export function loadProgress(userId: string | null | undefined): SavedProgress | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(prefix + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    return {
      ...empty(),
      ...parsed,
      guestLevelBest: parsed.guestLevelBest || {},
      guestClearedLevels: Array.isArray(parsed.guestClearedLevels)
        ? parsed.guestClearedLevels
        : [],
    };
  } catch {
    return null;
  }
}

export function saveProgress(
  userId: string | null | undefined,
  data: Partial<SavedProgress> & { playerName?: string },
): void {
  if (!userId) return;
  try {
    const prev = loadProgress(userId) || empty();
    const next: SavedProgress = {
      playerName: data.playerName ?? prev.playerName,
      guestLevelBest: data.guestLevelBest ?? prev.guestLevelBest,
      guestClearedLevels: data.guestClearedLevels ?? prev.guestClearedLevels,
      mainHighScore: data.mainHighScore ?? prev.mainHighScore,
      shards: data.shards ?? prev.shards,
      bestTierReached: data.bestTierReached ?? prev.bestTierReached,
      updatedAt: Date.now(),
    };
    localStorage.setItem(prefix + userId, JSON.stringify(next));
    if (next.playerName) {
      localStorage.setItem(`stark-player-name:${userId}`, next.playerName);
    }
  } catch {
    /* ignore */
  }
}
