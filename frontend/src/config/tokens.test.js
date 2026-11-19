import fs from 'fs';
import path from 'path';
import tokens from './tokens';
import { colors as reExportedColors, shadows as reExportedShadows, customClasses } from './colors';
import tailwindConfig from '../../tailwind.config';

const { colors, shadows } = tokens;

// --- WCAG 2.x relative luminance / contrast ------------------------------------------
const parseColor = (value) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value);
  if (!rgb) throw new Error(`Unsupported colour: ${value}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
};

// Composites a (possibly translucent) colour over an opaque backdrop given as [r, g, b].
const flatten = (value, [R, G, B]) => {
  const [r, g, b, a] = parseColor(value);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
};

const luminance = ([r, g, b]) => {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (text, background, backdrop = colors.background.white) => {
  const bg = flatten(background, parseColor(backdrop));
  const fg = flatten(text, bg);
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA_TEXT = 4.5;

describe('design tokens', () => {
  it('are the single source re-exported by config/colors', () => {
    expect(reExportedColors).toBe(colors);
    expect(reExportedShadows).toBe(shadows);
    expect(customClasses.input).toEqual(expect.any(String));
  });

  it('feed the Tailwind theme', () => {
    const { colors: twColors, boxShadow } = tailwindConfig.theme.extend;

    expect(twColors.brand.red).toBe(colors.primary.red);
    expect(twColors.brand['red-hover']).toBe(colors.primary.redHover);
    expect(twColors.brand['red-dark']).toBe(colors.primary.redDark);
    expect(twColors.brand.gray).toBe(colors.text.primary);
    expect(boxShadow.brand).toBe(shadows.brand);
    expect(boxShadow['brand-lg']).toBe(shadows.brandLg);
    expect(twColors.print.ink).toBe(colors.report.print.ink);
    expect(twColors.print.paper).toBe(colors.report.print.paper);
  });

  it('print the report in black on white', () => {
    expect(contrast(colors.report.print.ink, colors.report.print.paper)).toBe(21);
  });

  describe('text contrast (WCAG AA, 4.5:1)', () => {
    const surfaces = ['white', 'lightGray', 'subtle'];

    it.each(['primary', 'secondary', 'dark', 'muted'])('text.%s is readable on light surfaces', (name) => {
      surfaces.forEach((surface) => {
        expect(contrast(colors.text[name], colors.background[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      });
    });

    it.each(Object.keys(colors.badge))('the %s badge text is readable on its tint', (type) => {
      const { text, background } = colors.badge[type];
      surfaces.forEach((surface) => {
        expect(contrast(text, background, colors.background[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      });
    });

    it.each([
      ...Object.keys(colors.notifications).map((key) => [`notifications.${key}`, colors.notifications[key]]),
      ...Object.keys(colors.accent).map((key) => [`accent.${key}`, colors.accent[key]]),
      ...Object.keys(colors.role).map((key) => [`role.${key}`, colors.role[key]]),
      ...['positive', 'negative'].flatMap((kind) =>
        Object.keys(colors.results[kind]).map((level) => [`results.${kind}.${level}`, colors.results[kind][level]])
      ),
    ])('%s text is readable on its background', (_name, pair) => {
      expect(contrast(pair.text, pair.background)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(Object.keys(colors.confidence))('confidence %s text is readable on its light tint', (level) => {
      const { text, bgLight } = colors.confidence[level];
      expect(contrast(text, bgLight)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('report text is readable', () => {
      Object.values(colors.report.text).forEach((text) => {
        expect(contrast(text, colors.background.white)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    });

    it('white text is readable on the brand buttons', () => {
      expect(contrast(colors.text.white, colors.primary.red)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(colors.text.white, colors.primary.redHover)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  it('are the only place with raw colour literals in src', () => {
    const srcDir = path.resolve(__dirname, '..');
    const literal = /#[0-9A-Fa-f]{3,8}\b|rgba?\(/;
    const offenders = [];

    const walk = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        if (!/\.(js|jsx|css)$/.test(entry.name)) return undefined;
        if (full === path.join(__dirname, 'tokens.js')) return undefined;
        fs.readFileSync(full, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            if (literal.test(line)) offenders.push(`${path.relative(srcDir, full)}:${index + 1}: ${line.trim()}`);
          });
        return undefined;
      });
    };
    walk(srcDir);

    expect(offenders).toEqual([]);
  });
});
