// Shared building blocks for the v2 design system (see src/styles/v2.css).
// Presentation only — pages keep their own data hooks and API calls.
import React from 'react';
import {
  Activity, Leaf, Smile, Moon, Droplet, Timer, ChevronLeft, ChevronRight,
} from 'lucide-react';

export type Pillar = 'act' | 'food' | 'mind' | 'sleep' | 'water' | 'danger' | 'brand';

export const PILLAR_ICON = {
  act: Activity,
  food: Leaf,
  mind: Smile,
  sleep: Moon,
  water: Droplet,
  fast: Timer,
} as const;

const pillarClass = (p?: Pillar) => (p && p !== 'brand' ? `v2-p-${p}` : '');

export const ICON_PROPS = { strokeWidth: 1.8, 'aria-hidden': true } as const;

export const IconChip: React.FC<{
  pillar?: Pillar; size?: 'sm' | 'md' | 'lg'; children: React.ReactNode;
}> = ({ pillar, size = 'md', children }) => (
  <span className={`v2-chipicon ${size === 'lg' ? 'v2-chipicon--lg' : size === 'sm' ? 'v2-chipicon--sm' : ''} ${pillarClass(pillar)}`}>
    {children}
  </span>
);

export const IconBtn: React.FC<{
  label: string; onClick?: () => void; round?: boolean; primary?: boolean; children: React.ReactNode;
}> = ({ label, onClick, round, primary, children }) => (
  <button
    type="button"
    className={`v2-iconbtn ${round ? 'v2-iconbtn--round' : ''} ${primary ? 'v2-iconbtn--primary' : ''}`}
    onClick={onClick}
    aria-label={label}
  >
    {children}
  </button>
);

/** Back button · centred title · optional right action (matches every sub-screen in ui_ref2). */
export const PageHeader: React.FC<{
  title: string; onBack?: () => void; backLabel?: string; right?: React.ReactNode;
}> = ({ title, onBack, backLabel = 'Back', right }) => (
  <header className="v2-header v2-header--center">
    {onBack
      ? <IconBtn label={backLabel} onClick={onBack}><ChevronLeft size={22} {...ICON_PROPS} /></IconBtn>
      : <span className="v2-header-spacer" />}
    <h1 className="v2-header-title">{title}</h1>
    {right ?? <span className="v2-header-spacer" />}
  </header>
);

export const Chip: React.FC<{
  on?: boolean; onClick?: () => void; children: React.ReactNode; type?: 'button' | 'submit'; disabled?: boolean; ariaLabel?: string; className?: string;
}> = ({ on, onClick, children, type = 'button', disabled, ariaLabel, className }) => (
  <button type={type} className={`v2-chip ${on ? 'is-on' : ''} ${className ?? ''}`} onClick={onClick} aria-pressed={on} disabled={disabled} aria-label={ariaLabel}>
    {children}
  </button>
);

export const Segmented: React.FC<{
  value: string; onChange: (v: string) => void;
  options: { value: string; label: React.ReactNode }[]; className?: string;
}> = ({ value, onChange, options, className }) => (
  <div className={`v2-seg ${className ?? ''}`} role="tablist">
    {options.map((o) => (
      <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
        className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

export const ProgressBar: React.FC<{ value: number; pillar?: Pillar; label?: string }> = ({ value, pillar, label }) => (
  <div className={`v2-bar ${pillar && pillar !== 'brand' && pillar !== 'danger' ? `v2-bar--${pillar}` : ''}`}
    role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
    <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

/** Hairline-divided group. `rows` children should be `.v2-row` elements (see Row). */
export const Group: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`v2-group ${className ?? ''}`}>{children}</div>
);

export const Row: React.FC<{
  icon?: React.ReactNode; pillar?: Pillar; title: React.ReactNode; sub?: React.ReactNode;
  value?: React.ReactNode; onClick?: () => void; chevron?: boolean; end?: React.ReactNode; danger?: boolean;
  children?: React.ReactNode; className?: string;
}> = ({ icon, pillar, title, sub, value, onClick, chevron, end, danger, children, className }) => {
  const body = (
    <>
      {icon && <IconChip pillar={danger ? 'danger' : pillar}>{icon}</IconChip>}
      <span className="v2-row-main">
        <span className="v2-row-top">
          <span className={`v2-row-title ${danger ? 'v2-danger' : ''}`}>{title}</span>
          {value !== undefined && <span className="v2-row-val">{value}</span>}
        </span>
        {children}
        {sub && <span className="v2-row-sub">{sub}</span>}
      </span>
      {end}
      {chevron && <ChevronRight className="v2-row-chev" size={20} {...ICON_PROPS} />}
    </>
  );
  return onClick
    ? <button type="button" className={`v2-row ${className ?? ''}`} onClick={onClick}>{body}</button>
    : <div className={`v2-row ${className ?? ''}`}>{body}</div>;
};

export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label}
    className={`v2-toggle ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)} />
);

/** SVG ring used by the home score. */
export const ScoreArc: React.FC<{ value: number; size?: number; stroke?: number }> = ({ value, size = 132, stroke = 12 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="v2-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
      <circle className="v2-ring-val" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
    </svg>
  );
};
