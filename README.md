# STARK — Descend the Spire (Legacy → React component)

Exact port of the `legacy-fixed` folder into a React component.

## What was done

- **No improvements, no removals, no structural changes.**
- Every HTML element, ID, class, comment, colour token and layout from the original `index.html` body is preserved 1:1.
- Original `css/style.css` is used unchanged.
- Original JS modules (`privy.js`, `chain.js`, `game-logic.js`, `game.js`) are served as-is from `/js/` and loaded in the same order.

## Structure

```
legacy-react/
├── index.html              # Vite entry + original importmap
├── package.json
├── vite.config.js
├── public/
│   ├── css/style.css       # exact original stylesheet
│   ├── js/                 # exact original modules
│   │   ├── privy.js
│   │   ├── chain.js
│   │   ├── game-logic.js
│   │   └── game.js
│   └── legacy/             # full original folder (reference)
└── src/
    ├── main.jsx
    ├── StarkLegacy.jsx     # the React component
    └── style.css           # exact original + root fill rules
```

## Usage

```bash
cd legacy-react
npm install
npm run dev
```

The component `StarkLegacy` can also be imported into any other React app:

```jsx
import StarkLegacy from './StarkLegacy.jsx'
import './style.css'   // must include the original style.css

function App() {
  return <StarkLegacy />
}
```

## Notes

- The original JS is written against a full-page document (getElementById on body descendants). The component injects the exact markup into a full-viewport root so those queries continue to work.
- Scripts are loaded once after mount via the same four module tags that appeared in the original `index.html`.
- Privy / Starknet importmap is kept in the host `index.html` exactly as in the legacy file.
- **Splash stuck fix:** the original `game.js` had `import` statements in the middle of the file (after an IIFE), which is invalid for ES modules — the browser refused to evaluate it, so the splash never hid. Imports were moved to the top of the file only; no other logic was changed. React StrictMode was also disabled so the game’s DOM mutations are not double-mounted. A small `window.storage` adapter (localStorage) was added so the game’s existing try/catch storage calls can persist progress.

---

## Phase 1 — Pure engine extraction (done)

The legacy game **still runs unchanged** via `StarkLegacy.jsx`. Alongside it, pure TypeScript modules now hold the deterministic rules:

```
src/engine/
  types.ts          shared types
  constants.ts      all tables (boards, ranks, shop, relics, achievements…)
  scoring.ts        pointsForMerge, tierFromScore, objectiveForTier, boardSizeForTier
  ranks.ts          rankInfoFor, chainWord
  worlds.ts         worldForTier, depthNameFor
  tiles.ts          symbolFor, paletteFor, orbBackground (no DOM)
  spawn.ts          spawnValue, distinctChoiceValues (RNG injectable)
  quests.ts         guest / session / daily / hidden mission checks
  shop.ts           catalog + purchase eligibility
  vault.ts          relic / sigil unlock rules
  achievements.ts   evaluateAchievements
  moveLog.ts        ranked-run move log + checksum helpers
  index.ts          re-exports

src/hooks/
  useGameEngine.ts  React state owner (starter; expands in later phases)

src/components/
  Board.tsx         column grid — same CSS classes as legacy
  Hud.tsx           header + depth + quest bar
  Toast.tsx         toast + relic pop
  Panel.tsx         overlay shell
```

**Nothing visual was changed.** CSS, markup structure, colours, and the running legacy scripts are intact.

### Next phases
2. Drive more of the run loop through `useGameEngine` while legacy UI still renders.
3. Swap DOM UI for Board / Hud / Panel / Toast components one screen at a time.
4. Isolate audio / haptics / narrator.

---

## Phase 2 — Run loop in useGameEngine (done)

Pure board engine + hook now own the full playable loop:

```
src/engine/board.ts     drop · merge · gravity · hold · undo · overflow · snapshot
src/hooks/useGameEngine.ts
  startRun / drop / hold / undo / pause / resume / endRun / goHome
  derived: tier, objective, world, rank, progress
  onBoardEvent(listener) for UI/sfx to subscribe
```

Rules match legacy `game.js` (pair scan order, points formula, gravity packing,
hold lock, undo snapshot, column overflow → game over).

**Still unchanged:** visuals, CSS, and the running legacy DOM game.
Phase 3 will point `Board` / `Hud` components at this hook instead of `document.*`.

---

## Phases 3 + 4 (done)

### Phase 4 — Isolated systems
```
src/audio/sound.ts      beep + all snd* + ambient music (Web Audio)
src/audio/haptics.ts    vibrate wrapper
src/audio/narrator.ts   speakNarrator line
```

### Phase 3 — React UI driven by engine
```
src/App.tsx             Splash → Login → Home → Game
src/pages/Splash.tsx
src/pages/LoginPage.tsx
src/pages/HomePage.tsx
src/pages/GamePage.tsx  Board + Hud + SideDock + pause/gameover panels
src/components/SideDock.tsx
```

- Same CSS classes / structure as legacy → same look
- `useGameEngine` owns drop/merge/hold/undo
- Board events → sound + haptics
- Keyboard: 1–N drop, H hold, U undo, Esc pause

### Run
```bash
cd legacy-react
npm install
npm run dev
```

Legacy shell still at `StarkLegacy.jsx` if you need the original DOM path.
