/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#1e3a5f',
          deep: '#152d4a',
          mid: '#243f66',
          light: '#2d4f7a',
          muted: '#3d5f8a',
        },
        surface: {
          DEFAULT: '#f4f6f9',
          card: '#ffffff',
          muted: '#eef1f6',
        },
        brand: {
          teal: '#2dd4bf',
          tealDark: '#0d9488',
          gold: '#d4a017',
          goldSoft: '#f5e6c8',
          coral: '#e8a0a0',
          blue: '#3b82c4',
          blueSoft: '#dbeafe',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)',
        soft: '0 2px 12px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        panel: '1.5rem',
        card: '1rem',
      },
    },
  },
  plugins: [],
}
