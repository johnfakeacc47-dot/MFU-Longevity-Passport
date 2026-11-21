// Settings > Appearance: choose a palette or a custom accent, preview it on a
// scoped mini-screen, then apply. State is owned by ThemeProvider (contexts/ThemeContext);
// colours come from utils/themePalettes. Nothing here touches page CSS.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Sun, Moon, MonitorSmartphone, Palette as PaletteIcon, TriangleAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';
import { Segmented, ScoreArc, ICON_PROPS } from './v2';
import {
  PALETTES, buildTokens, resolveColors, contrast, onColor, normalizeHex, isHex,
  type PaletteId,
} from '../utils/themePalettes';

export const ThemeCustomizer: React.FC = () => {
  const { t } = useLanguage();
  const { theme, setTheme, resolvedTheme, appearance, setAppearance, resetAppearance } = useTheme();

  // Draft = what the preview shows; Apply commits it.
  const [palette, setPalette] = useState<PaletteId>(appearance.palette);
  const [accent, setAccent] = useState<string | null>(appearance.accent);
  const [hexText, setHexText] = useState<string>(appearance.accent ?? '');
  const [justApplied, setJustApplied] = useState(false);

  // Follow external changes (e.g. Reset).
  useEffect(() => {
    setPalette(appearance.palette); setAccent(appearance.accent); setHexText(appearance.accent ?? '');
  }, [appearance]);

  const hexValid = hexText === '' || isHex(hexText.startsWith('#') ? hexText : `#${hexText}`);
  const dirty = palette !== appearance.palette || (accent ?? null) !== (appearance.accent ?? null);
  const isDefault = appearance.palette === 'original' && !appearance.accent && theme === 'system';

  const pickPalette = (id: PaletteId) => { setPalette(id); setAccent(null); setHexText(''); setJustApplied(false); };
  const setCustom = (raw: string) => {
    setHexText(raw);
    const n = normalizeHex(raw);
    if (n) { setAccent(n); setJustApplied(false); }
    else if (raw === '') { setAccent(null); }
  };

  const colors = useMemo(() => resolveColors(palette, accent, resolvedTheme), [palette, accent, resolvedTheme]);
  const tokens = useMemo(() => buildTokens(palette, accent, resolvedTheme, true), [palette, accent, resolvedTheme]);
  const btnRatio = contrast(onColor(colors.primary), colors.primary);
  const adjusted = !!accent && normalizeHex(accent) !== colors.primary;
  const textRatio = contrast(colors.text, colors.surface);

  const apply = () => {
    setAppearance({ palette, accent });
    setJustApplied(true);
    window.setTimeout(() => setJustApplied(false), 2200);
  };

  const modeOptions = [
    { value: 'light', label: <><Sun size={16} {...ICON_PROPS} /> {t('v2.theme.light')}</> },
    { value: 'dark', label: <><Moon size={16} {...ICON_PROPS} /> {t('v2.theme.dark')}</> },
    { value: 'system', label: <><MonitorSmartphone size={16} {...ICON_PROPS} /> {t('v2.theme.system')}</> },
  ];

  const appliedName = appearance.accent ? t('v2.palette.custom') : t(`v2.palette.${appearance.palette}`);

  return (
    <section className="v2-tc" aria-labelledby="tc-title">
      <div>
        <h2 className="v2-h2" id="tc-title">{t('v2.appearance')}</h2>
        <p className="v2-muted">{t('v2.appearanceSub')}</p>
      </div>

      <div className="v2-field">
        <span className="v2-label">{t('v2.mode')}</span>
        <Segmented value={theme} onChange={(v) => setTheme(v as Theme)} options={modeOptions} />
      </div>

      <div className="v2-field">
        <span className="v2-label">{t('v2.palette')}</span>
        <div className="v2-pal-grid" role="radiogroup" aria-label={t('v2.palette')}>
          {PALETTES.map((p) => {
            const c = p[resolvedTheme];
            const on = palette === p.id && !accent;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on}
                className={`v2-pal ${on ? 'is-on' : ''}`} onClick={() => pickPalette(p.id)}>
                <span className="v2-pal-sw" style={{ background: c.bg, borderColor: c.lineStrong }} aria-hidden="true">
                  <i style={{ background: c.surface, borderColor: c.line }} />
                  <b style={{ background: c.primary }} />
                  <em style={{ background: c.accent }} />
                </span>
                <span className="v2-pal-name">{t(`v2.palette.${p.id}`)}</span>
                <span className="v2-pal-desc">{t(`v2.palette.${p.id}.desc`)}</span>
                {on && <span className="v2-pal-check" aria-hidden="true"><Check size={14} {...ICON_PROPS} /></span>}
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={!!accent}
            className={`v2-pal ${accent ? 'is-on' : ''}`}
            onClick={() => { const seed = accent ?? colors.primary; setAccent(seed); setHexText(seed); setJustApplied(false); }}>
            <span className="v2-pal-sw v2-pal-sw--custom" aria-hidden="true"><span className="v2-pal-dot"><PaletteIcon size={20} {...ICON_PROPS} /></span></span>
            <span className="v2-pal-name">{t('v2.palette.custom')}</span>
            <span className="v2-pal-desc">{accent ?? t('v2.palette.custom.desc')}</span>
            {accent && <span className="v2-pal-check" aria-hidden="true"><Check size={14} {...ICON_PROPS} /></span>}
          </button>
        </div>
      </div>

      <div className="v2-field">
        <label className="v2-label" htmlFor="tc-hex">{t('v2.customColor')}</label>
        <div className="v2-hex">
          <input type="color" className="v2-hex-picker" aria-label={t('v2.pickColor')}
            value={accent ?? colors.primary}
            onChange={(e) => setCustom(e.target.value.toUpperCase())} />
          <input id="tc-hex" className="v2-input" inputMode="text" autoComplete="off" spellCheck={false} maxLength={7}
            placeholder="#2D7860" value={hexText} aria-invalid={!hexValid}
            onChange={(e) => setCustom(e.target.value.trim())} />
        </div>
        {!hexValid && <span className="v2-hex-err" role="alert">{t('v2.hexInvalid')}</span>}
        {adjusted && hexValid && (
          <span className="v2-note"><TriangleAlert size={16} {...ICON_PROPS} /><span>{t('v2.contrastAdjusted')} <b style={{ color: 'var(--v2-text)' }}>{colors.primary}</b></span></span>
        )}
      </div>

      {/* Live preview: the variables are scoped to this box, the rest of the app is untouched until Apply. */}
      <div className="v2-field">
        <span className="v2-label">{t('v2.preview')}</span>
        <div className="v2-pv" style={tokens as React.CSSProperties} data-testid="theme-preview">
          <div className="v2-pv-head">
            <div><small>{t('v2.previewDate')}</small><strong>{t('v2.previewTitle')}</strong></div>
            <span className="v2-pv-avatar" aria-hidden="true" />
          </div>
          <div className="v2-pv-card">
            <div className="v2-pv-ring"><ScoreArc value={78} size={64} stroke={7} /><b>78</b></div>
            <div className="v2-pv-copy">
              <span>{t('v2.previewCardTitle')}</span>
              <div className="v2-pv-bar"><i /></div>
              <small>{t('v2.previewCardSub')}</small>
            </div>
          </div>
          <div className="v2-pv-btns">
            <span className="v2-pv-btn v2-pv-btn--primary">{t('v2.previewPrimary')}</span>
            <span className="v2-pv-btn">{t('v2.previewSecondary')}</span>
          </div>
          <div className="v2-pv-nav" aria-hidden="true"><i className="on" /><i /><i /><i /></div>
        </div>
        <div className="v2-contrast" aria-live="polite">
          <span><Check size={14} {...ICON_PROPS} /> {t('v2.contrastText')} {textRatio.toFixed(1)}:1</span>
          <span><Check size={14} {...ICON_PROPS} /> {t('v2.contrastButton')} {btnRatio.toFixed(1)}:1</span>
        </div>
      </div>

      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn--ghost" onClick={resetAppearance} disabled={isDefault}>
          <RotateCcw size={18} {...ICON_PROPS} /> {t('v2.resetTheme')}
        </button>
        <button type="button" className="v2-btn v2-btn--primary" style={{ flex: 1.4 }} onClick={apply} disabled={!dirty || !hexValid}>
          {justApplied ? <><Check size={18} {...ICON_PROPS} /> {t('v2.applied')}</> : t('v2.applyTheme')}
        </button>
      </div>
      <p className="v2-muted" style={{ fontSize: 13 }}>{t('v2.currentTheme')}: {appliedName} · {t('v2.savedOnDevice')}</p>
    </section>
  );
};
