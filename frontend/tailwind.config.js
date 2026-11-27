/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        silk: {
          50: '#FAF7F2',
          100: '#F5ECE1',
          200: '#EFE2D3',
          300: '#E4D3C0',
          400: '#D5C0AA',
          500: '#BAA591',
          600: '#A48D77',
          700: '#8A735D',
          800: '#6E5946',
          900: '#3D3025',
        },
        charcoal: {
          700: '#4A433D',
          800: '#342F2B',
          900: '#23201D',
        }
      }
    },
  },
  plugins: [],
};
