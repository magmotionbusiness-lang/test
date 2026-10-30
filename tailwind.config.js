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
        danger: token('danger'),
        success: token('success'),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'large-title': ['34px', { lineHeight: '41px', letterSpacing: '0.37px', fontWeight: '700' }],
        title: ['28px', { lineHeight: '34px', letterSpacing: '0.36px', fontWeight: '700' }],
        title3: ['20px', { lineHeight: '25px', letterSpacing: '0.38px', fontWeight: '600' }],
        headline: ['17px', { lineHeight: '22px', letterSpacing: '-0.41px', fontWeight: '600' }],
        body: ['17px', { lineHeight: '22px', letterSpacing: '-0.41px' }],
        subhead: ['15px', { lineHeight: '20px', letterSpacing: '-0.24px' }],
        footnote: ['13px', { lineHeight: '18px', letterSpacing: '-0.08px' }],
        caption: ['12px', { lineHeight: '16px' }],
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
