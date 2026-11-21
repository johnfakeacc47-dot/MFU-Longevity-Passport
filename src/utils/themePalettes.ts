// Colour system for Theme Customization.
//
// A palette is a coordinated set of CSS variables (the `--v2-*` design tokens in
// styles/v2.css). They are applied in ONE place (applyAppearance) as inline
// custom properties on <html>, so every page, the nav, charts, modals and the
// legacy pages (which map their old tokens onto --v2-*) follow without any
// per-page overrides. "MFU Original" applies nothing, so the stylesheet defaults
// (the brand look) stay exactly as designed.

export type PaletteId = 'original' | 'sage' | 'ocean' | 'lavender' | 'beige' | 'rose' | 'midnight';
export type Mode = 'light' | 'dark';

export interface ModeColors {
  bg: string; surface: string; inset: string; line: string; lineStrong: string;
  text: string; text2: string; text3: string;
  primary: string; secondary: string; accent: string;
}
export interface Palette { id: PaletteId; light: ModeColors; dark: ModeColors }

export const DEFAULT_PALETTE: PaletteId = 'original';

export const PALETTES: Palette[] = [
  {
    id: 'original', // identical to the defaults in v2.css
    light: { bg: '#F3F5F3', surface: '#FFFFFF', inset: '#E9EEEA', line: '#DFE5E0', lineStrong: '#C6D0C9', text: '#17201C', text2: '#55615B', text3: '#66716B', primary: '#2D7860', secondary: '#7FA896', accent: '#A8532F' },
    dark:  { bg: '#0E1411', surface: '#161E1A', inset: '#1D2723', line: '#26322D', lineStrong: '#3A4A43', text: '#E6ECE8', text2: '#AAB7B0', text3: '#8F9D96', primary: '#72C8AB', secondary: '#5E9884', accent: '#EBA27D' },
  },
  {
    id: 'sage',
    light: { bg: '#F4F6F1', surface: '#FFFFFF', inset: '#E8EDE3', line: '#DDE3D7', lineStrong: '#C5CEBC', text: '#1B231D', text2: '#56625A', text3: '#66726A', primary: '#487055', secondary: '#8DAA93', accent: '#9A7332' },
    dark:  { bg: '#10150F', surface: '#181F17', inset: '#1F281E', line: '#2A3528', lineStrong: '#3E4C3B', text: '#E8EDE5', text2: '#ABB8A8', text3: '#8F9C8C', primary: '#A3C9A0', secondary: '#6F8F74', accent: '#D9B26F' },
  },
  {
    id: 'ocean',
    light: { bg: '#F1F6FA', surface: '#FFFFFF', inset: '#E4EDF4', line: '#D6E2EC', lineStrong: '#BCCEDD', text: '#13202B', text2: '#50626F', text3: '#62727F', primary: '#1E6CA3', secondary: '#7FB0D4', accent: '#B8651F' },
    dark:  { bg: '#0B141C', surface: '#121D27', inset: '#192633', line: '#243546', lineStrong: '#37506A', text: '#E4EEF6', text2: '#A5B8C8', text3: '#8AA0B2', primary: '#7DB8E8', secondary: '#4F86B0', accent: '#F0A66E' },
  },
  {
    id: 'lavender',
    light: { bg: '#F6F4FA', surface: '#FFFFFF', inset: '#ECE8F4', line: '#E0DAEC', lineStrong: '#C9C0DC', text: '#1F1A2B', text2: '#5E566E', text3: '#6E667E', primary: '#6B52A8', secondary: '#A895D2', accent: '#B34F73' },
    dark:  { bg: '#120F1B', surface: '#1B1726', inset: '#241F33', line: '#30294A', lineStrong: '#463D66', text: '#ECE8F5', text2: '#B5ADC9', text3: '#9890AE', primary: '#B7A3EE', secondary: '#7E6DB0', accent: '#EE9BB5' },
  },
  {
    id: 'beige',
    light: { bg: '#F7F3EC', surface: '#FFFDF9', inset: '#EEE7DA', line: '#E4DBCB', lineStrong: '#CDBFA8', text: '#2A2118', text2: '#6A5C4B', text3: '#76685A', primary: '#8A5A2B', secondary: '#C4A27A', accent: '#3F7452' },
    dark:  { bg: '#17130E', surface: '#201A13', inset: '#29221A', line: '#382F24', lineStrong: '#54483A', text: '#F0E8DC', text2: '#C2B5A3', text3: '#A29684', primary: '#DDB07A', secondary: '#A07C52', accent: '#9CC4A0' },
  },
  {
    id: 'rose',
    light: { bg: '#FAF3F4', surface: '#FFFFFF', inset: '#F3E7E9', line: '#EAD9DC', lineStrong: '#D8BEC3', text: '#2B1B1F', text2: '#6E5258', text3: '#7C6066', primary: '#AC4462', secondary: '#DE9FAE', accent: '#3F7F79' },
    dark:  { bg: '#1A0F12', surface: '#241519', inset: '#2D1B20', line: '#3B2429', lineStrong: '#5A3A42', text: '#F5E8EA', text2: '#CDB0B6', text3: '#AE939A', primary: '#F0A0B4', secondary: '#A8687A', accent: '#8CC7C0' },
  },
  {
    id: 'midnight',
    light: { bg: '#EFF2F8', surface: '#FFFFFF', inset: '#E1E7F1', line: '#D3DBE8', lineStrong: '#B7C3D8', text: '#0F1A2E', text2: '#4A5B78', text3: '#5C6D88', primary: '#2D4FA0', secondary: '#7F98D0', accent: '#9A6F12' },
    dark:  { bg: '#070B16', surface: '#0E1526', inset: '#151E36', line: '#1F2A47', lineStrong: '#33436B', text: '#E6ECF8', text2: '#A3B2D0', text3: '#8798BA', primary: '#86A6F0', secondary: '#5568A0', accent: '#E8C068' },
  },
];

export const getPalette = (id: string | null | undefined): Palette =>
  PALETTES.find((p) => p.id === id) ?? PALETTES[0];

// ── colour maths ────────────────────────────────────────────────────────────
type RGB = [number, number, number];

export const isHex = (s: string): boolean => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());

export const normalizeHex = (s: string): string | null => {
  const t = s.trim().replace(/^#?/, '#');
  if (!isHex(t)) return null;
  const h = t.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `#${full.toUpperCase()}`;
};

const toRgb = (hex: string): RGB => {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = ([r, g, b]: RGB): string =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio (1–21). */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** mix(a, b, t): t = share of `a`. */
const mix = (a: string, b: string, t: number): string => {
  const x = toRgb(a), y = toRgb(b);
  return toHex([x[0] * t + y[0] * (1 - t), x[1] * t + y[1] * (1 - t), x[2] * t + y[2] * (1 - t)]);
};

const rgbToHsl = ([r, g, b]: RGB): [number, number, number] => {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return [h, s, l];
};
const hslToHex = (h: number, s: number, l: number): string => {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
};

const DARK_INK = '#0B1210';
/** Text colour for content placed ON `bg` (button labels): whichever of white / near-black reads better. */
export const onColor = (bg: string): string => (contrast('#FFFFFF', bg) >= contrast(DARK_INK, bg) ? '#FFFFFF' : DARK_INK);

const softOf = (primary: string, surface: string, mode: Mode) => mix(primary, surface, mode === 'light' ? 0.14 : 0.22);

/**
 * Nudge `color` (lightness only, hue kept) until it reads at >= `min`:1 on the
 * page background, the card surface AND its own tinted "soft" fill (the active
 * nav pill / selected chip). Light mode darkens, dark mode lightens.
 */
export const ensureReadable = (color: string, c: Pick<ModeColors, 'bg' | 'surface'>, mode: Mode, min = 4.5): string => {
  const [h, s, l0] = rgbToHsl(toRgb(color));
  let l = l0;
  const ok = (hex: string) =>
    contrast(hex, c.bg) >= min && contrast(hex, c.surface) >= min && contrast(hex, softOf(hex, c.surface, mode)) >= min;
  let hex = hslToHex(h, s, l);
  for (let i = 0; i < 80 && !ok(hex); i++) {
    l += mode === 'light' ? -0.012 : 0.012;
    if (mode === 'light' ? l < 0.03 : l > 0.98) break; // only stop at the far end of the direction we move in
    hex = hslToHex(h, s, l);
  }
  return hex;
};

/** Harmonious neutrals + secondary + complementary accent generated from one accent colour. */
export const deriveFromAccent = (accentHex: string, mode: Mode): ModeColors => {
  const [h, sRaw] = rgbToHsl(toRgb(accentHex));
  const sat = Math.max(0.35, Math.min(0.8, sRaw));
  const comp = (h + 180) % 360;
  if (mode === 'light') {
    const bg = hslToHex(h, 0.16, 0.96), surface = '#FFFFFF';
    return {
      bg, surface, inset: hslToHex(h, 0.15, 0.92), line: hslToHex(h, 0.13, 0.87), lineStrong: hslToHex(h, 0.12, 0.76),
      text: hslToHex(h, 0.28, 0.10), text2: hslToHex(h, 0.10, 0.34), text3: hslToHex(h, 0.08, 0.40),
      primary: accentHex, secondary: hslToHex(h, sat * 0.6, 0.66), accent: ensureReadable(hslToHex(comp, 0.5, 0.45), { bg, surface }, 'light'),
    };
  }
  const bg = hslToHex(h, 0.22, 0.07), surface = hslToHex(h, 0.18, 0.10);
  return {
    bg, surface, inset: hslToHex(h, 0.16, 0.14), line: hslToHex(h, 0.14, 0.19), lineStrong: hslToHex(h, 0.12, 0.29),
    text: hslToHex(h, 0.20, 0.92), text2: hslToHex(h, 0.12, 0.72), text3: hslToHex(h, 0.08, 0.62),
    primary: accentHex, secondary: hslToHex(h, sat * 0.45, 0.42), accent: ensureReadable(hslToHex(comp, 0.6, 0.65), { bg, surface }, 'dark'),
  };
};

/** The colours actually used for (palette, optional custom accent, mode). Text contrast is enforced here. */
export const resolveColors = (id: PaletteId, accent: string | null, mode: Mode): ModeColors => {
  const base = accent && isHex(accent) ? deriveFromAccent(normalizeHex(accent)!, mode) : getPalette(id)[mode];
  const primary = ensureReadable(base.primary, base, mode);
  return { ...base, primary };
};

/** CSS custom properties for the app (empty for untouched "MFU Original"). */
export const buildTokens = (id: PaletteId, accent: string | null, mode: Mode, force = false): Record<string, string> => {
  // `force` is for previews, which need the full set even for the untouched default.
  if (!force && id === DEFAULT_PALETTE && !accent) return {};
  const c = resolveColors(id, accent, mode);
  return {
    '--v2-bg': c.bg, '--v2-surface': c.surface, '--v2-inset': c.inset,
    '--v2-line': c.line, '--v2-line-strong': c.lineStrong,
    '--v2-text': c.text, '--v2-text-2': c.text2, '--v2-text-3': c.text3,
    '--v2-primary': c.primary, '--v2-primary-soft': softOf(c.primary, c.surface, mode), '--v2-on-primary': onColor(c.primary),
    '--v2-secondary': c.secondary, '--v2-accent': c.accent,
    '--v2-nav-bg': mode === 'light' ? `${c.surface}EB` : `${c.surface}F0`, '--v2-nav-border': c.lineStrong,
  };
};

// ── persistence + DOM application (single source of truth) ───────────────────
export interface Appearance { palette: PaletteId; accent: string | null }
export const APPEARANCE_KEY = 'themePalette';
export const DEFAULT_APPEARANCE: Appearance = { palette: DEFAULT_PALETTE, accent: null };

/** Only a palette id and a HEX string are stored — no personal data. */
export const readAppearance = (): Appearance => {
  try {
    const raw = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null');
    const palette = PALETTES.some((p) => p.id === raw?.palette) ? (raw.palette as PaletteId) : DEFAULT_PALETTE;
    const accent = typeof raw?.accent === 'string' ? normalizeHex(raw.accent) : null;
    return { palette, accent };
  } catch {
    return DEFAULT_APPEARANCE;
  }
};
export const writeAppearance = (a: Appearance): void => {
  try {
    if (a.palette === DEFAULT_PALETTE && !a.accent) localStorage.removeItem(APPEARANCE_KEY);
    else localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a));
  } catch { /* storage unavailable — theme still applies for this session */ }
};

let applied: string[] = [];
/** Applies (or clears) the palette tokens on <html> and keeps the browser chrome colour in sync. */
export const applyAppearance = (mode: Mode, a: Appearance): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  applied.forEach((k) => root.style.removeProperty(k));
  const tokens = buildTokens(a.palette, a.accent, mode);
  applied = Object.keys(tokens);
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  root.dataset.palette = a.accent ? 'custom' : a.palette;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tokens['--v2-bg'] ?? getPalette('original')[mode].bg);
};
