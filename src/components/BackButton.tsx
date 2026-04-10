import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';

interface BackButtonProps {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, ariaLabel, className = '' }) => {
  return (
    <button
      type="button"
      className={`app-back-btn ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <FaArrowLeft aria-hidden="true" />
    </button>
  );
};