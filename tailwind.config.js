/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f7', 100: '#d4dfe9', 200: '#a9bfd3',
          300: '#7e9fbd', 400: '#5380a7', 500: '#2a6191',
          600: '#1a3a5c', 700: '#142d47', 800: '#0e2032', 900: '#07101d'
        },
        gold: {
          50: '#fdf8ed', 100: '#f9edcb', 200: '#f2d997',
          300: '#e9c25e', 400: '#c9a84c', 500: '#a8892d',
          600: '#876b1e', 700: '#664f12', 800: '#45340a', 900: '#221a05'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
