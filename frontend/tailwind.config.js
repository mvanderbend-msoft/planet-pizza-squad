/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fbfaf5',
          100: '#f4f2e9',
          200: '#e9e5d3',
        },
        sky2: {
          50: '#eef6ff',
          100: '#dbeafe',
        },
        alien: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        cosmic: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 10px 30px -10px rgba(16,185,129,0.35), 0 4px 12px -4px rgba(124,58,237,0.18)',
        soft: '0 4px 16px -4px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
};

