/**
 * useGameEngine — React state owner for the pure board + meta state.
 *
 * Phase 2: full drop / merge / hold / undo / restart / overflow loop
 * lives here as pure state transitions. Legacy DOM still paints in
 * parallel until Phase 3 swaps components in.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  tierFromScore,
  objectiveForTier,
  objectiveProgress,
  guestQuestToObjective,
  boardSizeForTier,
  pointsForMerge,
  depthProgress,
  scoreAtTierStart,
  rankInfoFor,
  worldForTier,
  WORLDS,
  depthNameFor,
  createBoardState,
  dropTile as boardDrop,
  resolveUntilIdle,
  resolveStep,
  swapHold as boardSwapHold,
  undoDrop as boardUndo,
  restartBoard,
  clearEvents,
  initQueue,
  evaluateAchievements,
  awardAchievements,
  guestQuestAt,
  relicToAward,
  awardRelic,
  glyphFor,
  SIGILS,
  ACHIEVEMENTS,
  GUEST_SIGIL_LIMIT,
  SPIRE_SIGIL_LIMIT,
  type AchievementContext,
  type SkinId,
  type BoardState,
  type BoardEvent,
  type RankTitle,
  type Objective,
  type World,
  type GuestQuest,
  type Sigil,
  nextLevelInWorld,
  type CampaignLevel,
} from '../engine';

export type GamePhase =
  | 'splash'
  | 'login'
  | 'home'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'depthclear';

export type MetaState = {
  phase: GamePhase;
  highScore: number;
  /** Leaderboard-eligible best (Enter the Spire / ranked). Guest never writes this. */
  mainHighScore: number;
  /** Guest offline best per campaign level id */
  guestLevelBest: Record<string, number>;
  /** Active campaign level id when in guest practice */
  activeLevelId: string | null;
  activeWorldId: string | null;
  /** Override objective for campaign level runs */
  campaignObjective: Objective | null;
  bestTierReached: number;
  shards: number;
  equippedSkin: SkinId;
  playerName: string;
  vault: Set<string>;
  achievements: Set<string>;
  redeemedAchievements: Set<string>;
  ownedBoosts: Set<string>;
  ownedSkins: Set<string>;
  isGuest: boolean;
  isDaily: boolean;
  guestQuestIndex: number;
  paused: boolean;
  usedHoldThisRun: boolean;
  survivedDangerThisRun: boolean;
  highTilesThisRun: number;
  relicsThisRun: number;
  maxComboThisRun: number;
  combo: number;
  shardsEarnedThisRun: number;
  lastAnnouncedTier: number;
  /** Pending depth-clear celebration */
  depthClearFrom: number;
  depthClearTo: number;
  chainFlash: number;
  shapeCounts: Record<string, number>;
  dropsThisRun: number;
  scoreAtDepthStart: number;
  ownedSigils: Set<string>;
  /** Pending unlock overlay (sigil / power) */
  unlock: { kind: 'sigil' | 'power'; id: string; title: string; desc: string; iconSrc?: string; icon?: string } | null;
};

const defaultMeta = (): MetaState => ({
  phase: 'splash',
  highScore: 0,
  mainHighScore: 0,
  guestLevelBest: {},
  activeLevelId: null,
  activeWorldId: null,
  campaignObjective: null,
  bestTierReached: 0,
  shards: 0,
  equippedSkin: 'classic',
  playerName: 'Player',
  vault: new Set(),
  achievements: new Set(),
  redeemedAchievements: new Set(),
  ownedBoosts: new Set(),
  ownedSkins: new Set(['classic']),
  isGuest: true,
  isDaily: false,
  guestQuestIndex: 0,
  paused: false,
  usedHoldThisRun: false,
  survivedDangerThisRun: false,
  highTilesThisRun: 0,
  relicsThisRun: 0,
  maxComboThisRun: 0,
  combo: 0,
  shardsEarnedThisRun: 0,
  lastAnnouncedTier: 0,
  depthClearFrom: 0,
  depthClearTo: 0,
  chainFlash: 0,
  shapeCounts: {},
  dropsThisRun: 0,
  scoreAtDepthStart: 0,
  ownedSigils: new Set(),
  unlock: null,
});

export function useGameEngine() {
  const size0 = boardSizeForTier(0);
  const [board, setBoard] = useState<BoardState>(() =>
    createBoardState(size0.cols, size0.rows)
  );
  const [meta, setMeta] = useState<MetaState>(defaultMeta);
  const eventListeners = useRef<Set<(ev: BoardEvent) => void>>(new Set());

  const tier = useMemo(() => tierFromScore(board.score), [board.score]);
  const guestQuest: GuestQuest = useMemo(
    () => guestQuestAt(meta.guestQuestIndex),
    [meta.guestQuestIndex]
  );

  const objective: Objective = useMemo(() => {
    if (meta.campaignObjective) return meta.campaignObjective;
    if (meta.isGuest && !meta.isDaily) {
      return guestQuestToObjective(guestQuest);
    }
    return objectiveForTier(tier);
  }, [meta.campaignObjective, meta.isGuest, meta.isDaily, guestQuest, tier]);
  const world: World = useMemo(() => {
    if (meta.activeWorldId) {
      const w = WORLDS.find((x) => x.id === meta.activeWorldId);
      if (w) return w;
    }
    return worldForTier(tier);
  }, [meta.activeWorldId, tier]);
  const depthName = useMemo(() => depthNameFor(tier), [tier]);
  const rank: RankTitle = useMemo(
    () => rankInfoFor(meta.bestTierReached),
    [meta.bestTierReached]
  );
  const runStats = useMemo(
    () => ({
      score: board.score,
      merges: board.mergesThisRun,
      bestTile: board.bestTile,
      maxChain: board.maxChainThisRun,
      drops: meta.dropsThisRun,
      shapeCounts: meta.shapeCounts,
    }),
    [
      board.score,
      board.mergesThisRun,
      board.bestTile,
      board.maxChainThisRun,
      meta.dropsThisRun,
      meta.shapeCounts,
    ]
  );

  const progress = useMemo(() => {
    return objectiveProgress(objective, runStats, meta.scoreAtDepthStart);
  }, [objective, runStats, meta.scoreAtDepthStart]);
  

  const emitEvents = useCallback((events: BoardEvent[]) => {
    for (const ev of events) {
      eventListeners.current.forEach((fn) => fn(ev));
    }
  }, []);

  const onBoardEvent = useCallback((fn: (ev: BoardEvent) => void) => {
    eventListeners.current.add(fn);
    return () => {
      eventListeners.current.delete(fn);
    };
  }, []);

  const setPhase = useCallback((phase: GamePhase) => {
    setMeta((m) => ({ ...m, phase, paused: phase === 'paused' }));
  }, []);

  const startRun = useCallback(
    (opts?: { guest?: boolean; daily?: boolean; startTier?: number }) => {
      const startTier = opts?.startTier ?? 0;
      const guest = opts?.guest ?? true;
      const daily = opts?.daily ?? false;
      setMeta((m) => {
        const q = guestQuestAt(m.guestQuestIndex);
        const size =
          guest && !daily
            ? { cols: q.cols, rows: q.rows }
            : boardSizeForTier(startTier);
        const startScore = guest && !daily ? 0 : scoreAtTierStart(startTier);
        let s = restartBoard(size.cols, size.rows, startScore, startTier);
        s = initQueue(s, startTier);
        setBoard(s);
        return {
          ...m,
          phase: 'playing' as const,
          paused: false,
          isGuest: guest,
          isDaily: daily,
          usedHoldThisRun: false,
          survivedDangerThisRun: false,
          highTilesThisRun: 0,
          relicsThisRun: 0,
          maxComboThisRun: 0,
          combo: 0,
          shardsEarnedThisRun: 0,
          lastAnnouncedTier: startTier,
          depthClearFrom: 0,
          depthClearTo: 0,
          chainFlash: 0,
          shapeCounts: {},
          dropsThisRun: 0,
          scoreAtDepthStart: startScore,
          unlock: null,
          campaignObjective: guest ? m.campaignObjective : null,
          activeLevelId: guest ? m.activeLevelId : null,
          activeWorldId: guest ? m.activeWorldId : null,
        };
      });
    },
    []
  );


  /** Guest practice: start a specific world level + its quest. */
  const startCampaignLevel = useCallback((level: CampaignLevel) => {
    let s = restartBoard(level.cols, level.rows, 0, 0);
    s = initQueue(s, 0);
    setBoard(s);
    setMeta((m) => ({
      ...m,
      phase: 'playing',
      paused: false,
      isGuest: true,
      isDaily: false,
      usedHoldThisRun: false,
      survivedDangerThisRun: false,
      highTilesThisRun: 0,
      relicsThisRun: 0,
      maxComboThisRun: 0,
      combo: 0,
      shardsEarnedThisRun: 0,
      lastAnnouncedTier: 0,
      depthClearFrom: 0,
      depthClearTo: 0,
      chainFlash: 0,
      shapeCounts: {},
      dropsThisRun: 0,
      scoreAtDepthStart: 0,
      unlock: null,
      activeLevelId: level.id,
      activeWorldId: level.worldId,
      campaignObjective: level.objective,
    }));
  }, []);


  /** Resolve merges one step at a time so each pop paints. */
  const resolveAnimated = useCallback(
    (onDone: (final: BoardState, events: BoardEvent[]) => void) => {
      const collected: BoardEvent[] = [];
      let steps = 0;

      const tick = () => {
        setBoard((prev) => {
          if (prev.gameOver) {
            const done = { ...prev, busy: false, holdLocked: false };
            queueMicrotask(() => onDone(done, collected));
            return done;
          }

          const working = { ...prev, busy: true };
          const next = resolveStep(working);
          steps += 1;

          // Collect merge events from this step
          for (const ev of next.events) {
            if (ev.type === 'merge' || ev.type === 'settle' || ev.type === 'overflow') {
              collected.push(ev);
            }
          }

          const hadMerge = next.events.some((e) => e.type === 'merge');
          // resolveStep on no-pair returns busy:false
          if (!hadMerge || !next.busy || steps > 40) {
            const done = { ...next, busy: false, holdLocked: false };
            queueMicrotask(() => onDone(done, collected));
            return clearEvents(done);
          }

          // Show this merge, then continue
          window.setTimeout(tick, 300);
          return clearEvents({ ...next, busy: true });
        });
      };

      // Wait for drop fall, then start merge chain
      window.setTimeout(tick, 220);
    },
    []
  );

  const drop = useCallback(
    (col: number) => {
      if (meta.phase !== 'playing' || meta.paused) return;

      // Place orb immediately
      setBoard((prev) => {
        if (prev.busy || prev.gameOver) return prev;
        const placed = boardDrop(prev, col, tierFromScore(prev.score));
        if (placed === prev) return prev;

        // Shape quests count merge products only — not drops
        setMeta((m) => ({
          ...m,
          dropsThisRun: m.dropsThisRun + 1,
        }));
        queueMicrotask(() => emitEvents(placed.events));
        // Keep busy=true so a second tap can't interleave before resolve
        return { ...clearEvents(placed), busy: true };
      });


      resolveAnimated((finalBoard, mergeEventBag) => {
        const newEvents = mergeEventBag;
        const mergeEvents = newEvents.filter((e) => e.type === 'merge');
        const maxChainThisDrop = mergeEvents.reduce(
          (mx, e) => (e.type === 'merge' ? Math.max(mx, e.chain) : mx),
          0
        );
        const hadMerge = mergeEvents.length > 0;

        let highTiles = 0;
        let relics = 0;
        const vaultAdds: string[] = [];
        const shapeAdds: Record<string, number> = {};
        for (const ev of newEvents) {
          if (ev.type === 'merge') {
            if (ev.newValue >= 128) highTiles += 1;
            const name = relicToAward(ev.newValue, meta.vault);
            if (name) {
              vaultAdds.push(name);
              relics += 1;
            }
            const g = glyphFor(ev.newValue);
            shapeAdds[g] = (shapeAdds[g] || 0) + 1;
          }
        }

        // Ensure board is idle after animation
        setBoard((prev) => {
          const s = {
            ...finalBoard,
            busy: false,
            holdLocked: false,
            undosLeft:
              maxChainThisDrop >= 4 && finalBoard.undosLeft < 3
                ? finalBoard.undosLeft + 1
                : finalBoard.undosLeft,
          };
          return clearEvents(s);
        });

        setMeta((m) => {
          let vault = m.vault;
          for (const name of vaultAdds) vault = awardRelic(name, vault);
          const combo = hadMerge ? m.combo + 1 : 0;
          const shapeCounts = { ...m.shapeCounts };
          for (const [g, n] of Object.entries(shapeAdds)) {
            shapeCounts[g] = (shapeCounts[g] || 0) + n;
          }
          const s = finalBoard;
          const newTier = tierFromScore(s.score);
          const stats = {
            score: s.score,
            merges: s.mergesThisRun,
            bestTile: s.bestTile,
            maxChain: s.maxChainThisRun,
            drops: m.dropsThisRun,
            shapeCounts,
          };
          const obj =
            m.campaignObjective ||
            (m.isGuest && !m.isDaily
              ? guestQuestToObjective(guestQuestAt(m.guestQuestIndex))
              : objectiveForTier(m.lastAnnouncedTier));
          const prog = objectiveProgress(obj, stats, m.scoreAtDepthStart);
          const tierUp = !s.gameOver && prog.done;

          let ownedSigils = m.ownedSigils;
          let unlock = m.unlock;
          if (tierUp && !unlock) {
            const limit = m.isGuest ? GUEST_SIGIL_LIMIT : SPIRE_SIGIL_LIMIT;
            const nextSigil = SIGILS.find(
              (sg) =>
                !ownedSigils.has(sg.id) &&
                (sg.minTier ?? 0) <= Math.max(newTier, m.lastAnnouncedTier + 1) &&
                ownedSigils.size < limit
            );
            if (nextSigil) {
              ownedSigils = new Set(ownedSigils);
              ownedSigils.add(nextSigil.id);
              unlock = {
                kind: 'sigil' as const,
                id: nextSigil.id,
                title: nextSigil.name,
                desc: nextSigil.desc,
                iconSrc: nextSigil.iconSrc,
                icon: nextSigil.icon,
              };
            }
          }

          const achCtx: AchievementContext = {
            tier: newTier,
            score: s.score,
            chain: s.maxChainThisRun,
            vaultSize: vault.size,
            lifetimeMerges: s.lifetimeMerges,
            purchases: 0,
            skinChanges: 0,
            isGuest: m.isGuest,
          };
          const newlyAch = evaluateAchievements(achCtx, m.achievements);
          let achievements = m.achievements;
          let shards = m.shards;
          let shardsEarnedThisRun = m.shardsEarnedThisRun;
          if (newlyAch.length) {
            const aw = awardAchievements(newlyAch, m.achievements);
            achievements = aw.owned;
            shards += aw.shardsGained;
            shardsEarnedThisRun += aw.shardsGained;
          }

          const clearedTo = tierUp ? m.lastAnnouncedTier + 1 : m.depthClearTo;

          return {
            ...m,
            highTilesThisRun: m.highTilesThisRun + highTiles,
            relicsThisRun: m.relicsThisRun + relics,
            vault,
            achievements,
            shards,
            shardsEarnedThisRun,
            highScore: m.isGuest ? m.highScore : Math.max(m.highScore, s.score),
            mainHighScore: m.isGuest
              ? m.mainHighScore
              : Math.max(m.mainHighScore, s.score),
            guestLevelBest:
              m.isGuest && m.activeLevelId
                ? {
                    ...m.guestLevelBest,
                    [m.activeLevelId]: Math.max(
                      m.guestLevelBest[m.activeLevelId] || 0,
                      s.score
                    ),
                  }
                : m.guestLevelBest,
            bestTierReached: Math.max(m.bestTierReached, newTier, clearedTo),
            combo,
            maxComboThisRun: Math.max(m.maxComboThisRun, combo),
            chainFlash: maxChainThisDrop >= 2 ? maxChainThisDrop : 0,
            shapeCounts,
            ownedSigils,
            unlock: unlock || null,
            phase: s.gameOver
              ? 'gameover'
              : tierUp
                ? 'depthclear'
                : 'playing',
            depthClearFrom: tierUp ? m.lastAnnouncedTier : m.depthClearFrom,
            depthClearTo: tierUp ? clearedTo : m.depthClearTo,
            lastAnnouncedTier: tierUp ? clearedTo : m.lastAnnouncedTier,
            scoreAtDepthStart: tierUp ? s.score : m.scoreAtDepthStart,
          };
        });

        queueMicrotask(() => emitEvents(mergeEventBag));
      });
    },
    [meta.paused, meta.phase, meta.vault, emitEvents, resolveAnimated]
  );

  const clearBoardTiles = useCallback(() => {
    setBoard((prev) => ({
      ...prev,
      tiles: [],
      busy: false,
      holdLocked: false,
      lastDropSnapshot: null,
    }));
  }, []);

  const hold = useCallback(() => {
    setBoard((prev) => {
      if (prev.busy || prev.gameOver || meta.paused) return prev;
      if (meta.phase !== 'playing') return prev;
      const s = boardSwapHold(prev, tierFromScore(prev.score));
      if (s !== prev) {
        setMeta((m) => ({ ...m, usedHoldThisRun: true }));
        queueMicrotask(() => emitEvents(s.events));
        return clearEvents(s);
      }
      return prev;
    });
  }, [meta.paused, meta.phase, emitEvents]);

  const undo = useCallback(() => {
    setBoard((prev) => {
      if (prev.busy || prev.gameOver || meta.paused) return prev;
      const s = boardUndo(prev);
      if (s !== prev) {
        queueMicrotask(() => emitEvents(s.events));
        return clearEvents(s);
      }
      return prev;
    });
  }, [meta.paused, emitEvents]);

  const pause = useCallback(() => {
    setMeta((m) => {
      if (m.phase !== 'playing') return m;
      return { ...m, phase: 'paused', paused: true };
    });
  }, []);

  const resume = useCallback(() => {
    setMeta((m) => {
      if (m.phase !== 'paused') return m;
      return { ...m, phase: 'playing', paused: false };
    });
  }, []);

  const endRun = useCallback(() => {
    setBoard((prev) => ({ ...prev, gameOver: true, busy: false }));
    setMeta((m) => ({
      ...m,
      phase: 'gameover',
      highScore: Math.max(m.highScore, board.score),
      bestTierReached: Math.max(
        m.bestTierReached,
        tierFromScore(board.score)
      ),
    }));
  }, [board.score]);

  const goHome = useCallback(() => {
    setMeta((m) => ({
      ...m,
      phase: 'home',
      paused: false,
      unlock: null,
      campaignObjective: null,
      activeLevelId: null,
      activeWorldId: null,
    }));
  }, []);

  const goLogin = useCallback(() => {
    setMeta((m) => ({ ...m, phase: 'login', paused: false }));
  }, []);

  const checkAchievementsNow = useCallback(() => {
    setMeta((m) => {
      const ctx: AchievementContext = {
        tier: tierFromScore(board.score),
        score: board.score,
        chain: board.maxChainThisRun,
        vaultSize: m.vault.size,
        lifetimeMerges: board.lifetimeMerges,
        purchases: 0,
        skinChanges: 0,
      };
      const newly = evaluateAchievements(ctx, m.achievements);
      if (newly.length === 0) return m;
      const { owned, shardsGained } = awardAchievements(newly, m.achievements);
      return {
        ...m,
        achievements: owned,
        shards: m.shards + shardsGained,
        shardsEarnedThisRun: m.shardsEarnedThisRun + shardsGained,
      };
    });
  }, [board.score, board.maxChainThisRun, board.lifetimeMerges]);

  const redeemAchievement = useCallback((id: string) => {
    setMeta((m) => {
      if (!m.achievements.has(id) || m.redeemedAchievements.has(id)) return m;
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      const reward = def?.reward ?? 0;
      const redeemed = new Set(m.redeemedAchievements);
      redeemed.add(id);
      return {
        ...m,
        redeemedAchievements: redeemed,
        shards: m.shards + reward,
      };
    });
  }, []);

  const setPlayerName = useCallback((name: string) => {
    setMeta((m) => ({ ...m, playerName: name.slice(0, 12) || 'Player' }));
  }, []);

  const equipSkin = useCallback((id: SkinId) => {
    setMeta((m) => {
      if (!m.ownedSkins.has(id)) return m;
      return { ...m, equippedSkin: id };
    });
  }, []);


  const continueDepth = useCallback(() => {
    setMeta((m) => {
      // Campaign level clear → back to hub so next pick loads its own quest
      if (m.activeLevelId || m.campaignObjective) {
        const reward = 40;
        return {
          ...m,
          phase: 'home' as const,
          paused: false,
          unlock: null,
          campaignObjective: null,
          activeLevelId: null,
          activeWorldId: null,
          shards: m.shards + reward,
          shardsEarnedThisRun: m.shardsEarnedThisRun + reward,
          chainFlash: 0,
          shapeCounts: {},
          dropsThisRun: 0,
        };
      }

      const to = m.depthClearTo;
      const size = boardSizeForTier(to);
      setBoard((prev) => {
        let s = {
          ...prev,
          cols: size.cols,
          rows: size.rows,
          tiles: [],
          lastDropSnapshot: null,
          busy: false,
          gameOver: false,
        };
        s = initQueue(s, to);
        return s;
      });
      const reward = 30 + to * 15;
      return {
        ...m,
        phase: 'playing' as const,
        shards: m.shards + reward,
        shardsEarnedThisRun: m.shardsEarnedThisRun + reward,
        chainFlash: 0,
        unlock: null,
      };
    });
  }, []);

  const clearChainFlash = useCallback(() => {
    setMeta((m) => (m.chainFlash ? { ...m, chainFlash: 0 } : m));
  }, []);

  const dismissUnlock = useCallback(() => {
    setMeta((m) => (m.unlock ? { ...m, unlock: null } : m));
  }, []);

  return {
    board,
    meta,
    tier,
    objective,
    world,
    depthName,
    rank,
    progress,
    guestQuest,
    score: board.score,
    highScore: meta.highScore,
    /** Best for current context: campaign level, or main/guest overall */
    displayBest: meta.activeLevelId
      ? meta.guestLevelBest[meta.activeLevelId] || 0
      : meta.isGuest
        ? Object.values(meta.guestLevelBest).reduce((a, b) => Math.max(a, b), 0)
        : meta.mainHighScore,
    tiles: board.tiles,
    cols: board.cols,
    rows: board.rows,
    queue: board.queue,
    held: board.held,
    undosLeft: board.undosLeft,
    chain: board.chain,
    busy: board.busy,
    gameOver: board.gameOver,
    phase: meta.phase,
    setPhase,
    startRun,
    startCampaignLevel,
    drop,
    hold,
    clearBoardTiles,
    undo,
    pause,
    resume,
    endRun,
    goHome,
    goLogin,
    continueDepth,
    clearChainFlash,
    dismissUnlock,
    checkAchievementsNow,
    setPlayerName,
    redeemAchievement,
    equipSkin,
    onBoardEvent,
    pointsForMerge,
    scoreAtTierStart,
    boardSizeForTier,
  };
}

export type GameEngine = ReturnType<typeof useGameEngine>;
