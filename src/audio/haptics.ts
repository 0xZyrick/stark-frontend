/**
 * Haptics — isolated navigator.vibrate wrapper (legacy game.js).
 */

let hapticOn = true;

export function setHapticOn(on: boolean): void {
  hapticOn = on;
}

export function isHapticOn(): boolean {
  return hapticOn;
}

export function vibrate(ms: number | number[]): void {
  if (!hapticOn) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

/** Map board events → haptic pulses */
export function hapticForEvent(ev: { type: string; chain?: number }): void {
  switch (ev.type) {
    case 'merge':
      if ((ev.chain ?? 0) >= 3) vibrate([20, 30, 20]);
      else if ((ev.chain ?? 0) >= 2) vibrate(20);
      break;
    case 'overflow':
    case 'gameover':
      vibrate([40, 40, 40]);
      break;
    case 'drop':
      vibrate(10);
      break;
    default:
      break;
  }
}
