/**
 * Design tokens of ANA Pattern Classifier: the single source of every colour and shadow.
 *
 * CommonJS on purpose: `tailwind.config.js` require()s this file to build the Tailwind theme
 * (`brand-*` classes, `shadow-brand`, and the CSS custom properties declared in `index.css`
 * through `theme()`), and the app reads it through `config/colors.js`.
 * No other file under `src/` may contain a raw hex/rgb colour (enforced by `tokens.test.js`).
 *
 * Accessibility: text/background pairs meet WCAG AA (4.5:1); `tokens.test.js` checks them.
 */

const brand = {
  red: '#9A262B',
  redHover: '#7A1E23',
  redDark: '#6B1B1F',
  redLight: '#B23A3F',
  gray: '#686868',
  // Decorative only (borders, dividers): 2.4:1 on white, too light for text.
  lightGray: '#A6A6A6',
};

const colors = {
  // Brand colors
  primary: {
    red: brand.red,
    redHover: brand.redHover,
    redDark: brand.redDark,
    redLight: brand.redLight,
  },

  // Text
  text: {
    primary: brand.gray,
    // Labels, subtitles and helper text. Was #A6A6A6 (2.4:1 on white); darkened for 4.5:1.
    secondary: '#707070',
    // Large decorative icons of empty states only (not text).
    light: '#BBBBBB',
    dark: '#333333',
    white: '#FFFFFF',
    // Inactive navigation items (Tailwind gray-500)
    muted: '#6B7280',
    // "Corrected to" labels in the audit trail. Was #059669 (3.6:1); emerald-700 for 4.5:1.
    success: '#047857',
  },

  // Backgrounds
  background: {
    white: '#FFFFFF',
    lightGray: '#F8F9FA',
    gray: '#F5F5F5',
    darkGray: '#E5E5E5',
    // Dashboard page background
    app: '#ECECEC',
    // Card headers and read-only fields (Tailwind gray-50)
    subtle: '#F9FAFB',
    // Start of the Compare header gradient (Tailwind slate-50)
    slate: '#F8FAFC',
    // Floating controls over images
    frosted: 'rgba(255, 255, 255, 0.95)',
    // Selected toggle over a light surface (Tailwind blue-500 at 10 %)
    selected: 'rgba(59, 130, 246, 0.1)',
  },

  // Borders
  border: {
    light: '#E0E0E0',
    medium: '#CCCCCC',
    dark: '#999999',
    focus: brand.red,
    // Card and input borders (Tailwind gray-200)
    subtle: '#E5E7EB',
    // Separators inside report cards
    faint: '#F0F0F0',
    // Report section rules (Tailwind slate-200)
    rule: '#E2E8F0',
  },

  // States
  state: {
    success: '#28A745',
    warning: '#FFC107',
    error: '#DC3545',
    info: '#17A2B8',
  },

  // Form validation (floating-label inputs in index.css)
  form: {
    error: '#DC2626',
    errorRing: 'rgba(220, 38, 38, 0.1)',
  },

  // Solid pastel colors for notifications and result badges
  notifications: {
    success: {
      background: '#D4F4DD',
      text: '#0F5132',
      border: '#9DD6A8',
    },
    error: {
      background: '#F8D7DA',
      text: '#842029',
      border: '#F1AAB5',
    },
    warning: {
      background: '#FFF3CD',
      text: '#664D03',
      border: '#FFE69C',
    },
    info: {
      background: '#D1ECF1',
      text: '#055160',
      border: '#97D3DF',
    },
  },

  // Colors for result badges (POSITIVE, NEGATIVE)
  results: {
    positive: {
      high: { background: '#D4F4DD', text: '#0F5132', border: '#9DD6A8' }, // >90%
      medium: { background: '#FFF3CD', text: '#664D03', border: '#FFE69C' }, // 80-90%
      low: { background: '#FCE4EC', text: '#7B1FA2', border: '#F8BBD9' }, // <80%
    },
    negative: {
      high: { background: '#F8D7DA', text: '#842029', border: '#F1AAB5' }, // >85%
      medium: { background: '#FFE4E1', text: '#8B0000', border: '#FFB3BA' }, // 75-85%
      low: { background: '#E8F5E8', text: '#2E7D32', border: '#C8E6C9' }, // <75%
    },
  },

  // Pill badges (<Badge type="…">): a 10 % tint of the hue with a darker text of the same hue.
  // Text colours moved from the 500 shade (2.0-3.8:1) to the 700/800 shades (4.8-7.0:1).
  badge: {
    success: { background: 'rgba(16, 185, 129, 0.1)', text: '#047857' },
    warning: { background: 'rgba(245, 158, 11, 0.1)', text: '#92400E' },
    danger: { background: 'rgba(239, 68, 68, 0.1)', text: '#B91C1C' },
    info: { background: 'rgba(59, 130, 246, 0.1)', text: '#1D4ED8' },
    purple: { background: 'rgba(139, 92, 246, 0.1)', text: '#6D28D9' },
    pink: { background: 'rgba(236, 72, 153, 0.1)', text: '#BE185D' },
    neutral: { background: 'rgba(156, 163, 175, 0.1)', text: '#4B5563' },
  },

  // Pastel accent pairs shared by the role badges and the correction-rate chart
  accent: {
    blue: { background: '#E7F3FF', text: '#004085', border: '#B8DAFF' },
    amber: { background: '#FFF3CD', text: '#856404', border: '#FFE69C' },
  },

  // Role badges
  role: {
    admin: { background: '#FFF3CD', text: '#856404', border: '#FFE69C' },
    standard: { background: '#E7F3FF', text: '#004085', border: '#B8DAFF' },
    fallback: { background: '#F5F5F5', text: brand.gray, border: '#E0E0E0' },
  },

  // Prediction confidence levels (see confidenceConfig.js)
  confidence: {
    HIGH: { bg: '#10B981', bgLight: '#D1FAE5', text: '#065F46', border: '#34D399' },
    MEDIUM: { bg: '#F59E0B', bgLight: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
    LOW: { bg: '#EF4444', bgLight: '#FEE2E2', text: '#991B1B', border: '#F87171' },
  },

  // Printable clinical report
  report: {
    text: {
      ink: '#333333',
      muted: '#666666',
      // Small caption labels. Was #888888 (3.5:1); darkened for 4.5:1.
      caption: '#767676',
    },
    // Paper output (index.css @media print): black text on white
    print: {
      ink: '#000000',
      paper: '#FFFFFF',
    },
  },

  // Translucent overlays
  overlay: {
    light: 'rgba(154, 38, 43, 0.1)',
    medium: 'rgba(154, 38, 43, 0.3)',
    dark: 'rgba(154, 38, 43, 0.5)',
  },

  // Dropzone
  dropzone: {
    borderDefault: '#CCCCCC',
    borderHover: brand.red,
    backgroundHover: 'rgba(154, 38, 43, 0.05)',
  },
};

const shadows = {
  brand: '0 10px 25px -5px rgba(154, 38, 43, 0.1), 0 10px 10px -5px rgba(154, 38, 43, 0.04)',
  brandLg: '0 20px 25px -5px rgba(154, 38, 43, 0.1), 0 10px 10px -5px rgba(154, 38, 43, 0.04)',
  sidebar: '2px 0 10px rgba(0, 0, 0, 0.1)',
  card: '0 1px 3px rgba(0, 0, 0, 0.05)',
  alert: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  alertDark: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
  formErrorRing: `0 0 0 2px ${colors.form.errorRing}`,
};

module.exports = { brand, colors, shadows };
