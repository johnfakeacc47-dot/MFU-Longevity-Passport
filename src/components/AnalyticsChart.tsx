import React, { useState } from 'react';
import type { TrendPoint } from '../utils/analyticsScore';

interface AnalyticsChartProps {
  data: TrendPoint[];
  activeKey: 'total' | 'nutrition' | 'exercise' | 'sleep' | 'mental';
  color: string;
  maxVal: number;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  data,
  activeKey,
  color,
  maxVal,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="ana-chart-empty">
        <span>No trend data available for this time range.</span>
      </div>
    );
  }

  // Layout dimensions for SVG viewBox
  const width = 600;
  const height = 200;
  const paddingLeft = 32;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Coordinate calculations
  const getX = (idx: number) => {
    if (data.length <= 1) return paddingLeft + chartW / 2;
    return paddingLeft + (idx / (data.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxVal, val));
    return paddingTop + chartH - (clamped / maxVal) * chartH;
  };

  // Build points array
  const points = data.map((pt, idx) => ({
    x: getX(idx),
    y: getY(pt[activeKey]),
    val: pt[activeKey],
    label: pt.label,
    dateStr: pt.dateStr,
  }));

  // Build SVG smooth path (Catmull-Rom or standard bezier / polyline)
  const buildPath = () => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const midX = (curr.x + next.x) / 2;
      d += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const pathD = buildPath();
  const fillD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`
    : '';

  const activeHover = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  // Pick X-axis labels to display (max 6 labels to avoid clutter)
  const step = Math.ceil(points.length / 6);
  const labelIndices = points
    .map((_, i) => i)
    .filter((i) => i % step === 0 || i === points.length - 1);

  return (
    <div className="ana-chart-container">
      {/* Tooltip bar above chart */}
      {activeHover && (
        <div className="ana-chart-tooltip-bar">
          <span className="ana-chart-tooltip-date">{activeHover.label} ({activeHover.dateStr})</span>
          <span className="ana-chart-tooltip-val" style={{ color }}>
            {activeHover.val} <small>/ {maxVal}</small>
          </span>
        </div>
      )}

      <div className="ana-chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="ana-chart-svg">
          <defs>
            <linearGradient id={`gradient-${activeKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + chartH - ratio * chartH;
            const gridVal = Math.round(ratio * maxVal);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(0,0,0,0.06)"
                  strokeDasharray={idx > 0 && idx < 4 ? '4 4' : undefined}
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="ana-svg-axis-label"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          {fillD && (
            <path d={fillD} fill={`url(#gradient-${activeKey})`} />
          )}

          {/* Main curve */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Data points */}
          {points.map((pt, idx) => {
            const isHovered = hoverIdx === idx || (hoverIdx === null && idx === points.length - 1);
            return (
              <g
                key={idx}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => setHoverIdx(idx)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hit area circle */}
                <circle x={pt.x} y={pt.y} r="14" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? color : '#FFFFFF'}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}

          {/* X axis labels */}
          {labelIndices.map((idx) => {
            const pt = points[idx];
            const isLast = idx === points.length - 1;
            return (
              <text
                key={idx}
                x={pt.x}
                y={height - 12}
                textAnchor={idx === 0 ? 'start' : isLast ? 'end' : 'middle'}
                className={`ana-svg-x-label ${hoverIdx === idx ? 'active' : ''}`}
              >
                {pt.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
