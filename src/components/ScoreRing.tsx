import React, { useEffect, useRef } from 'react';
import type { LongevityBreakdown } from '../utils/longevityScore';

interface ScoreRingProps {
  score: LongevityBreakdown;
  size?: number;
  animated?: boolean;
  /** i18n function — pass `t` from useLanguage */
  t?: (key: string) => string;
  /** Translation key for "Longevity Score" label shown below the number */
  scoreLabel?: string;
  /** Translation key for score level (excellent/good/fair/…) shown in circle */
  scoreLevelKey?: string;
}

const GRADES = [
  { min: 90, label: 'S', color: '#10b981' },
  { min: 80, label: 'A', color: '#22c55e' },
  { min: 65, label: 'B', color: '#84cc16' },
  { min: 50, label: 'C', color: '#f59e0b' },
  { min: 35, label: 'D', color: '#fb923c' },
  { min: 0,  label: 'E', color: '#ef4444' },
];

const PILLARS = [
  { key: 'nutrition', color: '#10B981', labelKey: 'longevity.chipFood',   label: 'Nutrition'     },
  { key: 'exercise',  color: '#F59E0B', labelKey: 'longevity.chipMove',   label: 'Exercise'      },
  { key: 'sleep',     color: '#3B82F6', labelKey: 'longevity.chipSleep',  label: 'Sleep'         },
  { key: 'mental',    color: '#8B5CF6', labelKey: 'longevity.chipMental', label: 'Mental Health' },
] as const;

function getGrade(score: number) {
  return GRADES.find(g => score >= g.min) ?? GRADES[GRADES.length - 1];
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 220,
  animated = true,
  t,
  scoreLabel: _scoreLabel,
  scoreLevelKey,
}) => {
  const strokeWidth = size * 0.074;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const ringRef = useRef<SVGCircleElement>(null);

  const grade = getGrade(score.total);

  const getPillarValue = (key: string): number => {
    if (key === 'exercise') return score.exercise ?? score.activity ?? 0;
    return (score as any)[key] ?? 0;
  };

  const totalPillars = (getPillarValue('nutrition') + getPillarValue('exercise') + getPillarValue('sleep') + getPillarValue('mental')) || 1;

  const segments = PILLARS.map((p) => {
    const val = getPillarValue(p.key);
    return {
      ...p,
      value: val,
      ratio: val / totalPillars,
    };
  });

  let cumulativeDeg = -90;
  const svgSegments = segments.map((seg) => {
    const startDeg = cumulativeDeg;
    const sweepDeg = seg.ratio * 360;
    cumulativeDeg += sweepDeg;
    const endDeg = cumulativeDeg - 1.5;

    if (sweepDeg < 2) return null;

    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = sweepDeg > 180 ? 1 : 0;

    return (
      <path
        key={seg.key}
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        style={{
          filter: `drop-shadow(0 0 ${size * 0.025}px ${seg.color}66)`,
          opacity: seg.value === 0 ? 0.15 : 1,
        }}
      />
    );
  });

  const innerR = radius - strokeWidth - size * 0.022;
  const innerCircumference = 2 * Math.PI * innerR;
  const progressOffset = innerCircumference * (1 - score.total / 100);

  useEffect(() => {
    if (!animated || !ringRef.current) return;
    ringRef.current.style.strokeDashoffset = String(innerCircumference);
    const frame = requestAnimationFrame(() => {
      if (ringRef.current) {
        ringRef.current.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.34, 1.1, 0.64, 1)';
        ringRef.current.style.strokeDashoffset = String(progressOffset);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [score.total, animated, innerCircumference, progressOffset]);

  const scoreFontSize  = size * 0.24;
  const denomFontSize  = size * 0.082;
  const subFontSize    = size * 0.072;
  const levelFontSize  = size * 0.06;
  const badgeFontSize  = size * 0.095;
  const labelFontSize  = size * 0.135;

  // Resolve translated texts
  const scoreLevelText = (t && scoreLevelKey) ? t(scoreLevelKey) : '';

  // Perfectly center the vertical stack (Score + "/100" + Label + optional Level) inside the circle
  // Guarantees an exact ~10px (8–12px proportional to size) margin between "/100" and the text label
  const scoreY = scoreLevelText ? cy - size * 0.13 : cy - size * 0.10;
  const denomY = scoreLevelText ? cy - size * 0.005 : cy + size * 0.035;
  const labelY = scoreLevelText ? cy + size * 0.12 : cy + size * 0.174;
  const levelY = scoreLevelText ? cy + size * 0.235 : 0;

  return (
    <div className="score-ring-container">
      <div className="score-ring-wrapper" style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Longevity score ${score.total} out of 100`}>
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Pillar segments (outer) */}
          {svgSegments}

          {/* Inner progress track */}
          <circle
            cx={cx} cy={cy} r={innerR}
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={strokeWidth * 0.55}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {/* Inner progress fill */}
          <circle
            ref={ringRef}
            cx={cx} cy={cy} r={innerR}
            fill="none"
            stroke={grade.color}
            strokeWidth={strokeWidth * 0.55}
            strokeLinecap="round"
            strokeDasharray={innerCircumference}
            strokeDashoffset={animated ? innerCircumference : progressOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 ${size * 0.022}px ${grade.color}88)` }}
          />

          {/* Score number */}
          <text x={cx} y={scoreY} textAnchor="middle" dominantBaseline="middle"
            fontSize={scoreFontSize} fontWeight="800" fill="#0f172a" fontFamily="'Manrope', sans-serif">
            {score.total}
          </text>
          {/* /100 */}
          <text x={cx} y={denomY} textAnchor="middle" dominantBaseline="middle"
            fontSize={denomFontSize} fontWeight="600" fill="#64748b" fontFamily="'Manrope', sans-serif">
            /100
          </text>
          {/* Longevity Score label ("คะแนนสุขภาพ" / "Health Score") */}
          <text x={cx} y={labelY} textAnchor="middle" dominantBaseline="middle"
            fontSize={subFontSize} fontWeight="600" fill="#64748b" fontFamily="'Manrope', 'Sarabun', sans-serif">
            {t ? t('longevity.ringLabel') : 'Health Score'}
          </text>
          {/* Score level (if scoreLevelKey is provided) */}
          {scoreLevelText ? (
            <text x={cx} y={levelY} textAnchor="middle" dominantBaseline="middle"
              fontSize={levelFontSize} fontWeight="700" fill={grade.color} fontFamily="'Manrope', 'Sarabun', sans-serif">
              {scoreLevelText}
            </text>
          ) : null}

          {/* Grade badge */}
          <circle cx={cx + radius * 0.62} cy={cy - radius * 0.62} r={size * 0.09} fill={grade.color} />
          <text x={cx + radius * 0.62} y={cy - radius * 0.62} textAnchor="middle" dominantBaseline="central"
            fontSize={badgeFontSize} fontWeight="800" fill="white" fontFamily="'Manrope', sans-serif">
            {grade.label}
          </text>

          {/* Pillar mini labels */}
          {PILLARS.map((p, i) => {
            const angle = -90 + (i / PILLARS.length) * 360 + (1 / PILLARS.length) * 180;
            const labelR = radius + strokeWidth * 1.8;
            const rad = (angle * Math.PI) / 180;
            const lx = cx + labelR * Math.cos(rad);
            const ly = cy + labelR * Math.sin(rad);
            return (
              <g key={p.key}>
                <circle cx={lx} cy={ly} r={size * 0.028} fill={p.color} opacity={0.15} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                  fontSize={labelFontSize * 0.52} fontWeight="700" fill={p.color}
                  fontFamily="'Manrope', sans-serif">
                  {getPillarValue(p.key)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Pillar legend */}
      <div className="score-ring-legend">
        {PILLARS.map((p) => (
          <div key={p.key} className="score-ring-legend-item">
            <span className="score-ring-dot" style={{ background: p.color }} />
            <span className="score-ring-legend-label">{t ? t(p.labelKey) : p.label}</span>
            <span className="score-ring-legend-val" style={{ color: p.color }}>{getPillarValue(p.key)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
