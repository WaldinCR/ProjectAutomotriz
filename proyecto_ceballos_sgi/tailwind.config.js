/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/App.jsx",
    "./src/renderer/main.jsx",
    "./src/renderer/components/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/pages/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/services/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/store/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
