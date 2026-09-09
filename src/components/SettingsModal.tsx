/**
 * Light settings sheet — music + SFX toggles.
 */
import {
  isMusicOn,
  isSoundOn,
  setMusicOn,
  setSoundOn,
  startMusic,
  stopMusic,
} from '../audio/sound';
import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const [sfx, setSfx] = useState(() => isSoundOn());
  const [music, setMusic] = useState(() => isMusicOn());

  if (!open) return null;

  return (
    <div className="spire-entry-overlay" role="dialog" aria-modal="true">
      <div className="spire-entry-card settings-card">
        <h2 className="spire-entry-title">Settings</h2>
        <p className="spire-entry-body muted">Audio stays soft by default</p>

        <label className="settings-row">
          <span>Background music</span>
          <button
            type="button"
            className={`settings-toggle${music ? ' on' : ''}`}
            onClick={() => {
              const next = !music;
              setMusic(next);
              setMusicOn(next);
              if (next) startMusic();
              else stopMusic();
            }}
          >
            {music ? 'On' : 'Off'}
          </button>
        </label>

        <label className="settings-row">
          <span>Sound effects</span>
          <button
            type="button"
            className={`settings-toggle${sfx ? ' on' : ''}`}
            onClick={() => {
              const next = !sfx;
              setSfx(next);
              setSoundOn(next);
            }}
          >
            {sfx ? 'On' : 'Off'}
          </button>
        </label>

        <div className="spire-entry-actions">
          <button type="button" className="game-btn game-btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
