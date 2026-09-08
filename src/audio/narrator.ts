/**
 * Narrator line display — pure module.
 * Legacy speakNarrator was disabled; this restores a minimal typewriter line.
 */

export type NarratorApi = {
  speak: (text: string, holdMs?: number) => void;
  clear: () => void;
};

type Listeners = {
  onText?: (text: string, visible: boolean) => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: Listeners = {};

export function setNarratorListener(l: Listeners): void {
  listeners = l;
}

export function speakNarrator(text: string, holdMs = 2800): void {
  if (hideTimer) clearTimeout(hideTimer);
  listeners.onText?.(text, true);
  hideTimer = setTimeout(() => {
    listeners.onText?.('', false);
    hideTimer = null;
  }, holdMs);
}

export function clearNarrator(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  listeners.onText?.('', false);
}
