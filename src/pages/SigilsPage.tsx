/** Sigils collection — guest capped, Spire full set. */
import { SIGILS, GUEST_SIGIL_LIMIT, SPIRE_SIGIL_LIMIT } from '../engine';

type Props = {
  show: boolean;
  owned: Set<string>;
  isGuest?: boolean;
  onBack: () => void;
};

export function SigilsPage({ show, owned, isGuest = true, onBack }: Props) {
  if (!show) return null;
  const limit = isGuest ? GUEST_SIGIL_LIMIT : SPIRE_SIGIL_LIMIT;

  return (
    <div className={`page hub-page show`} id="sigilsPage">
      <div className="hub-header game-hub-header">
        <button className="game-btn-text" type="button" onClick={onBack}>
          ← Back
        </button>
        <div className="season-tag">
          {owned.size}/{limit}
        </div>
      </div>
      <div className="hub-content guest-select">
        <h1 className="select-title">Sigils</h1>
        <p className="select-sub">
          {isGuest ? 'Guest can hold up to 2' : 'Full Spire set'}
        </p>
        <div className="sigil-grid">
          {SIGILS.map((s) => {
            const has = owned.has(s.id);
            return (
              <div key={s.id} className={`sigil-card${has ? ' owned' : ''}`}>
                {s.iconSrc ? (
                  <img src={s.iconSrc} alt="" width={48} height={48} />
                ) : (
                  <span className="sigil-emoji">{s.icon}</span>
                )}
                <div className="sigil-name">{s.name}</div>
                <div className="sigil-desc">{has ? s.desc : 'Locked'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
