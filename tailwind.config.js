/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        'bg-2': token('bg-2'),
        'bg-3': token('bg-3'),
        label: token('label'),
        'label-2': token('label-2'),
        'label-3': token('label-3'),
        separator: token('separator'),
        fill: token('fill'),
        accent: token('accent'),
        'accent-fill': token('accent-fill'),
        'success-text': token('success-text'),
        'danger-text': token('danger-text'),
        danger: token('danger'),
        success: token('success'),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        // iOS's New York: the vision board's editorial headings.
        serif: ['ui-serif', '"New York"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      fontSize: {
        'large-title': [
          'calc(34px * var(--type-scale, 1))',
          { lineHeight: 'calc(41px * var(--type-scale, 1))', letterSpacing: '0.37px', fontWeight: '700' },
        ],
        title: ['calc(28px * var(--type-scale, 1))', { lineHeight: 'calc(34px * var(--type-scale, 1))', letterSpacing: '0.36px', fontWeight: '700' }],
        title3: [
          'calc(20px * var(--type-scale, 1))',
          { lineHeight: 'calc(25px * var(--type-scale, 1))', letterSpacing: '0.38px', fontWeight: '600' },
        ],
        headline: [
          'calc(17px * var(--type-scale, 1))',
          { lineHeight: 'calc(22px * var(--type-scale, 1))', letterSpacing: '-0.41px', fontWeight: '600' },
        ],
        body: ['calc(17px * var(--type-scale, 1))', { lineHeight: 'calc(22px * var(--type-scale, 1))', letterSpacing: '-0.41px' }],
        subhead: ['calc(15px * var(--type-scale, 1))', { lineHeight: 'calc(20px * var(--type-scale, 1))', letterSpacing: '-0.24px' }],
        footnote: ['calc(13px * var(--type-scale, 1))', { lineHeight: 'calc(18px * var(--type-scale, 1))', letterSpacing: '-0.08px' }],
        caption: ['calc(12px * var(--type-scale, 1))', { lineHeight: 'calc(16px * var(--type-scale, 1))' }],
      },
      borderRadius: {
        row: '12px',
        card: '20px',
      },
      maxWidth: {
        content: '720px',
      },
    },
  },
  plugins: [],
};
