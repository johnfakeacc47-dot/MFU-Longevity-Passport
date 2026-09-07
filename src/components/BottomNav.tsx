import React from 'react';
import { FaChartBar, FaHome, FaUser, FaUsers, FaUtensils } from 'react-icons/fa';

type NavPage = 'home' | 'eating' | 'dashboard' | 'team' | 'profile';

interface BottomNavProps {
  active: NavPage;
  onNavigate: (page: any) => void;
  onOpenFoodRecognition?: () => void;
  t: (key: string) => string;
  className?: string;
}

const NAV_ITEMS = [
  { id: 'home',      icon: FaHome,     labelKey: 'nav.home',      nav: 'home' },
  { id: 'eating',    icon: FaUtensils, labelKey: 'nav.food',      nav: 'eating' },
  { id: 'dashboard', icon: FaChartBar, labelKey: 'nav.dashboard', nav: 'dashboard' },
  { id: 'team',      icon: FaUsers,    labelKey: 'nav.team',      nav: 'team' },
  { id: 'profile',   icon: FaUser,     labelKey: 'nav.profile',   nav: 'profile' },
] as const;

export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  onNavigate,
  onOpenFoodRecognition: _onOpenFoodRecognition,
  t,
  className,
}) => {
  const handleNavClick = (item: typeof NAV_ITEMS[number]) => {
    onNavigate(item.nav);
  };

  return (
    <nav className={className ?? 'bottom-nav-v2'} aria-label="Main navigation">
      <div className="bottom-nav-pill">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item-v2 ${isActive ? 'nav-item-v2--active' : ''}`}
              onClick={() => handleNavClick(item)}
              aria-label={t(item.labelKey)}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="nav-icon-v2">
                {isActive && <div className="nav-active-bg" />}
                <Icon className="nav-icon-svg" aria-hidden="true" />
              </div>
              <span className="nav-label-v2">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};