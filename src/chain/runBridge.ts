/**
 * Bridge between game run results and StarkGame on-chain settle.
 * Does not alter local gameplay — only called when Spire mode opts in.
 */
import {
  connectWallet,
  startRun as chainStartRun,
  settleRun as chainSettleRun,
  getPlayerBest,
  computeChecksum,
  computeMovesHash,
  getContract,
  getAccount,
} from './index';
import { GAME_ADDRESS } from './contract';
import type { Move } from './types';

export function isChainConfigured(): boolean {
  const addr = (import.meta.env.VITE_GAME_CONTRACT_ADDRESS as string | undefined)?.trim();
  return Boolean(addr && addr !== '0x0' && GAME_ADDRESS !== '0x0');
}

export type LocalRunSnapshot = {
  score: number;
  depth: number;
  bestTile: number;
  moves: Move[];
  seed: string;
  runId: number;
};

export async function beginOnChainRun(): Promise<{ runId: number; seed: string }> {
  if (!getContract() || !getAccount()) {
    throw new Error('Starknet account not connected');
  }
  return chainStartRun();
}

export async function settleOnChainRun(snap: LocalRunSnapshot): Promise<{ txHash: string }> {
  if (!getContract() || !getAccount()) {
    throw new Error('Starknet account not connected');
  }
  const movesHash = computeMovesHash(snap.moves);
  const checksum = computeChecksum(
    snap.seed,
    snap.score,
    snap.depth,
    snap.bestTile,
    movesHash,
  );
  const res = await chainSettleRun(
    snap.runId,
    snap.score,
    snap.depth,
    snap.bestTile,
    movesHash,
    checksum,
  );
  return { txHash: res.txHash };
}

export { connectWallet, getPlayerBest, isChainConfigured as chainReady };
