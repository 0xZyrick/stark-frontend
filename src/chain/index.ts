import { Account, Contract, RpcProvider, hash } from 'starknet';
import { GAME_ADDRESS, GAME_ABI } from './contract';
import type { Run, PlayerBest } from './types';

const RPC_URL = import.meta.env.VITE_STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';

let account: Account | null = null;
let contract: Contract | null = null;
let provider: RpcProvider | null = null;

export function getProvider(): RpcProvider {
    if (!provider) {
        provider = new RpcProvider({ nodeUrl: RPC_URL });
    }
    return provider;
}

export async function connectWallet(privateKey: string, address: string): Promise<Account> {
    const provider = getProvider();
    account = new Account(provider, address, privateKey);
    contract = new Contract(GAME_ABI, GAME_ADDRESS, account);
    return account;
}

export function getContract(): Contract | null {
    return contract;
}

export function getAccount(): Account | null {
    return account;
}

export async function startRun(): Promise<{ runId: number; seed: string }> {
    if (!contract) throw new Error('Contract not initialized');
    const result = await contract.start_run();
    return { runId: Number(result[0]), seed: result[1].toString() };
}

export async function settleRun(
    runId: number,
    score: number,
    depth: number,
    bestTile: number,
    movesHash: string,
    checksum: string,
): Promise<{ success: boolean; txHash: string }> {
    if (!contract || !account) throw new Error('Contract or account not initialized');
    
    const call = contract.populate('settle_run', [
        runId,
        score,
        depth,
        bestTile,
        movesHash,
        checksum,
    ]);
    
    const result = await account.execute(call);
    await account.waitForTransaction(result.transaction_hash);
    
    return { success: true, txHash: result.transaction_hash };
}

export async function getPlayerBest(address: string): Promise<PlayerBest> {
    if (!contract) throw new Error('Contract not initialized');
    // Matches the contract's (best_score, best_depth, best_run_id, total_runs).
    const result = await contract.get_player_best(address);
    return {
        best_score: Number(result[0]),
        best_depth: Number(result[1]),
        best_run_id: Number(result[2]),
        total_runs: Number(result[3]),
    };
}

export async function getRun(runId: number): Promise<Run> {
    if (!contract) throw new Error('Contract not initialized');
    const result = await contract.get_run(runId);
    return {
        player: result[0].toString(),
        score: Number(result[1]),
        depth: Number(result[2]),
        best_tile: Number(result[3]),
        checksum: result[4].toString(),
        timestamp: Number(result[5]),
        season_id: Number(result[6]),
    };
}

export function computeChecksum(
    seed: string,
    score: number,
    depth: number,
    bestTile: number,
    movesHash: string,
): string {
    // Must exactly match StarkGame::_compute_checksum on-chain:
    // poseidon_hash_span([seed, score, depth, best_tile, moves_hash]).
    // This used to be a hand-rolled xor/multiply mix that the contract had
    // no way of reproducing (it just summed the raw values), so every real
    // settle_run call was reverting with invalid_checksum.
    const elements = [seed, score, depth, bestTile, movesHash].map((v) => BigInt(v));
    return hash.computePoseidonHashOnElements(elements);
}

/** Poseidon hash over move records for settle_run.moves_hash */
export function computeMovesHash(moves: import('./types').Move[]): string {
  if (!moves.length) return '0';
  const elements: bigint[] = [];
  for (const m of moves) {
    elements.push(
      BigInt(m.action),
      BigInt(m.col),
      BigInt(m.row),
      BigInt(m.value),
      BigInt(m.next_value),
      BigInt(m.held_value),
      BigInt(m.chain_count),
      BigInt(m.is_modifier ? 1 : 0),
    );
  }
  return hash.computePoseidonHashOnElements(elements);
}
