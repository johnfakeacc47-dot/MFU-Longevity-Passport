// The site logo (the heart mark used for the favicon / PWA icon), drawn from public/brand-mark.png,
// which holds the exact artwork as an alpha mask. The colour is plain CSS (currentColor, default
// --v2-primary), so it follows the selected palette and light/dark mode with no filters.
import React from 'react';

const RATIO = 388 / 345; // width / height of the artwork — never stretched

export const BrandLogo: React.FC<{ size?: number; className?: string; decorative?: boolean }> = ({
  size = 28, className = '', decorative = false,
}) => (
  <span
    className={`v2-brand ${className}`}
    style={{ width: Math.round(size * RATIO), height: size }}
    {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'MFU Longevity Passport' })}
  />
);
