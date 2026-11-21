// Mental health log route (`mental-health`). Mood data only; sleep lives on its own page.
import React from 'react';
import { MentalLog } from '../components/MentalLog';
import type { PageType } from '../types/pages';

interface MentalHealthProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const MentalHealth: React.FC<MentalHealthProps> = ({ onNavigate, onOpenFoodRecognition }) => (
  <MentalLog onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} />
);
