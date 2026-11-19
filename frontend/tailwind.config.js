const { brand, colors, shadows } = require('./src/config/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Every value comes from src/config/tokens.js (single design-token source)
      colors: {
        brand: {
          red: brand.red,
          'red-hover': brand.redHover,
          'red-dark': brand.redDark,
          'red-light': brand.redLight,
          gray: brand.gray,
          'light-gray': brand.lightGray,
        },
        ink: {
          DEFAULT: colors.text.dark,
          primary: colors.text.primary,
          secondary: colors.text.secondary,
          muted: colors.text.muted,
        },
        surface: {
          app: colors.background.app,
          disabled: colors.background.gray,
        },
        // Printed clinical report (CSS custom properties in index.css)
        print: {
          ink: colors.report.print.ink,
          paper: colors.report.print.paper,
        },
        danger: {
          DEFAULT: colors.form.error,
          ring: colors.form.errorRing,
        },
      },
      fontFamily: {
        'sans': ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif']
      },
      screens: {
        'xs': '475px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      boxShadow: {
        brand: shadows.brand,
        'brand-lg': shadows.brandLg,
        sidebar: shadows.sidebar,
        card: shadows.card,
        alert: shadows.alert,
        'alert-dark': shadows.alertDark,
        'form-error': shadows.formErrorRing,
      },
      transitionProperty: {
        'transform-shadow': 'transform, box-shadow',
      }
    },
  },
  plugins: [],
}
