import React from 'react';

/**
 * A lightweight icon component providing SVGs for the health pillars.
 * Satisfies the advisor requirement to "change emoji to icon".
 */

type IconName = 'nutrition' | 'fasting' | 'activity' | 'sleep' | 'dashboard' | 'team' | 'profile' | 'home' | 'health' | 'chart';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '', color = 'currentColor' }) => {
  const getPath = () => {
    switch (name) {
      case 'nutrition':
        return <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />; // Placeholder triangle for food/pyramid
      case 'fasting':
        return (
          <>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2" />
            <path d="M5 3l2 2" />
            <path d="M19 3l-2 2" />
          </>
        );
      case 'activity':
        return <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />; // Lightning bolt
      case 'sleep':
        return <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />; // Moon
      case 'home':
        return <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />;
      case 'dashboard':
        return (
          <>
            <path d="M3 3h7v7H3z" />
            <path d="M14 3h7v7h-7z" />
            <path d="M14 14h7v7h-7z" />
            <path d="M3 14h7v7H3z" />
          </>
        );
      case 'team':
        return (
          <>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </>
        );
      case 'profile':
        return (
          <>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </>
        );
      case 'chart':
        return (
          <>
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </>
        );
      case 'health':
        return <path d="M22 12h-4l-3 9L9 3l-3 9H2" />; // Pulse line
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-component ${className}`}
    >
      {getPath()}
    </svg>
  );
};
