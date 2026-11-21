// Sleep log route (`sleep`). Sleep data only; mental health lives on its own page.
import React from 'react';
import { SleepLog } from '../components/SleepLog';
import type { PageType } from '../types/pages';

interface SleepProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const Sleep: React.FC<SleepProps> = ({ onNavigate, onOpenFoodRecognition }) => (
  <SleepLog onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} />
);
