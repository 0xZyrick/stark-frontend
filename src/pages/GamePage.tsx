/**
 * In-run game screen — Board + Hud + SideDock.
 * Steady world background (no per-drop colour shifts).
 * Chain words only (GREAT / WONDERFUL / …) — no combo badge.
 */
import { useEffect, useState } from 'react';
import { Board, Hud, SideDock, Toast, RelicPop, Panel } from '../components';
import { Tutorial } from '../components/Tutorial';
import { Mascot, MascotClearOverlay, speechForChain, idleTip } from '../components/Mascot';
import type { GameEngine } from '../hooks/useGameEngine';
import { playBoardEvent, sndLevelUp, sndWin, sndLose, unlockAudio } from '../audio/sound';
import { hapticForEvent, vibrate } from '../audio/haptics';
import { WORLD_BG, chainWord, depthNameFor, nextLevelInWorld, levelById } from '../engine';
import { isTrialLevel } from '../lib/trialSession';

type GamePageProps = {
  engine: GameEngine;
  show: boolean;
  /** Logged-out trial: block Next into L3+ */
  trialMode?: boolean;
  onTrialBlocked?: () => void;
};

export function GamePage({ engine, show, trialMode = false, onTrialBlocked }: GamePageProps) {
  const {
    tiles,
    cols,
    rows,
    score,
    highScore,
    displayBest,
    queue,
    held,
    undosLeft,
    meta,
    rank,
    progress,
    objective,
    world,
    drop,
    hold,
    undo,
    pause,
    resume,
    startRun,
    goHome,
    onBoardEvent,
    gameOver,
    phase,
    continueDepth,
    startCampaignLevel,
    clearBoardTiles,
    clearChainFlash,
    dismissUnlock,
    markGuestLevelCleared,
  } = engine;

  const [toast, setToast] = useState({
    visible: false,
    icon: '⭐',
    tag: '',
    name: '',
  });
  const [relic] = useState({ visible: false, glyph: '✦', name: '' });
  const [mascotClear, setMascotClear] = useState(false);
  const [tipTick, setTipTick] = useState(0);
  const [endReady, setEndReady] = useState(false);
  const [tutorial, setTutorial] = useState(() => {
    try { return localStorage.getItem('stark-tutorial-done') !== '1'; } catch { return true; }
  });

  const bgSrc = WORLD_BG[world.id] || WORLD_BG.outer;
  // Force scene class from active world

  // Flash GREAT / WONDERFUL / … on multi-merges (word only)

  // Level clear: cascade-clear board, then keep modal

  useEffect(() => {
    if (phase === 'depthclear' || phase === 'gameover' || gameOver) {
      setEndReady(false);
      const t = window.setTimeout(() => setEndReady(true), 4200);
      return () => window.clearTimeout(t);
    }
    setEndReady(false);
  }, [phase, gameOver]);

  
  useEffect(() => {
    if (phase !== 'depthclear') return;
    if (!meta.isGuest || !meta.activeLevelId) return;
    markGuestLevelCleared?.(meta.activeLevelId);
  }, [phase, meta.isGuest, meta.activeLevelId, markGuestLevelCleared]);

  useEffect(() => {
    if (phase !== 'depthclear') return;
    sndWin();
    setMascotClear(true);
    const t1 = window.setTimeout(() => clearBoardTiles(), 1400);
    const t2 = window.setTimeout(() => setMascotClear(false), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, clearBoardTiles]);

  useEffect(() => {
    if (phase === 'gameover') sndLose();
  }, [phase]);

  // tip interval
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setTipTick((n) => n + 1), 4500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (meta.chainFlash >= 2) {
      const t = window.setTimeout(
        () => clearChainFlash(),
        meta.chainFlash >= 5 ? 1600 : 1100
      );
      return () => clearTimeout(t);
    }
  }, [meta.chainFlash, clearChainFlash]);

  useEffect(() => {
    return onBoardEvent((ev) => {
      playBoardEvent(ev);
      hapticForEvent(ev);
      if (ev.type === 'ascend' && 'bonus' in ev) {
        setToast({
          visible: true,
          icon: '👑',
          tag: 'ASCENDED',
          name: `+${ev.bonus}`,
        });
        setTimeout(() => setToast((x) => ({ ...x, visible: false })), 1200);
      }
    });
  }, [onBoardEvent]);

  useEffect(() => {
    if (!show || phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= cols) drop(n - 1);
      if (e.key.toLowerCase() === 'h') hold();
      if (e.key.toLowerCase() === 'u') undo();
      if (e.key === 'Escape') pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, phase, cols, drop, hold, undo, pause]);

  return (
    <div
      className={`page game-page world-${world.id}${show ? ' show' : ''}`}
      id="gamePage"
      style={{ display: show ? 'flex' : 'none' }}
      aria-hidden={!show}
    >
      <div className="game-bg" id="gameBg">
        <img
          className="game-bg-img"
          id="gameBgImg"
          src={bgSrc}
          alt=""
          onLoad={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0.5';
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0';
          }}
        />
        <div className="game-bg-scrim" />
      </div>

      <Hud
        highScore={displayBest ?? highScore}
        portraitSrc="/images/mascot/orb.png"
        objective={objective}
        shapeCounts={meta.shapeCounts}
        score={score}
        playerName={meta.playerName}
        rank={rank}
        depthLabel={`DEPTH ${engine.tier + 1}`}
        questName={objective.label}
        questPct={progress.pct}
        questMeta={
          objective.type === 'shapes' && objective.symbols
            ? objective.symbols
                .map(
                  (sym) =>
                    `${meta.shapeCounts[sym] || 0}/${progress.target}${sym}`
                )
                .join(' · ')
            : objective.type === 'shape'
              ? `${progress.current} / ${progress.target} ${objective.symbol || ''} orbs`
              : objective.type === 'limited-score'
                ? `${progress.current.toLocaleString()} / ${progress.target.toLocaleString()} · ${meta.dropsThisRun}/${objective.moves || '—'} drops`
                : objective.type === 'chain'
                  ? `Best chain ${progress.current} / ${progress.target}`
                  : `${progress.current.toLocaleString()} / ${progress.target.toLocaleString()}`
        }
        combo={0}
        showCombo={false}
      />

      <div className="board-stage">
        <Board
        cols={cols}
        rows={rows}
        tiles={tiles}
        skin={meta.equippedSkin}
        sceneClass={world.scene}
        flashChain={meta.chainFlash}
        onColumnTap={(c) => {
          unlockAudio();
          drop(c);
        }}
      />
        {show && (phase === 'playing' || phase === 'paused') && (
          <div className="mascot-board-anchor" aria-live="polite">
            <Mascot
              mood={meta.chainFlash >= 2 ? 'cheer' : 'idle'}
              size={52}
              spin={meta.chainFlash >= 3}
              speech={
                meta.chainFlash >= 2
                  ? speechForChain(meta.chainFlash)
                  : tipTick % 5 === 0
                    ? `${meta.playerName || 'Player'}, so amazing`
                    : idleTip(tipTick)
              }
            />
          </div>
        )}
      </div>

      <SideDock
        loaded={queue[0] ?? 2}
        next={queue[1] ?? 2}
        held={held}
        undosLeft={undosLeft}
        skin={meta.equippedSkin}
        onHold={() => {
          unlockAudio();
          hold();
        }}
        onUndo={undo}
        onPause={pause}
      />

      {/* Chain word only — GREAT / WONDERFUL / EXCELLENT / INSANE / LEGENDARY */}
      <div
        className={`chain-reward${meta.chainFlash >= 2 ? ' show' : ''}`}
        id="chainRewardEl"
        style={{
          color:
            meta.chainFlash >= 6
              ? '#ffd27a'
              : meta.chainFlash >= 5
                ? '#9df24d'
                : meta.chainFlash >= 4
                  ? '#ff6b6b'
                  : meta.chainFlash >= 3
                    ? '#ff9d3f'
                    : '#ffb648',
          animationDuration:
            meta.chainFlash >= 6
              ? '1600ms'
              : meta.chainFlash >= 4
                ? '1350ms'
                : '1100ms',
        }}
      >
        {meta.chainFlash >= 2 ? `${chainWord(meta.chainFlash)}!` : ''}
      </div>

      <MascotClearOverlay show={mascotClear} />
      {show && tutorial && (
        <Tutorial
          active={tutorial}
          onDone={() => {
            setTutorial(false);
            try { localStorage.setItem('stark-tutorial-done', '1'); } catch {}
          }}
        />
      )}
      <Toast {...toast} />
      <RelicPop {...relic} />


      {/* Sigil / power unlock — pauses feel via overlay */}
      <Panel id="unlockOverlay" open={!!meta.unlock} win>
        <div className="badge-icon" style={{ background: 'linear-gradient(135deg,#2ec4b6,#4dabf7)' }}>
          {meta.unlock?.iconSrc ? (
            <img src={meta.unlock.iconSrc} alt="" width={40} height={40} />
          ) : (
            meta.unlock?.icon || '✦'
          )}
        </div>
        <h2>{meta.unlock?.kind === 'sigil' ? 'Sigil Unlocked' : 'Unlocked'}</h2>
        <div className="pm-sub">{meta.unlock?.title}</div>
        <div className="pm-reward" style={{ marginTop: 8 }}>
          {meta.unlock?.desc}
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            className="primary"
            type="button"
            style={{ width: '100%' }}
            onClick={() => dismissUnlock()}
          >
            Claim
          </button>
        </div>
      </Panel>

      <Panel id="depthClearOverlay" open={phase === 'depthclear' && endReady && !meta.unlock} win>
        <div className="win-visual">
          <Mascot mood="cheer" size={100} className="mascot-in-panel" />
          <div className="win-title">CLEAR</div>
          <div className="win-score">{score.toLocaleString()}</div>
          <div className="win-gems">
            <span className="win-gem">◆</span>
            <span>+{40 + meta.depthClearTo * 10}</span>
          </div>
        </div>
        <div className="btn-row win-actions">
          {(() => {
            const next =
              meta.activeLevelId ? nextLevelInWorld(meta.activeLevelId) : null;
            if (!next) return null;
            const blocked = trialMode && !isTrialLevel(next.id);
            return (
              <button
                className="primary"
                type="button"
                onClick={() => {
                  vibrate([30, 50, 30]);
                  if (blocked) {
                    onTrialBlocked?.();
                    return;
                  }
                  startCampaignLevel(next);
                }}
              >
                {blocked ? 'Log in for more →' : 'Next level →'}
              </button>
            );
          })()}
          <button
            className="secondary"
            type="button"
            onClick={() => {
              continueDepth();
            }}
          >
            Worlds
          </button>
        </div>
      </Panel>

      <Panel id="pauseOverlay" open={phase === 'paused'}>
        <h2>Paused</h2>
        <div
          className="btn-row"
          style={{ flexDirection: 'column', gap: 10, marginTop: 14 }}
        >
          <button className="primary" type="button" onClick={resume}>
            Resume
          </button>
          <button className="secondary" type="button" onClick={goHome}>
            Back to Home
          </button>
        </div>
      </Panel>

            <Panel id="overlay" open={(phase === 'gameover' || gameOver) && endReady && !meta.unlock}>
        <div className="win-visual">
          <Mascot mood="fail" size={96} className="mascot-in-panel" />
          <div className="win-title" style={{ color: 'var(--coral)' }}>OVERFLOW</div>
          <div className="win-score">{score.toLocaleString()}</div>
        </div>
        <div className="btn-row win-actions">
          <button
            className="primary"
            type="button"
            onClick={() => {
              vibrate(20);
              if (meta.activeLevelId) {
                const lv = levelById(meta.activeLevelId);
                if (lv) startCampaignLevel(lv);
                else startRun({ guest: true });
              } else {
                startRun({ guest: meta.isGuest, daily: meta.isDaily });
              }
            }}
          >
            Try again
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => goHome()}
          >
            Worlds
          </button>
        </div>
      </Panel>
    </div>
  );
}
