/**
 * Ranked-run move log — pure port of legacy js/game-logic.js.
 * Used for checksum / settle; no DOM.
 */

export const MOVE_TYPES = {
  DROP: 'drop',
  MERGE: 'merge',
  HOLD: 'hold',
} as const;

export type MoveType = (typeof MOVE_TYPES)[keyof typeof MOVE_TYPES];

export type MoveEntry =
  | {
      type: 'drop';
      col: number;
      value: number;
      nextValue: number;
      isModifier: boolean;
      timestamp: number;
    }
  | {
      type: 'merge';
      col: number;
      row: number;
      value: number;
      chainCount: number;
      timestamp: number;
    }
  | {
      type: 'hold';
      col: number;
      value: number;
      heldValue: number;
      timestamp: number;
    };

let moveLog: MoveEntry[] = [];
let isLoggingEnabled = false;

export function logDrop(
  col: number,
  value: number,
  nextValue: number,
  isModifier = false
): void {
  if (!isLoggingEnabled) return;
  moveLog.push({
    type: MOVE_TYPES.DROP,
    col,
    value,
    nextValue: nextValue || 0,
    isModifier,
    timestamp: Date.now(),
  });
}

export function logMerge(
  col: number,
  row: number,
  newValue: number,
  chainCount = 1
): void {
  if (!isLoggingEnabled) return;
  moveLog.push({
    type: MOVE_TYPES.MERGE,
    col,
    row: row || 0,
    value: newValue,
    chainCount,
    timestamp: Date.now(),
  });
}

export function logHold(col: number, loadedValue: number, heldValue = 0): void {
  if (!isLoggingEnabled) return;
  moveLog.push({
    type: MOVE_TYPES.HOLD,
    col: col || 0,
    value: loadedValue,
    heldValue: heldValue || 0,
    timestamp: Date.now(),
  });
}

export function setLoggingEnabled(enabled: boolean): void {
  isLoggingEnabled = enabled;
  if (!enabled) moveLog = [];
}

export function resetMoveLog(): void {
  moveLog = [];
}

export function getMoveLog(): MoveEntry[] {
  return moveLog.slice();
}

export function getMoveCount(): number {
  return moveLog.length;
}

export function isLogging(): boolean {
  return isLoggingEnabled;
}

/** Compact representation for checksum / on-chain payload. */
export function compressMoves(moves: MoveEntry[] = moveLog): string {
  return moves
    .map((m) => {
      if (m.type === 'drop') {
        return `D${m.col}:${m.value}:${m.nextValue}:${m.isModifier ? 1 : 0}`;
      }
      if (m.type === 'merge') {
        return `M${m.col}:${m.row}:${m.value}:${m.chainCount}`;
      }
      return `H${m.col}:${m.value}:${m.heldValue}`;
    })
    .join('|');
}

export function decompressMoves(compressed: string): MoveEntry[] {
  if (!compressed) return [];
  return compressed.split('|').map((part) => {
    const kind = part[0];
    const rest = part.slice(1).split(':').map(Number);
    const ts = Date.now();
    if (kind === 'D') {
      return {
        type: 'drop' as const,
        col: rest[0],
        value: rest[1],
        nextValue: rest[2],
        isModifier: !!rest[3],
        timestamp: ts,
      };
    }
    if (kind === 'M') {
      return {
        type: 'merge' as const,
        col: rest[0],
        row: rest[1],
        value: rest[2],
        chainCount: rest[3],
        timestamp: ts,
      };
    }
    return {
      type: 'hold' as const,
      col: rest[0],
      value: rest[1],
      heldValue: rest[2],
      timestamp: ts,
    };
  });
}

/** Simple deterministic hash of the move stream (for settle checksum). */
export async function hashMoves(moves: MoveEntry[] = moveLog): Promise<string> {
  const payload = compressMoves(moves);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(payload);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback non-crypto hash
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function generateChecksum(moves: MoveEntry[] = moveLog): Promise<string> {
  return hashMoves(moves);
}

export function validateMoveLog(moves: MoveEntry[]): boolean {
  return Array.isArray(moves) && moves.every((m) => m && typeof m.type === 'string');
}

export function summarizeRun(moves: MoveEntry[] = moveLog): {
  drops: number;
  merges: number;
  holds: number;
  maxChain: number;
} {
  let drops = 0;
  let merges = 0;
  let holds = 0;
  let maxChain = 0;
  for (const m of moves) {
    if (m.type === 'drop') drops++;
    else if (m.type === 'merge') {
      merges++;
      maxChain = Math.max(maxChain, m.chainCount);
    } else if (m.type === 'hold') holds++;
  }
  return { drops, merges, holds, maxChain };
}
