/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          background: {
            light: '#F5F3F0',
            dark: '#1C1C1E',
            DEFAULT: '#F5F3F0',
          },
          card: {
            light: '#FFFFFF',
            dark: '#2C2C2E',
            DEFAULT: '#FFFFFF',
          },
          subtle: {
            light: '#FAFAF8',
            dark: '#2C2C2E',
            DEFAULT: '#FAFAF8',
          },
          border: {
            light: '#D8D4CE',
            dark: '#3A3A3C',
            DEFAULT: '#D8D4CE',
          },
          hairline: {
            light: '#DEDAD5',
            dark: '#48484A',
            DEFAULT: '#DEDAD5',
          },
          accent: {
            light: '#007AFF',
            dark: '#0A84FF',
            DEFAULT: '#007AFF',
          },
          orange: {
            light: '#C96A40',
            dark: '#FF9F0A',
            DEFAULT: '#C96A40',
          },
          green: {
            light: '#5B8A6A',
            dark: '#30D158',
            DEFAULT: '#5B8A6A',
          },
          tan: {
            light: '#8A6A3A',
            dark: '#FFD60A',
            DEFAULT: '#8A6A3A',
          },
          red: {
            light: '#FF3B30',
            dark: '#FF453A',
            DEFAULT: '#FF3B30',
          },
          purple: {
            light: '#7A5EA8',
            dark: '#BF5AF2',
            DEFAULT: '#7A5EA8',
          },
          teal: {
            light: '#4A8A96',
            dark: '#40C8E0',
            DEFAULT: '#4A8A96',
          },
          primaryText: {
            light: '#1A1A1A',
            dark: '#FFFFFF',
            DEFAULT: '#1A1A1A',
          },
          secondaryText: {
            light: '#7A7A7A',
            dark: 'rgba(255, 255, 255, 0.6)',
            DEFAULT: '#7A7A7A',
          },
          inputBg: {
            light: '#EDEDEB',
            dark: '#3A3A3C',
            DEFAULT: '#EDEDEB',
          },
          noteBg: {
            light: '#FFFAED',
            dark: 'rgba(255, 159, 10, 0.16)',
            DEFAULT: '#FFFAED',
          },
          noteBorder: {
            light: '#E2D8A0',
            dark: 'rgba(255, 159, 10, 0.3)',
            DEFAULT: '#E2D8A0',
          }
        }
      }
    },
  },
  plugins: [],
}
