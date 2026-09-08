/**
 * Pure board engine — drop / merge / gravity / hold / undo / overflow.
 * Exact rules from legacy game.js. No DOM.
 */
import { pointsForMerge } from './scoring';
import { spawnValue, boardMinValue, SPAWN_HISTORY_LEN, type Rng } from './spawn';
import { RELIC_NAMES, MERGE_SCORE_CAP } from './constants';
import type { Tile } from './types';

export type BoardTile = Tile & { isModifier?: boolean };

export type BoardSnapshot = {
  tiles: Array<{ col: number; row: number; value: number; isModifier?: boolean }>;
  queue: number[];
  held: number | null;
  score: number;
  bestTile: number;
  undosLeft: number;
};

export type BoardState = {
  cols: number;
  rows: number;
  tiles: BoardTile[];
  nextId: number;
  queue: number[]; // [loaded, next]
  held: number | null;
  holdLocked: boolean;
  score: number;
  bestTile: number;
  chain: number;
  maxChainThisRun: number;
  mergesThisRun: number;
  lifetimeMerges: number;
  undosLeft: number;
  busy: boolean;
  gameOver: boolean;
  lastDropSnapshot: BoardSnapshot | null;
  /** Recent spawned values (for anti-streak). Newest last. */
  recentSpawns: number[];
  /** Effects from last resolve step (for UI/sfx to consume). */
  events: BoardEvent[];
};

export type BoardEvent =
  | { type: 'drop'; col: number; row: number; value: number; tileId: number }
  | {
      type: 'merge';
      keepId: number;
      removeId: number;
      col: number;
      row: number;
      newValue: number;
      chain: number;
      points: number;
      hadModifier: boolean;
    }
  | { type: 'gravity' }
  | { type: 'overflow'; fullCols: number[] }
  | { type: 'ascend'; tileId: number; col: number; row: number; bonus: number }
  | { type: 'undo' }
  | { type: 'hold' }
  | { type: 'gameover' }
  | { type: 'settle' };

export function createBoardState(
  cols: number,
  rows: number,
  opts?: { undosLeft?: number; score?: number }
): BoardState {
  return {
    cols,
    rows,
    tiles: [],
    nextId: 1,
    queue: [2, 2],
    held: null,
    holdLocked: false,
    score: opts?.score ?? 0,
    bestTile: 2,
    chain: 0,
    maxChainThisRun: 0,
    mergesThisRun: 0,
    lifetimeMerges: 0,
    undosLeft: opts?.undosLeft ?? 1,
    busy: false,
    gameOver: false,
    lastDropSnapshot: null,
    recentSpawns: [],
    events: [],
  };
}

/** Next queue value using full spawn context (anti-streak + board-aware). */
function nextSpawn(state: BoardState, tier: number, rng: Rng): number {
  const boardValues = state.tiles.map((t) => t.value);
  const min = boardMinValue(boardValues);
  return spawnValue({
    tier,
    minOnBoard: min,
    boardValues,
    recentSpawns: state.recentSpawns,
    rng,
  });
}

function pushSpawn(state: BoardState, value: number): number[] {
  return [...state.recentSpawns, value].slice(-SPAWN_HISTORY_LEN);
}


export function tilesInColumn(state: BoardState, c: number): BoardTile[] {
  return state.tiles
    .filter((t) => t.col === c)
    .sort((a, b) => a.row - b.row);
}

export function lowestEmptyRow(state: BoardState, c: number): number {
  return tilesInColumn(state, c).length;
}

export function getTileAt(
  state: BoardState,
  c: number,
  r: number
): BoardTile | null {
  return state.tiles.find((t) => t.col === c && t.row === r) || null;
}

export function applyGravity(state: BoardState): BoardState {
  const tiles = state.tiles.map((t) => ({ ...t }));
  for (let c = 0; c < state.cols; c++) {
    const col = tiles
      .filter((t) => t.col === c)
      .sort((a, b) => a.row - b.row);
    col.forEach((t, i) => {
      t.row = i;
    });
  }
  return {
    ...state,
    tiles,
    events: [...state.events, { type: 'gravity' }],
  };
}

/** First adjacent pair (right or up) with equal value — same scan order as legacy. */
export function findAdjacentPair(
  state: BoardState
): [BoardTile, BoardTile] | null {
  for (const t of state.tiles) {
    const right = getTileAt(state, t.col + 1, t.row);
    if (right && right.value === t.value) return [t, right];
    const up = getTileAt(state, t.col, t.row + 1);
    if (up && up.value === t.value) return [t, up];
  }
  return null;
}

export function snapshotBoard(state: BoardState): BoardSnapshot {
  return {
    tiles: state.tiles.map((t) => ({
      col: t.col,
      row: t.row,
      value: t.value,
      isModifier: t.isModifier,
    })),
    queue: [...state.queue],
    held: state.held,
    score: state.score,
    bestTile: state.bestTile,
    undosLeft: state.undosLeft,
  };
}

export function initQueue(
  state: BoardState,
  tier: number,
  rng: Rng = Math.random
): BoardState {
  let s = { ...state, recentSpawns: [] as number[] };
  const a = nextSpawn(s, tier, rng);
  s = { ...s, recentSpawns: pushSpawn(s, a) };
  const b = nextSpawn(s, tier, rng);
  s = { ...s, recentSpawns: pushSpawn(s, b), queue: [a, b] };
  return s;
}

/**
 * Place loaded orb into column. Returns new state (busy=true) + drop event.
 * Caller should then call resolveStep in a loop until !busy.
 */
export function dropTile(
  state: BoardState,
  col: number,
  tier: number,
  rng: Rng = Math.random,
  opts?: { isModifier?: boolean }
): BoardState {
  if (state.busy || state.gameOver) return state;
  if (col < 0 || col >= state.cols) return state;
  const row = lowestEmptyRow(state, col);
  if (row >= state.rows) return state;

  const snap = snapshotBoard(state);
  const value = state.queue[0];
  const tileId = state.nextId;
  const tile: BoardTile = {
    id: tileId,
    col,
    row,
    value,
    isModifier: !!opts?.isModifier,
  };

  let queue = [...state.queue];
  queue[0] = queue[1];
  // Spawn next with board including the tile we just dropped
  const afterDrop: BoardState = {
    ...state,
    tiles: [...state.tiles, tile],
  };
  const nextVal = nextSpawn(afterDrop, tier, rng);
  queue[1] = nextVal;

  return {
    ...state,
    tiles: [...state.tiles, tile],
    nextId: state.nextId + 1,
    queue,
    recentSpawns: pushSpawn(state, nextVal),
    busy: true,
    chain: 0,
    holdLocked: false,
    lastDropSnapshot: snap,
    events: [
      ...state.events,
      { type: 'drop', col, row, value, tileId },
    ],
  };
}

/**
 * One resolve step: find pair → merge, or settle if none.
 * After a merge, apply gravity is left to the caller (or call resolveUntilIdle).
 */
export function resolveStep(state: BoardState): BoardState {
  if (state.gameOver) return state;
  const pair = findAdjacentPair(state);
  if (!pair) {
    // Settle
    let next: BoardState = {
      ...state,
      busy: false,
      holdLocked: false,
      chain: 0,
      events: [...state.events, { type: 'settle' }],
    };
    // Overflow check
    const fullCols: number[] = [];
    for (let c = 0; c < next.cols; c++) {
      if (tilesInColumn(next, c).length >= next.rows) fullCols.push(c);
    }
    if (fullCols.length > 0) {
      next = {
        ...next,
        gameOver: true,
        busy: false,
        events: [
          ...next.events,
          { type: 'overflow', fullCols },
          { type: 'gameover' },
        ],
      };
    }
    return next;
  }

  const [a0, b0] = pair;
  const hadModifier = !!(a0.isModifier || b0.isModifier);
  const newValue = a0.value + b0.value;
  const chain = state.chain + 1;
  let gained = pointsForMerge(newValue, chain);
  if (hadModifier) {
    gained = Math.min(MERGE_SCORE_CAP, Math.floor(gained * 1.5));
  }

  const tiles = state.tiles
    .filter((t) => t.id !== b0.id)
    .map((t) =>
      t.id === a0.id
        ? { ...t, value: newValue, isModifier: false }
        : { ...t }
    );

  let next: BoardState = {
    ...state,
    tiles,
    score: state.score + gained,
    bestTile: Math.max(state.bestTile, newValue),
    chain,
    maxChainThisRun: Math.max(state.maxChainThisRun, chain),
    mergesThisRun: state.mergesThisRun + 1,
    lifetimeMerges: state.lifetimeMerges + 1,
    events: [
      ...state.events,
      {
        type: 'merge',
        keepId: a0.id,
        removeId: b0.id,
        col: a0.col,
        row: a0.row,
        newValue,
        chain,
        points: gained,
        hadModifier,
      },
    ],
  };

  // Crown ascend: value reaches 2^RELIC_NAMES.length
  const crownValue = Math.pow(2, RELIC_NAMES.length);
  if (newValue >= crownValue) {
    const bonus = 25;
    const keep = next.tiles.find((t) => t.id === a0.id);
    next = {
      ...next,
      tiles: next.tiles.filter((t) => t.id !== a0.id),
      score: next.score + bonus,
      events: [
        ...next.events,
        {
          type: 'ascend',
          tileId: a0.id,
          col: keep?.col ?? a0.col,
          row: keep?.row ?? a0.row,
          bonus,
        },
      ],
    };
  }

  // Gravity after merge
  next = applyGravity(next);
  return next;
}

/** Keep resolving until board is idle (no more pairs / not busy). */
export function resolveUntilIdle(
  state: BoardState,
  maxSteps = 64
): BoardState {
  let s = state;
  let steps = 0;
  while (s.busy && !s.gameOver && steps < maxSteps) {
    s = resolveStep(s);
    steps++;
  }
  return s;
}

export function swapHold(state: BoardState, tier: number, rng: Rng = Math.random): BoardState {
  if (state.busy || state.gameOver) return state;
  // Parking into empty hold is locked until settle after a drop.
  // Swapping held ↔ loaded is always allowed so the player can take the
  // saved orb back (legacy feel users expect).
  if (state.held === null && state.holdLocked) return state;

  let queue = [...state.queue];
  let held = state.held;
  let recentSpawns = state.recentSpawns;
  if (held === null) {
    // Park loaded into hold; advance next into loaded
    held = queue[0];
    queue[0] = queue[1];
    const nextVal = nextSpawn(state, tier, rng);
    queue[1] = nextVal;
    recentSpawns = pushSpawn(state, nextVal);
  } else {
    // Swap held ↔ loaded (release held into loaded)
    const tmp = queue[0];
    queue[0] = held;
    held = tmp;
  }
  return {
    ...state,
    queue,
    held,
    recentSpawns,
    holdLocked: true,
    events: [...state.events, { type: 'hold' }],
  };
}

export function undoDrop(state: BoardState): BoardState {
  if (
    state.busy ||
    state.gameOver ||
    state.undosLeft <= 0 ||
    !state.lastDropSnapshot
  ) {
    return state;
  }
  const snap = state.lastDropSnapshot;
  const tiles: BoardTile[] = snap.tiles.map((st, i) => ({
    id: state.nextId + i,
    col: st.col,
    row: st.row,
    value: st.value,
    isModifier: st.isModifier,
  }));
  return {
    ...state,
    tiles,
    nextId: state.nextId + tiles.length,
    queue: [...snap.queue],
    held: snap.held,
    score: snap.score,
    bestTile: snap.bestTile,
    undosLeft: state.undosLeft - 1,
    lastDropSnapshot: null,
    chain: 0,
    busy: false,
    events: [...state.events, { type: 'undo' }],
  };
}

/** Clear events after UI has consumed them. */
export function clearEvents(state: BoardState): BoardState {
  return { ...state, events: [] };
}

/** Resize board (on depth change) — clears tiles. */
export function resizeBoard(
  state: BoardState,
  cols: number,
  rows: number
): BoardState {
  return {
    ...state,
    cols,
    rows,
    tiles: [],
    lastDropSnapshot: null,
  };
}

/** Full run restart at a given starting score (tier start). */
export function restartBoard(
  cols: number,
  rows: number,
  startScore: number,
  tier: number,
  rng: Rng = Math.random
): BoardState {
  let s = createBoardState(cols, rows, { score: startScore, undosLeft: 1 });
  s = initQueue(s, tier, rng);
  return s;
}
