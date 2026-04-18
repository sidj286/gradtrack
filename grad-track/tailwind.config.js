/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          900: '#800000',
          800: '#a52a2a',
          50: '#fff5f5',
        }
      }
    },
  },
  plugins: [],
}