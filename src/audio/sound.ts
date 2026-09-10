/**
 * Real audio files + soft fallbacks.
 * Music is a looping ambient track (not oscillator drones).
 * SFX are short samples with volume control.
 */

type BeepOpts = {
  freq?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number | null;
};

let soundOn = true;
let musicOn = true;
let musicSuspended = false; // true while in gameplay
let musicEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

const SFX: Record<string, string> = {
  click: '/audio/click.mp3',
  drop: '/audio/drop.mp3',
  merge: '/audio/merge.mp3',
  pop: '/audio/pop.mp3',
  success: '/audio/success.mp3',
  levelup: '/audio/levelup.mp3',
  fail: '/audio/fail.mp3',
  whoosh: '/audio/whoosh.mp3',
};

const MUSIC_SRC = '/audio/music-loop.mp3';
const pool: Record<string, HTMLAudioElement[]> = {};

function getPool(key: string, size = 3): HTMLAudioElement[] {
  if (!pool[key]) {
    const src = SFX[key];
    pool[key] = Array.from({ length: size }, () => {
      const a = new Audio(src);
      a.preload = 'auto';
      return a;
    });
  }
  return pool[key];
}

function playSample(key: string, volume = 0.45): void {
  if (!soundOn) return;
  try {
    const list = getPool(key);
    const a = list.find((x) => x.paused) || list[0];
    a.volume = volume;
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function ensureAudio(): AudioContext | null {
  if (!soundOn) return null;
  if (!audioCtx) {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

export function beep({
  freq = 440,
  dur = 0.12,
  type = 'sine',
  gain = 0.12,
  delay = 0,
  slideTo = null,
}: BeepOpts = {}): void {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sndDrop(): void {
  playSample('drop', 0.4);
  playSample('pop', 0.25);
}
export function sndMerge(chain: number): void {
  const c = Math.max(1, Math.min(chain, 12));
  // Sample body
  playSample('merge', Math.min(0.7, 0.26 + c * 0.05));
  // Rising pitch stack — each chain step sings higher
  const base = 280 + (c - 1) * 55;
  beep({ freq: base, dur: 0.07, type: 'triangle', gain: 0.07 + c * 0.008 });
  beep({
    freq: base * 1.25,
    dur: 0.09,
    type: 'sine',
    gain: 0.05 + c * 0.006,
    delay: 0.03,
  });
  if (c >= 2) {
    playSample('pop', Math.min(0.5, 0.18 + c * 0.04));
    beep({
      freq: base * 1.5,
      dur: 0.1,
      type: 'sine',
      gain: 0.06,
      delay: 0.05,
      slideTo: base * 1.8,
    });
  }
  if (c >= 4) {
    playSample('whoosh', 0.22);
    beep({ freq: base * 2, dur: 0.12, type: 'triangle', gain: 0.07, delay: 0.04 });
  }
  if (c >= 6) {
    playSample('success', 0.28);
    beep({ freq: 880 + c * 20, dur: 0.14, type: 'sine', gain: 0.08, delay: 0.06 });
  }
}
export function sndCombo(_n: number): void {
  playSample('success', 0.35);
}
export function sndRelic(): void {
  playSample('success', 0.5);
}
export function sndAchievement(): void {
  playSample('levelup', 0.5);
}
export function sndOverflow(): void {
  playSample('fail', 0.55);
}
export function sndLevelUp(): void {
  playSample('levelup', 0.55);
}
export function sndShard(): void {
  playSample('pop', 0.3);
}
export function sndBuy(): void {
  playSample('success', 0.4);
}
export function sndClick(): void {
  playSample('click', 0.5);
}
export function sndUI(): void {
  playSample('click', 0.4);
}

/** Soft player-card unveil — quiet trail, not a fanfare */
export function sndCardReveal(): void {
  playSample('whoosh', 0.16);
  setTimeout(() => playSample('pop', 0.18), 180);
  setTimeout(() => playSample('success', 0.2), 420);
  setTimeout(() => playSample('levelup', 0.16), 720);
}
export function sndCardTick(): void {
  playSample('click', 0.22);
}


const MUSIC_VOLUME = 0.12; // quiet background bed

export function startMusic(): void {
  if (!soundOn || !musicOn || musicSuspended) return;
  try {
    if (!musicEl) {
      musicEl = new Audio(MUSIC_SRC);
      musicEl.loop = true;
      musicEl.preload = 'auto';
      musicEl.volume = MUSIC_VOLUME;
    } else {
      musicEl.volume = MUSIC_VOLUME;
    }
    void musicEl.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function stopMusic(): void {
  if (musicEl) {
    try {
      musicEl.pause();
      musicEl.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}

/** Pause loop without resetting position (resume in hub). */
export function pauseMusic(): void {
  musicSuspended = true;
  if (musicEl) {
    try {
      musicEl.pause();
    } catch {
      /* ignore */
    }
  }
}

export function resumeMusic(): void {
  musicSuspended = false;
  if (!soundOn || !musicOn) return;
  startMusic();
}

export function setMusicIntensity(_tier: number): void {
  // Keep bed quiet — no intensity ramp drowning SFX
  if (!musicEl) return;
  musicEl.volume = MUSIC_VOLUME;
}

export function setMusicVolume(v: number): void {
  if (musicEl) musicEl.volume = Math.max(0, Math.min(0.35, v));
}

export function setSoundOn(on: boolean): void {
  soundOn = on;
  if (!on) stopMusic();
  else if (musicOn) startMusic();
  persistAudioPrefs();
}
export function setMusicOn(on: boolean): void {
  musicOn = on;
  if (on && soundOn && !musicSuspended) startMusic();
  else if (!on) stopMusic();
  persistAudioPrefs();
}
export function isSoundOn(): boolean {
  return soundOn;
}
export function isMusicOn(): boolean {
  return musicOn;
}


export function playBoardEvent(ev: { type: string; chain?: number }): void {
  switch (ev.type) {
    case 'drop':
      playSample('drop', 0.42);
      playSample('whoosh', 0.15);
      break;
    case 'merge':
      sndMerge(ev.chain ?? 1);
      break;
    case 'overflow':
    case 'gameover':
      playSample('fail', 0.55);
      break;
    case 'hold':
    case 'undo':
      playSample('click', 0.36);
      break;
    case 'ascend':
      playSample('levelup', 0.5);
      playSample('success', 0.35);
      break;
    default:
      break;
  }
}

export function sndWin(): void {
  playSample('success', 0.55);
  setTimeout(() => playSample('levelup', 0.48), 140);
  setTimeout(() => playSample('pop', 0.3), 280);
}

export function sndLose(): void {
  playSample('fail', 0.55);
  setTimeout(() => playSample('whoosh', 0.2), 100);
}

function loadAudioPrefs(): void {
  try {
    const s = localStorage.getItem('stark-audio');
    if (!s) return;
    const j = JSON.parse(s) as { soundOn?: boolean; musicOn?: boolean };
    if (typeof j.soundOn === 'boolean') soundOn = j.soundOn;
    if (typeof j.musicOn === 'boolean') musicOn = j.musicOn;
  } catch {
    /* ignore */
  }
}

export function persistAudioPrefs(): void {
  try {
    localStorage.setItem(
      'stark-audio',
      JSON.stringify({ soundOn, musicOn }),
    );
  } catch {
    /* ignore */
  }
}

loadAudioPrefs();

export function unlockAudio(): void {
  ensureAudio();
  // Do not restart BGM if gameplay suspended it
  if (musicOn && soundOn && !musicSuspended) startMusic();
}
