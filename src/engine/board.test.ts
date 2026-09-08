/**
 * Lightweight pure tests for the board engine (no DOM / no React).
 * Run: npx tsx src/engine/board.test.ts
 */
import {
  createBoardState,
  dropTile,
  resolveUntilIdle,
  findAdjacentPair,
  applyGravity,
  swapHold,
  undoDrop,
  initQueue,
  tilesInColumn,
} from './board';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('  ok:', msg);
}

function run() {
  console.log('board engine tests');

  // 1. Drop places tile at row 0
  let s = createBoardState(4, 4);
  s = { ...s, queue: [2, 4] };
  s = dropTile(s, 0, 0, () => 0.5);
  assert(s.tiles.length === 1, 'one tile after drop');
  assert(s.tiles[0].col === 0 && s.tiles[0].row === 0, 'tile at 0,0');
  assert(s.tiles[0].value === 2, 'value 2');
  assert(s.busy === true, 'busy after drop');

  // 2. Settle with no pair
  s = resolveUntilIdle(s);
  assert(s.busy === false, 'idle after settle');
  assert(s.gameOver === false, 'not game over');

  // 3. Two same values adjacent horizontally merge
  s = createBoardState(4, 4);
  s = {
    ...s,
    tiles: [
      { id: 1, col: 0, row: 0, value: 2 },
      { id: 2, col: 1, row: 0, value: 2 },
    ],
    nextId: 3,
    busy: true,
    queue: [4, 4],
  };
  const pair = findAdjacentPair(s);
  assert(!!pair, 'finds horizontal pair');
  s = resolveUntilIdle(s);
  assert(s.tiles.length === 1, 'merged to one tile');
  assert(s.tiles[0].value === 4, 'merged value 4');
  assert(s.score > 0, 'score increased');

  // 4. Gravity packs down
  s = createBoardState(3, 4);
  s = {
    ...s,
    tiles: [
      { id: 1, col: 0, row: 2, value: 8 },
      { id: 2, col: 0, row: 3, value: 4 },
    ],
  };
  s = applyGravity(s);
  const col0 = tilesInColumn(s, 0);
  assert(col0[0].row === 0 && col0[0].value === 8, 'gravity bottom is 8');
  assert(col0[1].row === 1 && col0[1].value === 4, 'gravity second is 4');

  // 5. Hold swaps
  s = createBoardState(4, 4);
  s = { ...s, queue: [2, 8], held: null };
  s = swapHold(s, 0, () => 0.1);
  assert(s.held === 2, 'held loaded value');
  assert(s.holdLocked === true, 'hold locked');

  // 6. Undo restores snapshot
  s = createBoardState(4, 4);
  s = { ...s, queue: [2, 4] };
  s = dropTile(s, 1, 0, () => 0.5);
  s = resolveUntilIdle(s);
  const scoreAfter = s.score;
  const tilesAfter = s.tiles.length;
  s = undoDrop(s);
  assert(s.undosLeft === 0, 'undo consumed');
  assert(s.tiles.length === 0, 'board restored empty');
  assert(s.lastDropSnapshot === null, 'snapshot cleared');
  void scoreAfter;
  void tilesAfter;

  // 7. Overflow ends game
  s = createBoardState(2, 2);
  s = {
    ...s,
    tiles: [
      { id: 1, col: 0, row: 0, value: 2 },
      { id: 2, col: 0, row: 1, value: 4 },
    ],
    queue: [8, 8],
    busy: false,
  };
  // column 0 is full (2 rows) — drop into col 0 should reject
  const before = s.tiles.length;
  const s2 = dropTile(s, 0, 0, () => 0.5);
  assert(s2.tiles.length === before, 'cannot drop into full column');

  // fill and settle overflow
  s = {
    ...s,
    tiles: [
      { id: 1, col: 1, row: 0, value: 2 },
      { id: 2, col: 1, row: 1, value: 4 },
    ],
    busy: true,
  };
  s = resolveUntilIdle(s);
  assert(s.gameOver === true, 'overflow → game over');

  console.log('all board tests passed');
}

run();
