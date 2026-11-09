/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F5F8F4',
          100: '#E8F0E5',
          300: '#90B083',
          500: '#2E5A44',
          600: '#224433',
          700: '#1C2922',
        },
        gold: {
          400: '#D4AF37',
          500: '#C5A059',
          600: '#A6833E',
        }
      }
    },
  },
  plugins: [],
}
