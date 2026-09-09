STARK — Descend the Spire

STARK is a fast, tactile orb-merge climber with two doors in:





Guest Mode — free practice. Beat your own best. No gas, no pressure.



Enter the Spire — ranked runs on Starknet. You pay network gas to start (and settle). Survive the board, post a Main Best, and climb the leaderboard.

Built as a React port of a tight vanilla original, then layered with real account login, a custodial game wallet, and on-chain settle so high scores mean something beyond localStorage.



The fantasy

You don’t “play a puzzle.” You descend a living Spire.

Orbs fall into columns. Match values, chain merges, and feel the board tighten as depths change size and quests. Hold one orb in reserve. Undo when you must. Clear a level’s objective — score thresholds, shape collects, tight move limits — and the Spire answers with the next floor.

Your companion mascot rides the edge of the board: cheers on long chains, coaches the first run, and clears the table when a depth falls.

Ranks stretch from first spark to deep core titles. Sigils and achievements mark what you’ve survived — not what you bought.



How to play





Drop — tap a column; the loaded orb falls in.



Merge — equal values combine; chains pay more and flash bigger praise.



Hold — park the loaded orb; tap again to swap.



Quest — fill the objective (score, shapes, moves…).



Don’t overflow — a full column ends the run.

Guest = personal bests only.
Spire = gas on Starknet → settle → leaderboard (Main Best only).



Modes







Mode



Cost



Counts on leaderboard





Guest



Free



No





Enter the Spire



Network gas (STRK on Sepolia)



Yes, after on-chain settle

Login uses Privy (email / Google / wallet). After login you get a game wallet address — fund it on Starknet Sepolia with STRK (fee token). That balance is what start/settle spend.



Stack





Frontend — React + Vite + TypeScript (Vercel)



Backend — Express API: wallet ensure, start_run, settle_run, leaderboard (Render / Railway / Fly)



Chain — Cairo StarkGame on Starknet Sepolia



Auth — Privy



Store — local ranked rows after successful settle (upgradeable to a DB later)

Contract (Sepolia): set VITE_GAME_CONTRACT_ADDRESS / GAME_CONTRACT_ADDRESS to your deploy.



Run locally

# frontend
cd frontend
cp .env.example .env   # VITE_PRIVY_APP_ID, VITE_API_URL, VITE_GAME_CONTRACT_ADDRESS
npm install
npm run dev

# backend
cd backend
cp .env.example .env   # PRIVY_*, GAME_CONTRACT_ADDRESS, CORS_ORIGIN
npm install
npm run dev



What “done” feels like

A clean Guest run that teaches the board.
A funded Spire entry that survives a depth.
A settle that writes your name onto the board for someone else to chase.

The Spire doesn’t care how you logged in. It only cares whether you can still merge when the columns run out of sky.



License / status

Personal / project build. Guest is production-ready for play. Ranked Spire depends on Sepolia funding, RPC health, and successful account txs — treat on-chain ranking as live beta until you’ve confirmed a full start → play → settle → leaderboard loop on your deploy.