import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Macros } from '../../utils/longevityScore';

interface MacrosSummaryCardProps {
  calories: number;
  macros: Macros;
  calorieTarget?: number;
}

export const MacrosSummaryCard: React.FC<MacrosSummaryCardProps> = ({
  calories,
  macros,
  calorieTarget = 2000,
}) => {
  const { language } = useLanguage();
  const isTh = language === 'th';

  const pct = Math.min((calories / calorieTarget) * 100, 100);
  const SIZE = 140;
  const STROKE = 12;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - pct / 100);

  const items = [
    { label: isTh ? 'โปรตีน'       : 'Protein', val: `${macros.protein}g`,    color: '#3B82F6' },
    { label: isTh ? 'คาร์โบไฮเดรต' : 'Carbs',   val: `${macros.carbs}g`,      color: '#F59E0B' },
    { label: isTh ? 'ไขมัน'      : 'Fat',      val: `${macros.fat}g`,        color: '#EF4444' },
  ];

  return (
    <div className="macros-card">
      <div className="macros-top">
        {/* Calorie Ring */}
        <div className="cal-ring-wrap">
          <svg width={SIZE} height={SIZE} className="cal-ring">
            <circle cx={SIZE/2} cy={SIZE/2} r={R} className="ring-bg" strokeWidth={STROKE} />
            <circle
              cx={SIZE/2} cy={SIZE/2} r={R}
              className="ring-cal"
              strokeWidth={STROKE}
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            />
          </svg>
          <div className="cal-center">
            <span className="cal-val">{calories}</span>
            <span className="cal-unit">kcal</span>
            <span className="cal-target">/ {calorieTarget}</span>
          </div>
        </div>

        {/* Macros grid */}
        <div className="macros-grid">
          {items.map(item => (
            <div key={item.label} className="macro-item" style={{ borderLeftColor: item.color }}>
              <span className="macro-label">{item.label}</span>
              <span className="macro-val">{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="cal-bar-wrap">
        <div className="cal-bar-track">
          <div
            className="cal-bar-fill"
            style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#EF4444' : '#10B981' }}
          />
        </div>
        <span className="cal-bar-label">{Math.round(pct)}% {isTh ? 'ของเป้าหมาย' : 'of goal'}</span>
      </div>
    </div>
  );
};
