// Small pieces shared by the Sleep and Mental Health log pages: the last-7-days helper and a
// responsive bar series. They share presentation only: each page reads and writes its own data.
import React from 'react';

export interface DayPoint { key: string; label: string; date: Date }

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export const dayKeyOf = (iso: string | number | Date) => dayKey(new Date(iso));

/** The last `n` calendar days ending today, oldest first. */
export const lastDays = (n: number, locale: string): DayPoint[] => {
  const out: DayPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), date: d, label: d.toLocaleDateString(locale, { weekday: locale.startsWith('th') ? 'narrow' : 'short' }) });
  }
  return out;
};

export const average = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const MiniBars: React.FC<{
  days: DayPoint[];
  values: (number | null)[];
  max: number;
  ariaLabel: string;
  format?: (v: number) => string;
}> = ({ days, values, max, ariaLabel, format = (v) => String(Math.round(v * 10) / 10) }) => {
  let peak = -1;
  values.forEach((v, i) => { if (v !== null && (peak < 0 || v > (values[peak] as number))) peak = i; });
  return (
    <>
      <div className="v2-bars" role="img" aria-label={ariaLabel}>
        {values.map((v, i) => (
          <div key={days[i].key} className={`v2-bars-col ${i === peak ? 'is-peak' : ''}`}>
            {v !== null && i === peak && <em style={{ bottom: `calc(${Math.min(100, (v / max) * 100)}% + 4px)` }}>{format(v)}</em>}
            <i style={{ height: v === null ? '3px' : `${Math.max(3, Math.min(100, (v / max) * 100))}%`, opacity: v === null ? 0.35 : 1 }} />
          </div>
        ))}
      </div>
      <div className="v2-bars-days">{days.map((d) => <span key={d.key}>{d.label}</span>)}</div>
    </>
  );
};
