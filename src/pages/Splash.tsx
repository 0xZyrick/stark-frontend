/** Splash — first frame */
type SplashProps = { hidden?: boolean };

export function Splash({ hidden }: SplashProps) {
  return (
    <div className={`splash game-splash${hidden ? ' hide' : ''}`} id="splash">
      <div className="splash-bg" aria-hidden="true" />
      <div className="splash-ring" aria-hidden="true" />
      <div className="splash-logo-wrap">
        <img className="splash-logo-img" src="/images/logo.png" alt="STARK" />
      </div>
      <div className="splash-tag">DESCEND THE SPIRE</div>
      <div className="splash-bar">
        <div
          className="splash-bar-fill"
          style={{ width: hidden ? '100%' : '72%' }}
        />
      </div>
    </div>
  );
}
