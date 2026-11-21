import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  House,
  CirclePlus,
  ChartNoAxesColumn,
  MessageCircle,
  UsersRound,
} from 'lucide-react';

// The single navigation component for the whole app (mounted once in App.tsx).
// `eating` is the daily-log hub, `dashboard` is Overview. `profile` (and any
// page that isn't one of the five tabs) highlights nothing.
export type NavPage = 'home' | 'eating' | 'dashboard' | 'coach' | 'team' | 'profile';

interface BottomNavProps {
  active: NavPage;
  onNavigate: (page: any) => void;
  t: (key: string) => string;
  className?: string;
}

const NAV_ITEMS = [
  { id: 'home',      icon: House,             labelKey: 'nav.home' },
  { id: 'eating',    icon: CirclePlus,        labelKey: 'nav.log' },
  { id: 'dashboard', icon: ChartNoAxesColumn, labelKey: 'nav.overview' },
  { id: 'coach',     icon: MessageCircle,     labelKey: 'nav.coach' },
  { id: 'team',      icon: UsersRound,        labelKey: 'nav.team' },
] as const;

export const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate, t, className }) => {
  // Tell the page shell the floating nav is present so every page reserves the
  // same bottom space (see `body[data-has-nav]` in styles/v2.css).
  useEffect(() => {
    document.body.dataset.hasNav = 'true';
    return () => { delete document.body.dataset.hasNav; };
  }, []);

  // Rendered into <body> so no page container's transform/filter/overflow can
  // break its `position: fixed` (QA-010).
  return createPortal(
    <nav className={className ?? 'v2-nav'} aria-label={t('nav.mainNavigation')}>
      <div className="v2-nav-inner">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`v2-nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>,
    document.body,
  );
};
