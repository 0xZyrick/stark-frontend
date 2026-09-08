/** Achievements — unlocked on top with Redeem; locked below. */
import { ACHIEVEMENTS } from '../engine';

type Props = {
  show: boolean;
  owned: Set<string>;
  redeemed?: Set<string>;
  onBack: () => void;
  onRedeem?: (id: string) => void;
};

export function AchievementsPage({
  show,
  owned,
  redeemed = new Set(),
  onBack,
  onRedeem,
}: Props) {
  if (!show) return null;
  const unlocked = ACHIEVEMENTS.filter((a) => owned.has(a.id));
  const locked = ACHIEVEMENTS.filter((a) => !owned.has(a.id));

  return (
    <div className={`page hub-page show`} id="achvPage">
      <div className="hub-header game-hub-header">
        <button className="game-btn-text" type="button" onClick={onBack}>
          ← Back
        </button>
        <div className="season-tag">
          {unlocked.length}/{ACHIEVEMENTS.length}
        </div>
      </div>
      <div className="hub-content guest-select">
        <h1 className="select-title">Achievements</h1>
        {unlocked.length > 0 && (
          <>
            <p className="select-sub">Unlocked</p>
            <div className="achv-stack">
              {unlocked.map((a) => {
                const isRedeemed = redeemed.has(a.id);
                return (
                  <div key={a.id} className="achv-row unlocked">
                    <span className="achv-ic">{a.icon}</span>
                    <div className="achv-body">
                      <div className="achv-label">{a.label}</div>
                      <div className="achv-cat">{a.cat}</div>
                    </div>
                    {isRedeemed ? (
                      <span className="achv-done">Claimed</span>
                    ) : (
                      <button
                        type="button"
                        className="achv-redeem"
                        onClick={() => onRedeem?.(a.id)}
                      >
                        Redeem +{a.reward}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="select-sub" style={{ marginTop: 16 }}>
          Locked
        </p>
        <div className="achv-stack">
          {locked.map((a) => (
            <div key={a.id} className="achv-row locked">
              <span className="achv-ic">{a.icon}</span>
              <div className="achv-body">
                <div className="achv-label">{a.label}</div>
                <div className="achv-cat">{a.cat}</div>
              </div>
              <span className="achv-reward">+{a.reward}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
