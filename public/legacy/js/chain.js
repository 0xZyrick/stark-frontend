import { Account, Contract, RpcProvider, CairoCustomEnum, constants } from "https://esm.sh/starknet@10.0.2";
import { getWalletAddress, getWalletPrivateKey, isAuthenticated, loginWithPrivy } from './privy.js';

// =============================================
// CONFIG
// =============================================

const RPC_URL = "https://api.cartridge.gg/x/starknet/sepolia";
const CHAIN_ID = constants.StarknetChainId.SN_SEPOLIA;

// TODO: Replace with your deployed contract address
const ACTIONS_ADDRESS = "0x0";


const ACTIONS_ABI = [
  {
    type: "enum",
    name: "stark::models::RunMode",
    variants: [{ name: "Ranked", type: "()" }, { name: "Contest", type: "()" }],
  },
  {
    type: "enum",
    name: "stark::models::RunStatus",
    variants: [
      { name: "None", type: "()" },
      { name: "Started", type: "()" },
      { name: "Settled", type: "()" },
    ],
  },
  {
    type: "struct",
    name: "stark::models::Run",
    members: [
      { name: "player", type: "core::starknet::contract_address::ContractAddress" },
      { name: "season_id", type: "core::integer::u32" },
      { name: "mode", type: "stark::models::RunMode" },
      { name: "status", type: "stark::models::RunStatus" },
      { name: "score", type: "core::integer::u32" },
      { name: "depth", type: "core::integer::u32" },
      { name: "best_tile", type: "core::integer::u32" },
      { name: "checksum", type: "core::felt252" },
      { name: "started_at", type: "core::integer::u64" },
      { name: "settled_at", type: "core::integer::u64" },
    ],
  },
  {
    type: "struct",
    name: "stark::models::PlayerBest",
    members: [
      { name: "best_score", type: "core::integer::u32" },
      { name: "best_depth", type: "core::integer::u32" },
      { name: "best_run_id", type: "core::integer::u64" },
    ],
  },
  {
    type: "function",
    name: "start_run",
    inputs: [
      { name: "season_id", type: "core::integer::u32" },
      { name: "mode", type: "stark::models::RunMode" },
    ],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "settle_run",
    inputs: [
      { name: "run_id", type: "core::integer::u64" },
      { name: "score", type: "core::integer::u32" },
      { name: "depth", type: "core::integer::u32" },
      { name: "best_tile", type: "core::integer::u32" },
      { name: "checksum", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_player_best",
    inputs: [{ name: "player", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "stark::models::PlayerBest" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_run",
    inputs: [{ name: "run_id", type: "core::integer::u64" }],
    outputs: [{ type: "stark::models::Run" }],
    state_mutability: "view",
  },
];

// =============================================
// STATE
// =============================================

let account = null;
let actionsContract = null;
let readProvider = null;

function ensureReadProvider() {
    if (!readProvider) readProvider = new RpcProvider({ nodeUrl: RPC_URL });
    return readProvider;
}

// =============================================
// CONNECT (Uses Privy instead of Cartridge)
// =============================================

async function connect() {
    if (account) return account;
    
    try {
        const authed = await isAuthenticated();
        if (!authed) {
            await loginWithPrivy();
        }
        
        const address = await getWalletAddress();
        const privateKey = await getWalletPrivateKey();
        
        if (!address || !privateKey) {
            console.warn("[chain] No wallet found — continuing in guest mode");
            return null;
        }
        
        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        account = new Account(provider, address, privateKey);
        actionsContract = new Contract(ACTIONS_ABI, ACTIONS_ADDRESS, account);
        
        return account;
    } catch (e) {
        console.warn("[chain] connect failed — continuing in guest mode", e);
        account = null;
        return null;
    }
}

function isConnected() {
    return !!account;
}

function playerAddress() {
    return account ? account.address : null;
}

// =============================================
// RANKED RUN FUNCTIONS
// =============================================

function runModeEnum(mode) {
    return new CairoCustomEnum({ [mode === "Contest" ? "Contest" : "Ranked"]: {} });
}

async function startRun(seasonId = 1, mode = "Ranked") {
    await connect();
    if (!account || !actionsContract) return null;
    
    const call = actionsContract.populate("start_run", [seasonId, runModeEnum(mode)]);
    const res = await account.execute(call);
    const receipt = await account.waitForTransaction(res.transaction_hash);
    
    return extractRunIdFromReceipt(receipt);
}

function extractRunIdFromReceipt(receipt) {
    try {
        const events = receipt.events || [];
        const ourEvent = events.find(
            (e) => (e.from_address || "").toLowerCase() === ACTIONS_ADDRESS.toLowerCase(),
        );
        if (!ourEvent || !ourEvent.keys || ourEvent.keys.length < 2) return null;
        return BigInt(ourEvent.keys[1]).toString();
    } catch (e) {
        console.warn("[chain] could not decode run_id from receipt", e);
        return null;
    }
}

async function settleRun(runId, score, depth, bestTile, movesHash, checksum) {
    if (!account || !actionsContract || runId == null) {
        return { ok: false, reason: "not-ranked-or-not-connected" };
    }
    try {
        const call = actionsContract.populate("settle_run", [
            runId, score, depth, bestTile, movesHash, checksum
        ]);
        const res = await account.execute(call);
        await account.waitForTransaction(res.transaction_hash);
        return { ok: true, txHash: res.transaction_hash };
    } catch (e) {
        console.warn("[chain] settle_run failed", e);
        return { ok: false, reason: e && e.message ? e.message : "unknown-error" };
    }
}

// =============================================
// READ FUNCTIONS
// =============================================

async function getPlayerBest(player) {
    const addr = player || playerAddress();
    if (!addr) return null;
    try {
        const contract = actionsContract || new Contract(ACTIONS_ABI, ACTIONS_ADDRESS, ensureReadProvider());
        return await contract.call("get_player_best", [addr]);
    } catch (e) {
        console.warn("[chain] get_player_best failed", e);
        return null;
    }
}

async function getRun(runId) {
    if (runId == null) return null;
    try {
        const contract = actionsContract || new Contract(ACTIONS_ABI, ACTIONS_ADDRESS, ensureReadProvider());
        return await contract.call("get_run", [runId]);
    } catch (e) {
        console.warn("[chain] get_run failed", e);
        return null;
    }
}

// =============================================
// CHECKSUM
// =============================================

function computeChecksum(seed, score, depth, bestTile, movesHash) {
    let h = BigInt(seed || 0) + 0x100000001b3n;
    const mix = (h, n) => ((h ^ BigInt(n >>> 0)) * 0x100000001b3n) & ((1n << 250n) - 1n);
    h = mix(h, score || 0);
    h = mix(h, depth || 0);
    h = mix(h, bestTile || 0);
    h = mix(h, BigInt(movesHash) || 0n);
    return "0x" + h.toString(16);
}

// =============================================
// EXPORT
// =============================================

window.Chain = {
    connect,
    connectWallet: connect,
    isConnected,
    playerAddress,
    startRun,
    settleRun,
    getPlayerBest,
    getRun,
    computeChecksum,
};

export {
    connect,
    connect as connectWallet,
    isConnected,
    playerAddress,
    startRun,
    settleRun,
    getPlayerBest,
    getRun,
    computeChecksum,
};