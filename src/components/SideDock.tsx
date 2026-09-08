/**
 * Right dock — Loaded / Next / Held / Undo / Pause
 * Held: hand icon when empty; orb fills the slot when occupied.
 */
import { glyphFor, orbBackground, ORB_BOX_SHADOW } from '../engine';
import type { SkinId } from '../engine';

type SideDockProps = {
  loaded: number;
  next: number;
  held: number | null;
  undosLeft: number;
  skin?: SkinId;
  onHold: () => void;
  onUndo: () => void;
  onPause: () => void;
};

function MiniOrb({
  value,
  active,
}: {
  value?: number;
  active?: boolean;
}) {
  if (value == null) return null;
  return (
    <div
      className={`orb${active ? ' active-orb' : ' mini'}`}
      style={{
        background: orbBackground(value),
        boxShadow: ORB_BOX_SHADOW,
        opacity: 1,
      }}
    >
      <span className="glyph">{glyphFor(value)}</span>
      <span className="num">{value}</span>
    </div>
  );
}

export function SideDock({
  loaded,
  next,
  held,
  undosLeft,
  onHold,
  onUndo,
  onPause,
}: SideDockProps) {
  return (
    <div className="launcher side-dock-right" id="rightDock">
      <div className="lane loaded-lane">
        <div className="active-wrap">
          <MiniOrb value={loaded} active />
        </div>
        <span className="tag">Loaded</span>
      </div>
      <div className="lane next-lane">
        <MiniOrb value={next} />
        <span className="tag">Next</span>
      </div>
      <span className="side-dock-divider" />
      <div className="lane held" id="heldLane">
        <button
          className={`power-btn-round held-btn${held != null ? ' has-held' : ''}`}
          id="heldBtn"
          aria-label="Hold"
          type="button"
          onClick={onHold}
        >
          {held != null ? (
            <MiniOrb value={held} />
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9 12.5V5.5a1.5 1.5 0 0 1 3 0v5M12 10.5V4a1.5 1.5 0 0 1 3 0v6.5M15 10.5V5.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6.5 7S4 17.5 4 14v-2.2c0-.9.7-1.6 1.6-1.6.5 0 1 .2 1.3.6l1.4 1.7" />
            </svg>
          )}
        </button>
        <span className="tag">Held</span>
      </div>
      <div className="lane undo" id="undoLane">
        <button
          className="power-btn-round undo-btn"
          id="undoBtn"
          aria-label="Undo"
          type="button"
          onClick={onUndo}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5A5.5 5.5 0 0 1 20 14.5v0A5.5 5.5 0 0 1 14.5 20H11" />
          </svg>
        </button>
        <span className="tag">Undo</span>
        <span className="count" id="undoCount">
          {undosLeft}
        </span>
      </div>
      <span className="side-dock-divider" />
      <div className="lane pause-lane">
        <button
          className="power-btn-round pause-btn"
          id="pauseBtn"
          aria-label="Pause"
          type="button"
          onClick={onPause}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <rect x="5" y="4" width="5" height="16" rx="1.5" />
            <rect x="14" y="4" width="5" height="16" rx="1.5" />
          </svg>
        </button>
        <span className="tag">Pause</span>
      </div>
    </div>
  );
}
