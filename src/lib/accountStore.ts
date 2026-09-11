/**
 * Per-account local progress (guest scores, cleared levels, main best).
 * Keyed by Privy user id so refresh keeps progression.
 */

export type SavedProgress = {
  playerName: string;
  guestLevelBest: Record<string, number>;
  /** Level ids cleared in guest mode (unlocks next level / world). */
  guestClearedLevels: string[];
  /** Offline Spire shaft floors cleared */
  spireClearedFloors: string[];
  mainHighScore: number;
  /** Best score for the calendar day (UTC date key). */
  dailyBest: number;
  dailyBestDate: string; // YYYY-MM-DD
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
    spireClearedFloors: [],
    mainHighScore: 0,
    dailyBest: 0,
    dailyBestDate: '',
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
      spireClearedFloors: Array.isArray(parsed.spireClearedFloors)
        ? parsed.spireClearedFloors
        : [],
      dailyBest: parsed.dailyBest ?? 0,
      dailyBestDate: parsed.dailyBestDate ?? '',
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
      spireClearedFloors: data.spireClearedFloors ?? prev.spireClearedFloors,
      mainHighScore: data.mainHighScore ?? prev.mainHighScore,
      dailyBest: data.dailyBest ?? prev.dailyBest,
      dailyBestDate: data.dailyBestDate ?? prev.dailyBestDate,
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


export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** All-time unchanged; daily best resets when the calendar day changes. */
export function effectiveDailyBest(saved: SavedProgress | null | undefined): number {
  if (!saved) return 0;
  if (saved.dailyBestDate !== todayKey()) return 0;
  return saved.dailyBest || 0;
}

export function nextDailyBest(saved: SavedProgress | null | undefined, score: number): {
  dailyBest: number;
  dailyBestDate: string;
} {
  const day = todayKey();
  const prev = saved && saved.dailyBestDate === day ? saved.dailyBest || 0 : 0;
  return { dailyBest: Math.max(prev, score), dailyBestDate: day };
}


/** Always write name under user id + a last-known fallback (survives id hiccups). */
export function savePlayerName(userId: string | null | undefined, name: string): void {
  const clean = name.trim().slice(0, 12);
  if (!clean || clean.toLowerCase() === 'player') return;
  try {
    localStorage.setItem('stark-player-name:last', clean);
    if (userId) {
      localStorage.setItem(`stark-player-name:${userId}`, clean);
      const prev = loadProgress(userId);
      saveProgress(userId, { ...(prev || {}), playerName: clean });
    }
  } catch {
    /* ignore */
  }
}

export function readPlayerName(userId: string | null | undefined): string | null {
  try {
    if (userId) {
      const fromProgress = loadProgress(userId)?.playerName;
      if (fromProgress && fromProgress.toLowerCase() !== 'player') return fromProgress;
      const keyed = localStorage.getItem(`stark-player-name:${userId}`);
      if (keyed && keyed.toLowerCase() !== 'player') return keyed;
    }
    const last = localStorage.getItem('stark-player-name:last');
    if (last && last.toLowerCase() !== 'player') return last;
  } catch {
    /* ignore */
  }
  return null;
}
