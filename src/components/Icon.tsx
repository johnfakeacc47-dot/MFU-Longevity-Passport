import React from 'react';
import {
  Activity,
  ChartNoAxesColumn,
  Clock3,
  HeartPulse,
  House,
  Moon,
  Target,
  Utensils,
  UsersRound,
  UserRound,
} from 'lucide-react';

/**
 * Shared Lucide icon bridge for existing health-pillar component APIs.
 */

type IconName = 'nutrition' | 'fasting' | 'activity' | 'sleep' | 'dashboard' | 'team' | 'profile' | 'home' | 'health' | 'chart';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '', color = 'currentColor' }) => {
  const props = { size, strokeWidth: 1.8, color, 'aria-hidden': true, className: `icon-component ${className}` };
  switch (name) {
    case 'nutrition': return <Utensils {...props} />;
    case 'fasting': return <Clock3 {...props} />;
    case 'activity': return <Activity {...props} />;
    case 'sleep': return <Moon {...props} />;
    case 'home': return <House {...props} />;
    case 'dashboard': return <ChartNoAxesColumn {...props} />;
    case 'team': return <UsersRound {...props} />;
    case 'profile': return <UserRound {...props} />;
    case 'chart': return <ChartNoAxesColumn {...props} />;
    case 'health': return <HeartPulse {...props} />;
    default: return <Target {...props} />;
  }
};
