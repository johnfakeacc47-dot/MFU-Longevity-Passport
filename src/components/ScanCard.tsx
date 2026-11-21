// Featured "scan food" call-to-action (ui_ref2 daily log). Deliberately NOT the
// neutral list-row template: a solid brand-coloured card with a viewfinder visual,
// a hint of what you get back, and one obvious button. It only opens the existing
// scanner (onOpen); camera / upload / recognition logic is untouched.
// Colours come from semantic tokens (--v2-primary / --v2-on-primary), so each
// palette and mode gets a matching, contrast-checked version automatically.
import React from 'react';
import { Camera, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ICON_PROPS } from './v2';

export const ScanCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { t } = useLanguage();
  return (
    <button type="button" className="v2-scan-card" onClick={onOpen} aria-label={`${t('v2.scanCardTitle')}. ${t('v2.scanCardSub')}`}>
      <span className="v2-scan-copy">
        <span className="v2-scan-eyebrow"><Sparkles size={14} {...ICON_PROPS} /> {t('v2.scanEyebrow')}</span>
        <strong className="v2-scan-title">{t('v2.scanCardTitle')}</strong>
        <span className="v2-scan-sub">{t('v2.scanCardSub')}</span>
        <span className="v2-scan-facts" aria-hidden="true">
          <i>kcal</i><i>{t('food.macroProtein')}</i><i>{t('food.macroCarbs')}</i><i>{t('food.macroFat')}</i>
        </span>
        <span className="v2-scan-cta">{t('v2.scanNow')} <ArrowRight size={18} {...ICON_PROPS} /></span>
      </span>
      <span className="v2-scan-visual" aria-hidden="true">
        <b /><b /><b /><b />
        <Camera size={38} strokeWidth={1.6} />
      </span>
    </button>
  );
};
