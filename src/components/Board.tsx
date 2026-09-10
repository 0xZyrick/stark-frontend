/**
 * Board — legacy-faithful orb fall (createTileEl + positionEl port).
 *
 * Legacy:
 *   positionEl at ROWS+1 → append → double rAF → positionEl at row → .land
 * CSS:
 *   .tile { transition: bottom 0.22s cubic-bezier(...) }
 *   .tile.land { animation: landBounce }
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { Tile, SkinId } from '../engine';
import { glyphFor, orbBackground, ORB_BOX_SHADOW, isCrownValue, crownArtSrc } from '../engine';

type BoardProps = {
  cols: number;
  rows: number;
  tiles: Tile[];
  skin?: SkinId;
  sceneClass?: string;
  onColumnTap?: (col: number) => void;
  flashChain?: number;
};

function bottomFor(row: number): string {
  return `calc(${row} * (var(--cell) + var(--gap)))`;
}

type TileOrbProps = {
  tile: Tile;
  rows: number;
  skin: SkinId;
  animateIn: boolean;
};

function TileOrb({ tile, rows, skin, animateIn }: TileOrbProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const fell = useRef(false);
  const prevRow = useRef(tile.row);
  const prevValue = useRef(tile.value);

  // Mount placement — above column if this is a drop-in
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.style.left = '0';
    el.style.right = '0';
    el.style.width = '100%';
    if (animateIn && !fell.current) {
      el.style.bottom = bottomFor(rows + 1);
    } else {
      el.style.bottom = bottomFor(tile.row);
    }
  }, []);

  // Legacy fall: double rAF → target row + land bounce
  useEffect(() => {
    const el = elRef.current;
    if (!el || !animateIn || fell.current) return;
    fell.current = true;
    let landTimer: number | undefined;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.bottom = bottomFor(tile.row);
        el.classList.add('land');
        landTimer = window.setTimeout(() => el.classList.remove('land'), 300);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (landTimer) clearTimeout(landTimer);
    };
    // only run fall once on mount for new tiles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gravity: same element, row changes — CSS transitions bottom
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (prevRow.current === tile.row) return;
    prevRow.current = tile.row;
    if (fell.current || !animateIn) {
      el.style.bottom = bottomFor(tile.row);
    }
  }, [tile.row, animateIn]);

  // Merge pop on value change
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (prevValue.current === tile.value) return;
    prevValue.current = tile.value;
    el.classList.remove('pop', 'pop-big', 'pop-insane');
    void el.offsetWidth;
    const cls =
      tile.value >= 256 ? 'pop-insane' : tile.value >= 64 ? 'pop-big' : 'pop';
    el.classList.add(cls);
    const t = window.setTimeout(() => el.classList.remove(cls), 320);
    return () => clearTimeout(t);
  }, [tile.value]);

  const crown = isCrownValue(tile.value);
  return (
    <div
      ref={elRef}
      className={`tile${crown ? ' orb-crown' : ''}`}
      data-id={tile.id}
      data-value={tile.value}
      style={{
        background: crown
          ? 'transparent'
          : orbBackground(tile.value, skin),
        boxShadow: crown ? 'none' : ORB_BOX_SHADOW,
        opacity: 1,
      }}
    >
      {crown ? (
        <img
          className="crown-art"
          src={crownArtSrc(tile.value)}
          alt=""
          draggable={false}
        />
      ) : (
        <span className="glyph">{glyphFor(tile.value)}</span>
      )}
      <span className="num">{tile.value}</span>
    </div>
  );
}

export function Board({
  cols,
  rows,
  tiles,
  skin = 'classic',
  sceneClass = 'scene-outer',
  onColumnTap,
  flashChain = 0,
}: BoardProps) {
  // IDs seen on previous commit — used during render to mark animateIn
  const knownIds = useRef<Set<number>>(new Set());
  const [flashClass, setFlashClass] = useState('');

  // Which tiles are new THIS render (before we mark them known)
  const animateInIds = useMemo(() => {
    const s = new Set<number>();
    for (const t of tiles) {
      if (!knownIds.current.has(t.id)) s.add(t.id);
    }
    return s;
  }, [tiles]);

  // After paint, remember current ids (and drop gone ones)
  useLayoutEffect(() => {
    knownIds.current = new Set(tiles.map((t) => t.id));
  }, [tiles]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--cols', String(cols));
    root.style.setProperty('--rows', String(rows));
  }, [cols, rows]);

  useEffect(() => {
    if (flashChain < 2) return;
    let cls = 'flash';
    if (flashChain >= 6) cls = 'flash flash-legendary';
    else if (flashChain >= 5) cls = 'flash flash-insane';
    else if (flashChain >= 3) cls = 'flash flash-hot';
    setFlashClass(cls);
    const t = window.setTimeout(() => setFlashClass(''), 450);
    return () => clearTimeout(t);
  }, [flashChain]);

  const byCol: Tile[][] = Array.from({ length: cols }, () => []);
  for (const t of tiles) {
    if (t.col >= 0 && t.col < cols) byCol[t.col].push(t);
  }
  for (const col of byCol) col.sort((a, b) => a.row - b.row);

  const wrapStyle = {
    ['--cols']: cols,
    ['--rows']: rows,
  } as CSSProperties;

  return (
    <div className={`board-wrap ${sceneClass}`} id="boardWrap" style={wrapStyle}>
      <div
        className={`flash-overlay${flashClass ? ` ${flashClass}` : ''}`}
        id="flashOverlay"
      />
      <div className="columns" id="columns">
        {byCol.map((colTiles, colIdx) => {
          const height = colTiles.length;
          const danger = height >= rows - 1 && height < rows;
          return (
            <div
              key={colIdx}
              className={`col${danger ? ' danger' : ''}`}
              data-col={colIdx}
              onClick={() => onColumnTap?.(colIdx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onColumnTap?.(colIdx);
              }}
            >
              {colTiles.map((t) => (
                <TileOrb
                  key={t.id}
                  tile={t}
                  rows={rows}
                  skin={skin}
                  animateIn={animateInIds.has(t.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
