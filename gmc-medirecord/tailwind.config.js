const v = name => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: { 950: v('night-950'), 900: v('night-900'), 850: v('night-850'), 800: v('night-800'), 700: v('night-700'), 600: v('night-600') },
        royal: { 500: v('royal-500'), 400: v('royal-400'), 300: v('royal-300') },
        gold: { 600: v('gold-600'), 500: v('gold-500'), 400: v('gold-400'), 300: v('gold-300'), 200: v('gold-200') },
        ink: '#1a0628'
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--gold-500) / .18), 0 20px 50px -20px rgb(var(--royal-500) / .45)',
        gold: '0 10px 30px -10px rgba(212,165,55,.55)'
      }
    }
  },
  plugins: []
}
