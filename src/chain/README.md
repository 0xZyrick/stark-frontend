# Chain rails (Starknet)

These modules replace the broken `public/js/chain.js` stub.

- `contract.ts` — GAME_ADDRESS + ABI (`start_run`, `settle_run` with moves_hash, views)
- `index.ts` — RPC provider, account, startRun / settleRun / getPlayerBest / computeChecksum
- `types.ts` — Move, Run, PlayerBest, ActiveRun

**Required env:** `VITE_GAME_CONTRACT_ADDRESS` (your Sepolia deployment). Default `0x0` will fail on-chain calls.

**Signing gap:** Privy embedded wallets are Ethereum. Starknet `Account.execute` needs a Starknet key (ArgentX / Braavos / session key). See `src/privy/session.ts`.
