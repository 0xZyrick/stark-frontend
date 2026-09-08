/**
 * Privy login → name → fund prompt → Home
 * Spire = custodial backend wallet (user funds address; backend signs).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { Splash } from './pages/Splash';
import { LoginPage } from './pages/LoginPage';
import { NamePage } from './pages/NamePage';
import { HomePage } from './pages/HomePage';
import { WorldSelectPage } from './pages/WorldSelectPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SigilsPage } from './pages/SigilsPage';
import { GamePage } from './pages/GamePage';
import { SpireEntryModal } from './components/SpireEntryModal';
import { FundPromptModal } from './components/FundPromptModal';
import { Mascot } from './components/Mascot';
import { sndUI, unlockAudio } from './audio/sound';
import {
  speakNarrator,
  setNarratorListener,
  clearNarrator,
} from './audio/narrator';
import type { CampaignLevel } from './engine';
import { SPIRE_SIGIL_LIMIT } from './engine';
import { fetchLeaderboard } from './privy/api';
import { isPrivyConfigured } from './privy';
import { usePrivy } from '@privy-io/react-auth';
import { useSpireWallet } from './starknet/useSpireWallet';

/** App body that uses custodial wallet — only mounted when Privy is configured */
function AppWithWallet() {
  const wallet = useSpireWallet();
  const { logout, user, ready, authenticated } = usePrivy();
  const userId = user?.id ?? null;
  return (
    <AppShell
      wallet={{
        ...wallet,
        authenticated: authenticated || wallet.authenticated,
        ready: ready && wallet.ready,
        userId,
        logout: async () => {
          await logout();
        },
      }}
    />
  );
}

function AppWithoutWallet() {
  const wallet = {
    ready: true,
    authenticated: false,
    connected: false,
    address: null as string | null,
    short: null as string | null,
    balanceHint: null as string | null,
    busy: false,
    error: null as string | null,
    ensure: async () => {
      throw new Error('Login required');
    },
    connect: async () => {
      throw new Error('Login required');
    },
    startRunOnChain: async () => {
      throw new Error('Login required');
    },
    settleRunOnChain: async (_b: unknown) => {
      throw new Error('Login required');
    },
    clearError: () => {},
  };
  return <AppShell wallet={wallet} />;
}

type WalletApi = {
  ready: boolean;
  authenticated: boolean;
  connected: boolean;
  address: string | null;
  short: string | null;
  balanceHint: string | null;
  busy: boolean;
  error: string | null;
  ensure: () => Promise<unknown>;
  connect: () => Promise<unknown>;
  startRunOnChain: () => Promise<{ runId: number; seed: string; txHash?: string }>;
  settleRunOnChain: (body: {
    runId: number;
    score: number;
    depth: number;
    bestTile: number;
    movesHash: string;
    checksum: string;
    name?: string;
    worldId?: string;
  }) => Promise<unknown>;
  clearError: () => void;
  refreshBalance?: () => Promise<void>;
  logout?: () => Promise<void>;
  userId?: string | null;
};

function AppShell({ wallet }: { wallet: WalletApi }) {
  const engine = useGameEngine();
  const {
    phase,
    setPhase,
    startCampaignLevel,
    startRun,
    meta,
    rank,
    setPlayerName,
    score,
    tier,
  } = engine;

  const [splashGone, setSplashGone] = useState(false);
  const [showName, setShowName] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [narratorText, setNarratorText] = useState('');
  const [narratorOn, setNarratorOn] = useState(false);
  const [showAchv, setShowAchv] = useState(false);
  const [showSigils, setShowSigils] = useState(false);
  const [showWorldSelect, setShowWorldSelect] = useState(false);
  const [showSpireModal, setShowSpireModal] = useState(false);
  const [showFundPrompt, setShowFundPrompt] = useState(false);
  const [spireBusy, setSpireBusy] = useState(false);
  const [spireError, setSpireError] = useState<string | null>(null);
  const [remoteLb, setRemoteLb] = useState<
    Array<{
      name: string;
      worldId: string;
      rating: number;
      score: number;
      rank?: number;
      isYou?: boolean;
    }>
  >([]);

  const activeRunRef = useRef<{ runId: number; seed: string } | null>(null);
  const settlingRef = useRef(false);

  const nameKey = (uid?: string | null) =>
    uid ? `stark-player-name:${uid}` : 'stark-player-name';

  // Wait for Privy ready, then restore session + per-account name
  useEffect(() => {
    const boot = window.setTimeout(() => setSplashGone(true), 900);
    return () => window.clearTimeout(boot);
  }, []);

  useEffect(() => {
    if (!splashGone) return;
    // Wait until auth layer is ready (when Privy is on)
    if (isPrivyConfigured() && wallet.ready === false) return;

    try {
      const uid = wallet.userId;
      const saved =
        (uid && localStorage.getItem(nameKey(uid))) ||
        localStorage.getItem('stark-player-name'); // legacy fallback

      if (wallet.authenticated) {
        if (saved) {
          setPlayerName(saved);
          setShowName(false);
          setPhase('home');
          void wallet.ensure().catch(() => {});
          return;
        }
        // Logged in but no name yet for this account
        setShowName(true);
        setPhase('login');
        return;
      }

      setPhase('login');
      setShowName(false);
    } catch {
      setPhase('login');
    }
  }, [
    splashGone,
    wallet.ready,
    wallet.authenticated,
    wallet.userId,
    setPhase,
    setPlayerName,
  ]);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((data) => {
        if (cancelled) return;
        setRemoteLb(
          data.rows.map((r) => ({
            name: r.name,
            worldId: r.worldId,
            rating: r.rating,
            score: r.bestScore,
            rank: r.rank,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    setNarratorListener({
      onText: (text, visible) => {
        setNarratorText(text);
        setNarratorOn(visible);
      },
    });
    return () => clearNarrator();
  }, []);

  useEffect(() => {
    const inGame =
      phase === 'playing' ||
      phase === 'paused' ||
      phase === 'gameover' ||
      phase === 'depthclear';
    document.body.classList.toggle('in-game', inGame);
    document.body.classList.toggle('guest-account', meta.isGuest);
  }, [phase, meta.isGuest]);

  useEffect(() => {
    if (phase !== 'gameover' && phase !== 'depthclear') return;
    if (meta.isGuest) return;
    if (!activeRunRef.current) return;
    if (settlingRef.current) return;

    settlingRef.current = true;
    const run = activeRunRef.current;
    const worldId =
      tier >= 12 ? 'endless' : tier >= 8 ? 'core' : tier >= 4 ? 'mid' : 'outer';

    void (async () => {
      try {
        await wallet.settleRunOnChain({
          runId: run.runId,
          score,
          depth: tier,
          bestTile: engine.board.bestTile || 2,
          movesHash: '0',
          checksum: '0',
          name: meta.playerName,
          worldId,
        });
        speakNarrator('Run settled on-chain.', 1800);
        try {
          const data = await fetchLeaderboard();
          setRemoteLb(
            data.rows.map((r) => ({
              name: r.name,
              worldId: r.worldId,
              rating: r.rating,
              score: r.bestScore,
              rank: r.rank,
            })),
          );
        } catch {
          /* optional */
        }
      } catch (e) {
        console.warn('[spire] settle failed', e);
        speakNarrator('Settle failed — fund wallet or try again.', 2200);
      } finally {
        activeRunRef.current = null;
        settlingRef.current = false;
      }
    })();
  }, [phase, meta.isGuest, meta.playerName, score, tier, engine.board.bestTile, wallet]);

  // Auto-continue after Privy OAuth returns authenticated
  useEffect(() => {
    if (phase !== 'login' || showName) return;
    if (!wallet.authenticated) return;
    // soft nudge — user still presses Continue on login if AuthButtons shows it
  }, [wallet.authenticated, phase, showName]);

  const afterAuth = (hint?: string) => {
    unlockAudio();
    sndUI();
    const uid = wallet.userId;
    let saved: string | null = null;
    try {
      saved =
        (uid && localStorage.getItem(nameKey(uid))) ||
        localStorage.getItem('stark-player-name');
    } catch {}
    if (saved) {
      setPlayerName(saved);
      setShowName(false);
      setPhase('home');
      void wallet.ensure().catch(() => {});
      return;
    }
    if (hint) setPlayerName(hint.slice(0, 12));
    setShowName(true);
    void wallet.ensure().catch(() => {});
  };

  const onNameSubmit = (name: string) => {
    const clean = name.slice(0, 12);
    setPlayerName(clean);
    try {
      const uid = wallet.userId;
      if (uid) localStorage.setItem(nameKey(uid), clean);
      localStorage.setItem('stark-player-name', clean);
    } catch {}
    setShowName(false);
    setPhase('home');
    setWelcomeName(name);
    speakNarrator(`Welcome, ${name}. The Spire awaits.`, 2400);
    window.setTimeout(() => setWelcomeName(null), 2800);
    window.setTimeout(() => setShowFundPrompt(true), 900);
    void wallet.ensure().catch(() => {});
  };

  const onGuest = () => {
    unlockAudio();
    sndUI();
    setShowWorldSelect(true);
    setShowAchv(false);
  };

  const onPlayLevel = (level: CampaignLevel) => {
    unlockAudio();
    sndUI();
    setShowWorldSelect(false);
    startCampaignLevel(level);
  };

  const enterSpireDirect = async () => {
    unlockAudio();
    sndUI();
    setSpireError(null);
    setSpireBusy(true);
    try {
      if (!wallet.authenticated) {
        setSpireError('Log in first');
        return;
      }
      if (!wallet.address) await wallet.ensure();
      const res = await wallet.startRunOnChain();
      activeRunRef.current = { runId: res.runId, seed: res.seed };
      startRun({ guest: false, daily: false, startTier: 0 });
      speakNarrator('The Spire awaits.', 1600);
    } catch (e) {
      const msg = (e as Error).message || 'Could not start run';
      if (/fund|balance|insufficient|top up|not ready on-chain/i.test(msg)) {
        setSpireError('Insufficient balance — please top up');
        setShowFundPrompt(true);
        speakNarrator('Copy your address to fund it.', 2400);
      } else if (/login|auth/i.test(msg)) {
        setSpireError('Not logged in');
      } else {
        setSpireError(msg);
      }
    } finally {
      setSpireBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      // Privy logout is only available when configured — parent may pass via wallet
      await (wallet as { logout?: () => Promise<void> }).logout?.();
    } catch {}
    // Keep name tied to user id so same email restores it next login
    setShowName(false);
    setShowFundPrompt(false);
    setShowSpireModal(false);
    setPhase('login');
    speakNarrator('Logged out.', 1400);
  };

  const showLogin = phase === 'login' && !showName;
  const showHome =
    phase === 'home' && !showAchv && !showWorldSelect && !showSigils;
  const showAchievements = phase === 'home' && showAchv;
  const showWorlds = phase === 'home' && showWorldSelect;
  const showGame =
    phase === 'playing' ||
    phase === 'paused' ||
    phase === 'gameover' ||
    phase === 'depthclear';

  return (
    <>
      <Splash hidden={splashGone} />
      <LoginPage show={showLogin} onContinue={afterAuth} />
      <NamePage
        show={showName}
        initial={meta.playerName}
        onSubmit={onNameSubmit}
      />
      <HomePage
        show={showHome}
        playerName={meta.playerName}
        rank={rank}
        mainHighScore={meta.mainHighScore}
        guestHighScore={Object.values(meta.guestLevelBest).reduce(
          (a, b) => Math.max(a, b),
          0,
        )}
        shards={meta.shards}
        achievementCount={meta.achievements.size}
        sigilCount={meta.ownedSigils.size}
        sigilLimit={SPIRE_SIGIL_LIMIT}
        walletShort={wallet.short}
        walletBalance={wallet.balanceHint}
        onCopyWallet={() => {
          if (wallet.address) void navigator.clipboard?.writeText(wallet.address);
        }}
        walletAddress={wallet.address}
        onLogout={() => void doLogout()}
        leaderboard={remoteLb}
        onEnterSpire={() => void enterSpireDirect()}
        spireBusy={spireBusy}
        spireError={spireError}
        onGuest={onGuest}
        onAchievements={() => {
          sndUI();
          setShowSigils(false);
          setShowAchv(true);
        }}
        onSigils={() => {
          sndUI();
          setShowAchv(false);
          setShowSigils(true);
        }}
      />
      <WorldSelectPage
        show={showWorlds}
        onBack={() => setShowWorldSelect(false)}
        onPlayLevel={onPlayLevel}
        guestLevelBest={meta.guestLevelBest}
      />
      <AchievementsPage
        show={showAchievements}
        owned={meta.achievements}
        redeemed={meta.redeemedAchievements}
        onBack={() => setShowAchv(false)}
        onRedeem={(id) => engine.redeemAchievement(id)}
      />
      <SigilsPage
        show={phase === 'home' && showSigils}
        owned={meta.ownedSigils}
        isGuest={meta.isGuest}
        onBack={() => setShowSigils(false)}
      />
      <GamePage engine={engine} show={showGame} />

      <FundPromptModal
        open={showFundPrompt}
        address={wallet.address}
        balanceHint={wallet.balanceHint}
        busy={wallet.busy}
        onPrepareWallet={() => {
          void wallet.ensure().catch(() => {});
        }}
        onRefreshBalance={() => {
          void wallet.refreshBalance?.().catch(() => {});
        }}
        onSkip={() => setShowFundPrompt(false)}
      />

      <SpireEntryModal
        open={showSpireModal}
        busy={spireBusy || wallet.busy}
        error={spireError || wallet.error}
        address={wallet.address}
        balanceHint={wallet.balanceHint}
        onEnsureWallet={() => {
          void wallet.ensure().catch((e) => {
            setSpireError((e as Error).message);
          });
        }}
        onRefreshBalance={() => {
          void wallet.refreshBalance?.().catch(() => {});
        }}
        onConfirm={() => void confirmSpireEntry()}
        onCancel={() => {
          if (!spireBusy) setShowSpireModal(false);
        }}
      />

      {welcomeName && (
        <div className="welcome-mascot-overlay" aria-live="polite">
          <Mascot mood="cheer" size={120} speech={`Welcome, ${welcomeName}!`} />
        </div>
      )}

      {showHome && (
        <nav className="bottom-nav game-bottom-nav" id="bottomNav">
          <div className="bottom-nav-inner">
            <button className="nav-btn active" type="button">
              <span className="nav-ic">🎮</span>Home
            </button>
            <button className="nav-btn" type="button" onClick={onGuest}>
              <span className="nav-ic">🧭</span>Practice
            </button>
            <button
              className="nav-btn"
              type="button"
              onClick={() => {
                sndUI();
                setShowAchv(true);
              }}
            >
              <span className="nav-ic">🏅</span>Achv
            </button>
          </div>
        </nav>
      )}

      <div className="narrator" style={{ opacity: narratorOn ? 1 : 0 }}>
        <span>{narratorText}</span>
      </div>
    </>
  );
}

export default function App() {
  if (isPrivyConfigured()) return <AppWithWallet />;
  return <AppWithoutWallet />;
}
