/**
 * Spawn value rules — graduated difficulty with anti-streak variety.
 *
 * Goals:
 * - Easy → hard as tier rises (base value climbs, assists fade, pressure rises)
 * - Never spam the same orb for a long stretch (streak cap)
 * - Still give merge fuel early without feeling pure random noise
 */
export type Rng = () => number; // [0, 1)

export type SpawnContext = {
  tier: number;
  /** Lowest value on the board (merge assist target). */
  minOnBoard: number | null;
  /** All values currently on the board (for match bias). */
  boardValues?: number[];
  /**
   * Recent spawned values (loaded/next history), newest last.
   * Used to block long streaks of the same number.
   */
  recentSpawns?: number[];
  rng?: Rng;
};

/** Max times the same value may appear back-to-back in the spawn stream. */
export const MAX_SPAWN_STREAK = 2;

/** How many recent spawns we consider for variety. */
export const SPAWN_HISTORY_LEN = 8;

export function boardMinValue(values: number[]): number | null {
  if (values.length === 0) return null;
  let min = Infinity;
  for (const v of values) if (v < min) min = v;
  return min;
}

function streakAtEnd(recent: number[], value: number): number {
  let n = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i] === value) n++;
    else break;
  }
  return n;
}

function countInRecent(recent: number[], value: number): number {
  let n = 0;
  for (const v of recent) if (v === value) n++;
  return n;
}

/**
 * Base orb for this depth: 2^(tier+1).
 * Tier 0 → 2, tier 1 → 4, tier 2 → 8, …
 */
export function baseForTier(tier: number): number {
  return Math.pow(2, Math.max(0, tier) + 1);
}

/**
 * Weighted pick from candidates. Weights must be > 0.
 */
function weightedPick(
  candidates: number[],
  weights: number[],
  rng: Rng
): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return candidates[candidates.length - 1] ?? 2;
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Build the candidate pool for this tier.
 * Always includes base, base*2, base*4; may include board match values.
 */
function buildCandidates(
  tier: number,
  minOnBoard: number | null,
  boardValues: number[]
): number[] {
  const base = baseForTier(tier);
  const set = new Set<number>([base, base * 2, base * 4]);

  // Board-aware options: values that can actually merge with something
  for (const v of boardValues) {
    if (v >= base / 2 && v <= base * 4) set.add(v);
  }
  if (minOnBoard != null && minOnBoard < base * 4) {
    set.add(minOnBoard);
  }

  // Mid/late: occasionally allow base*8 as rare pressure (not early)
  if (tier >= 4) set.add(base * 8);

  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Weight a candidate by tier (graduation) + board usefulness − streak penalty.
 */
function weightFor(
  value: number,
  tier: number,
  base: number,
  boardValues: number[],
  recent: number[]
): number {
  let w = 1;

  // --- Graduation: bias toward base early, toward higher later ---
  if (value === base) {
    // Early: base is common but not dominant; late: base still available for recovery
    w = tier <= 1 ? 1.15 : tier <= 3 ? 1.0 : Math.max(0.55, 1.0 - tier * 0.04);
  } else if (value === base * 2) {
    w = tier <= 1 ? 1.0 : tier <= 3 ? 1.15 : 1.2;
  } else if (value === base * 4) {
    w = tier <= 1 ? 0.35 : tier <= 3 ? 0.55 : Math.min(1.1, 0.45 + tier * 0.06);
  } else if (value === base * 8) {
    w = tier < 4 ? 0 : Math.min(0.45, 0.12 + (tier - 4) * 0.05);
  } else {
    // Board match / assist value
    w = 0.7;
  }

  // --- Match bias: if this value already sits on the board, slight boost (merge fuel) ---
  const onBoard = boardValues.filter((v) => v === value).length;
  if (onBoard > 0) {
    // Early: stronger assist; late: mild only
    const assistBoost =
      tier <= 1 ? 0.55 : tier <= 3 ? 0.35 : Math.max(0.08, 0.28 - tier * 0.03);
    w += assistBoost * Math.min(onBoard, 3);
  }

  // --- Anti-streak: hard block if already at MAX_SPAWN_STREAK in a row ---
  const streak = streakAtEnd(recent, value);
  if (streak >= MAX_SPAWN_STREAK) {
    return 0; // cannot pick
  }
  // Soft penalty if it appeared a lot in the recent window
  const recentCount = countInRecent(recent, value);
  if (recentCount >= 3) w *= 0.25;
  else if (recentCount >= 2) w *= 0.55;
  if (streak === 1) w *= 0.4; // discourage immediate repeat

  return Math.max(0, w);
}

/**
 * Decide the next orb value for the queue.
 */
export function spawnValue(
  tierOrCtx: number | SpawnContext,
  minOnBoard?: number | null,
  rng: Rng = Math.random
): number {
  // Back-compat: spawnValue(tier, minOnBoard, rng)
  let ctx: SpawnContext;
  if (typeof tierOrCtx === 'number') {
    ctx = {
      tier: tierOrCtx,
      minOnBoard: minOnBoard ?? null,
      rng,
    };
  } else {
    ctx = tierOrCtx;
  }

  const tier = ctx.tier;
  const boardValues = ctx.boardValues ?? [];
  const recent = (ctx.recentSpawns ?? []).slice(-SPAWN_HISTORY_LEN);
  const roll = ctx.rng ?? rng;
  const base = baseForTier(tier);
  const min = ctx.minOnBoard ?? boardMinValue(boardValues);

  // Occasional explicit assist toward board min (early game only, capped)
  const assistChance =
    tier <= 1 ? 0.28 : tier <= 3 ? 0.16 : Math.max(0.04, 0.14 - tier * 0.02);
  if (
    min != null &&
    min < base &&
    streakAtEnd(recent, min) < MAX_SPAWN_STREAK &&
    roll() < assistChance
  ) {
    return min;
  }

  const candidates = buildCandidates(tier, min, boardValues);
  const weights = candidates.map((v) =>
    weightFor(v, tier, base, boardValues, recent)
  );

  // If everything was zeroed by streak rules, fall back to first non-streak value
  const anyPositive = weights.some((w) => w > 0);
  if (!anyPositive) {
    for (const v of [base * 2, base * 4, base, base * 8]) {
      if (streakAtEnd(recent, v) < MAX_SPAWN_STREAK) return v;
    }
    return base * 2;
  }

  return weightedPick(candidates, weights, roll);
}

/** Three distinct choice values for the "pick next orb" overlay. */
export function distinctChoiceValues(
  tier: number,
  minOnBoard: number | null,
  rng: Rng = Math.random,
  boardValues: number[] = [],
  recentSpawns: number[] = []
): number[] {
  const vals = new Set<number>();
  let recent = [...recentSpawns];
  let guard = 0;
  while (vals.size < 3 && guard < 40) {
    const v = spawnValue({
      tier,
      minOnBoard,
      boardValues,
      recentSpawns: recent,
      rng,
    });
    vals.add(v);
    recent = [...recent, v].slice(-SPAWN_HISTORY_LEN);
    guard++;
  }
  const arr = Array.from(vals);
  while (arr.length < 3) {
    arr.push(arr[arr.length - 1] * 2);
  }
  return arr.slice(0, 3);
}
