/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#000000',
        'bg-secondary': '#050505',
        'bg-tertiary': '#0a0a0a',
        'bg-elevated': '#111111',
        'text-primary': '#FFFFFF',
        'text-secondary': '#888888',
        'text-tertiary': '#444444',
        'accent': '#FFFFFF',
        'accent-dim': '#666666',
        'border': '#333333',
        'border-light': '#555555',
        'grid-color': '#1a1a1a',
        'status-active': '#FFFFFF',
        'status-inactive': '#444444',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'press-start': ['var(--font-press-start)', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
        'xs': '11px',
        'sm': '12px',
      },
      spacing: {
        'header': '48px',
        'status': '24px',
        'sidebar': '320px',
        'inspector': '360px',
      },
      letterSpacing: {
        'widest': '0.3em',
        'wider': '0.2em',
        'wide': '0.15em',
      },
      animation: {
        'blink': 'blink 1s infinite',
        'flow': 'flow 1s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        flow: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-20' },
        },
      },
    },
  },
  plugins: [],
}
