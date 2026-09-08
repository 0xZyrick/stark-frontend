/** Name setup — mascot coaches “what should we call you?” */
import { useState } from 'react';
import { Mascot } from '../components/Mascot';

type Props = {
  show: boolean;
  initial?: string;
  onSubmit: (name: string) => void;
};

export function NamePage({ show, initial = '', onSubmit }: Props) {
  const [name, setName] = useState(initial);

  if (!show) return null;

  return (
    <div className={`page login-page game-login show`} id="namePage">
      <div className="splash-bg login-splash-bg" aria-hidden="true" />
      <div className="login-card name-card mascot-edge-card">
        <div className="mascot-edge-dock">
          <Mascot
            mood="nudge"
            size={88}
            speech={
              name.trim()
                ? `${name.trim().slice(0, 12)} — nice!`
                : 'What should we call you?'
            }
          />
        </div>
        <img className="login-logo-img" src="/images/logo.png" alt="STARK" />
        <div className="login-tag">WHAT SHOULD WE CALL YOU?</div>
        <input
          className="name-input"
          type="text"
          maxLength={12}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button
          className="game-btn game-btn-secondary"
          type="button"
          onClick={() => onSubmit((name.trim() || 'Player').slice(0, 12))}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
