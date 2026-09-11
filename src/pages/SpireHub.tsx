/**
 * Spire wing hub — vertical shaft floors (offline).
 */
import {
  SPIRE_FLOORS,
  isSpireFloorUnlocked,
  type SpireFloor,
} from '../engine';

type Props = {
  show: boolean;
  cleared: string[];
  onBack: () => void;
  onPlayFloor: (floor: SpireFloor) => void;
};

export function SpireHub({ show, cleared, onBack, onPlayFloor }: Props) {
  if (!show) return null;

  return (
    <div className="page spire-hub-page show">
      <div className="spire-hub-bg" aria-hidden />
      <header className="spire-hub-header">
        <button type="button" className="spire-hub-back" onClick={onBack}>
          ← Compound
        </button>
        <div>
          <div className="spire-hub-title">Spire</div>
          <div className="spire-hub-sub">Underground shaft</div>
        </div>
      </header>

      <div className="spire-floor-list">
        {SPIRE_FLOORS.map((floor) => {
          const open = isSpireFloorUnlocked(floor.id, cleared);
          const done = cleared.includes(floor.id);
          return (
            <button
              key={floor.id}
              type="button"
              className={`spire-floor-card${open ? '' : ' locked'}${done ? ' done' : ''}`}
              disabled={!open}
              onClick={() => open && onPlayFloor(floor)}
            >
              <span className="spire-floor-depth">B{floor.depth}</span>
              <span className="spire-floor-main">
                <span className="spire-floor-name">{floor.name}</span>
                <span className="spire-floor-tag">{floor.tagline}</span>
                <span className="spire-floor-obj">{floor.objective.label}</span>
              </span>
              <span className="spire-floor-status">
                {!open ? 'Locked' : done ? 'Cleared' : 'Enter'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
