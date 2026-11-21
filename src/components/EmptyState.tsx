import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = null,
  title,
  description,
  action,
  onAction,
  className = '',
}) => {
  return (
    <div className={`empty-state-v2 ${className}`}>
      <div className="empty-state-icon">{icon ?? <Inbox size={28} strokeWidth={1.8} />}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && onAction && (
        <button className="empty-state-action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
};
