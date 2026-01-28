/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#141414',
        'bg-secondary': '#313131',
        'accent-purple': '#a287f4',
        'accent-cyan': '#12e6c8',
        'accent-green': '#3cf281',
        'text-primary': '#e0e0e0',
        'text-secondary': '#a0a0a0',
        'border': '#2a5a5e',
      },
    },
  },
  plugins: [],
}
