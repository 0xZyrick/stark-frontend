# Enabling Privy + Starknet (heavy install)

Only do this when you have **several GB free** disk space.

```bash
# free space first, then from legacy-react:
rm -rf node_modules package-lock.json
npm install
npm install starknet@6.24.1 viem@2.21.0 @privy-io/react-auth@1.88.0
```

Then copy real modules over stubs:
- `provider.privy.tsx` → replace `provider.tsx`
- Restore `session.ts` from git/history that uses `usePrivy` (or ask to re-apply)

Backend (`artifacts/backend`) is separate and lighter — install there only when wiring on-chain.
