export const GAME_ADDRESS = import.meta.env.VITE_GAME_CONTRACT_ADDRESS || '0x0';

export const GAME_ABI = [
    // Full ABI from contract build
    {
        type: "function",
        name: "start_run",
        inputs: [],
        outputs: [{ type: "u64" }, { type: "felt252" }],
        state_mutability: "external",
    },
    {
        type: "function",
        name: "settle_run",
        inputs: [
            { name: "run_id", type: "u64" },
            { name: "score", type: "u32" },
            { name: "depth", type: "u32" },
            { name: "best_tile", type: "u32" },
            { name: "moves_hash", type: "felt252" },
            { name: "checksum", type: "felt252" },
        ],
        outputs: [],
        state_mutability: "external",
    },
    {
        type: "function",
        name: "get_player_best",
        inputs: [{ name: "player", type: "felt252" }],
        outputs: [
            { type: "u32" },
            { type: "u32" },
            { type: "u32" },
            { type: "u32" },
        ],
        state_mutability: "view",
    },
    {
        type: "function",
        name: "get_run",
        inputs: [{ name: "run_id", type: "u64" }],
        outputs: [
            { type: "felt252" },
            { type: "u32" },
            { type: "u32" },
            { type: "u32" },
            { type: "felt252" },
            { type: "u64" },
            { type: "u32" },
        ],
        state_mutability: "view",
    },
    {
        type: "function",
        name: "get_active_run",
        inputs: [{ name: "player", type: "felt252" }],
        outputs: [
            { type: "felt252" },
            { type: "u64" },
            { type: "u32" },
        ],
        state_mutability: "view",
    },
    {
        type: "function",
        name: "get_current_season",
        inputs: [],
        outputs: [{ type: "u32" }],
        state_mutability: "view",
    },
];