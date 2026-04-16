import React from 'react';
import { FaChartBar, FaHome, FaUser, FaUsers, FaUtensils } from 'react-icons/fa';

type NavPage = 'home' | 'food' | 'dashboard' | 'team' | 'profile'| 'fasting' ;

interface BottomNavProps {
  active: NavPage;
  onNavigate: (page: any) => void;
  onOpenFoodRecognition: () => void;
  t: (key: string) => string;
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  onNavigate,
  onOpenFoodRecognition,
  t,
  className,
}) => {
  return (
    <footer className={className ?? 'bottom-nav'}>
      <button className={`nav-icon ${active === 'home' ? 'active' : ''}`} onClick={() => onNavigate('home')}>
        <span className="nav-emoji"><FaHome /></span>
        <span className="nav-label">{t('nav.home')}</span>
      </button>
      <button className={`nav-icon ${active === 'food' ? 'active' : ''}`} onClick={onOpenFoodRecognition}>
        <span className="nav-emoji"><FaUtensils /></span>
        <span className="nav-label">{t('nav.food')}</span>
      </button>
      <button className={`nav-icon ${active === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>
        <span className="nav-emoji"><FaChartBar /></span>
        <span className="nav-label">{t('nav.dashboard')}</span>
      </button>
      <button className={`nav-icon ${active === 'team' ? 'active' : ''}`} onClick={() => onNavigate('team')}>
        <span className="nav-emoji"><FaUsers /></span>
        <span className="nav-label">{t('nav.team')}</span>
      </button>
      <button className={`nav-icon ${active === 'profile' ? 'active' : ''}`} onClick={() => onNavigate('profile')}>
        <span className="nav-emoji"><FaUser /></span>
        <span className="nav-label">{t('nav.profile')}</span>
      </button>
    </footer>
  );
};