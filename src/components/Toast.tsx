/**
 * Toast + relic pop — same classes as legacy for CSS.
 */
type ToastProps = {
  visible: boolean;
  icon?: string;
  tag?: string;
  name?: string;
};

export function Toast({
  visible,
  icon = '⭐',
  tag = 'ACHIEVEMENT',
  name = '',
}: ToastProps) {
  return (
    <div className={`toast${visible ? ' show' : ''}`} id="toastPop">
      <span className="ic" id="toastIc">
        {icon}
      </span>
      <div className="txt">
        <span className="tag" id="toastTag">
          {tag}
        </span>
        <span className="name" id="toastName">
          {name}
        </span>
      </div>
    </div>
  );
}

type RelicPopProps = {
  visible: boolean;
  glyph?: string;
  name?: string;
};

export function RelicPop({
  visible,
  glyph = '✦',
  name = 'Ember Shard',
}: RelicPopProps) {
  return (
    <div className={`relic-pop${visible ? ' show' : ''}`} id="relicPop">
      <span className="glyph" id="relicPopGlyph">
        {glyph}
      </span>
      <div className="txt">
        <span className="tag">Vault +1</span>
        <span className="name" id="relicPopName">
          {name}
        </span>
      </div>
    </div>
  );
}
