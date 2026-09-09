/**
 * Settings — name, music, SFX.
 */
import {
  isMusicOn,
  isSoundOn,
  setMusicOn,
  setSoundOn,
  startMusic,
  stopMusic,
} from '../audio/sound';
import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  playerName?: string;
  onSaveName?: (name: string) => void;
};

export function SettingsModal({ open, onClose, playerName = '', onSaveName }: Props) {
  const [sfx, setSfx] = useState(() => isSoundOn());
  const [music, setMusic] = useState(() => isMusicOn());
  const [name, setName] = useState(playerName);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (open) setName(playerName);
  }, [open, playerName]);

  if (!open) return null;

  const saveName = () => {
    const clean = name.trim().slice(0, 12);
    if (!clean || !onSaveName) return;
    onSaveName(clean);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="spire-entry-overlay" role="dialog" aria-modal="true">
      <div className="spire-entry-card settings-card">
        <h2 className="spire-entry-title">Settings</h2>
        <p className="spire-entry-body muted">Profile & audio</p>

        <label className="settings-name-block">
          <span className="settings-label">Display name</span>
          <div className="settings-name-row">
            <input
              className="settings-name-input"
              value={name}
              maxLength={12}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="button" className="settings-save-name" onClick={saveName}>
              {savedFlash ? 'Saved' : 'Save'}
            </button>
          </div>
        </label>

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
