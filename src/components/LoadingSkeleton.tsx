import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type SkeletonType = 'ring' | 'card' | 'list' | 'kpi' | 'text';

interface LoadingSkeletonProps {
  type?: SkeletonType;
  count?: number;
  className?: string;
}

const RingSkeleton: React.FC = () => (
  <div className="skeleton-ring-wrapper">
    <div className="skeleton skeleton-circle" />
    <div className="skeleton-ring-legend">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-legend-item">
          <div className="skeleton skeleton-dot" />
          <div className="skeleton skeleton-text-sm" />
        </div>
      ))}
    </div>
  </div>
);

const CardSkeleton: React.FC = () => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-icon" />
    <div className="skeleton-card-body">
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text-sm" />
    </div>
  </div>
);

const KPISkeleton: React.FC = () => (
  <div className="skeleton-kpi-grid">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="skeleton-kpi-card">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton-kpi-body">
          <div className="skeleton skeleton-text-lg" />
          <div className="skeleton skeleton-text-sm" />
        </div>
      </div>
    ))}
  </div>
);

const ListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="skeleton-list">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-list-item">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton-list-body">
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text-sm" style={{ width: '60%' }} />
        </div>
      </div>
    ))}
  </div>
);

const TextSkeleton: React.FC = () => (
  <div className="skeleton-text-block">
    <div className="skeleton skeleton-text" style={{ width: '70%' }} />
    <div className="skeleton skeleton-text-sm" style={{ width: '90%' }} />
    <div className="skeleton skeleton-text-sm" style={{ width: '55%' }} />
  </div>
);

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'card',
  count = 1,
  className = '',
}) => {
  const { t } = useLanguage();
  return (
    <div className={`loading-skeleton-wrapper ${className}`} role="status" aria-busy="true" aria-label={t('common.loading')}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {type === 'ring'  && <RingSkeleton />}
          {type === 'card'  && <CardSkeleton />}
          {type === 'kpi'   && <KPISkeleton />}
          {type === 'list'  && <ListSkeleton count={3} />}
          {type === 'text'  && <TextSkeleton />}
        </React.Fragment>
      ))}
    </div>
  );
};
