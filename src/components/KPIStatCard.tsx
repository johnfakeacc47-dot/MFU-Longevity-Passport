import React from 'react';

interface KPIStatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
  className?: string;
}

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'neutral' }> = ({ trend }) => {
  if (trend === 'up') return <span className="kpi-trend kpi-trend-up">↑</span>;
  if (trend === 'down') return <span className="kpi-trend kpi-trend-down">↓</span>;
  return <span className="kpi-trend kpi-trend-neutral">→</span>;
};

export const KPIStatCard: React.FC<KPIStatCardProps> = ({
  icon,
  value,
  label,
  unit,
  trend,
  trendValue,
  color = '#1976D2',
  bgColor,
  onClick,
  className = '',
}) => {
  const bg = bgColor ?? `${color}12`;

  return (
    <div
      className={`kpi-stat-card ${onClick ? 'kpi-stat-card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{ borderColor: `${color}22` }}
    >
      <div className="kpi-icon-wrap" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="kpi-body">
        <div className="kpi-value-row">
          <span className="kpi-value" style={{ color }}>
            {value}
          </span>
          {unit && <span className="kpi-unit">{unit}</span>}
        </div>
        <div className="kpi-label">{label}</div>
        {trend && trendValue && (
          <div className="kpi-trend-row">
            <TrendIcon trend={trend} />
            <span className="kpi-trend-text">{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
};
