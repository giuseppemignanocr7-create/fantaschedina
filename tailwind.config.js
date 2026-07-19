/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#080c18', // Very dark navy
        surface: '#0f1726',    // Dark card
        card: '#141f35',       // Slightly lighter card
        primary: {
          50: '#f6ffe6',
          100: '#e9ffc2',
          200: '#d3ff8a',
          300: '#b6f95a',
          400: '#9ae82f',
          500: '#84d80c', // Luminous Lime Green
          600: '#6bb800',
          700: '#528c06',
          800: '#3f6b0d',
          900: '#345510',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Odds Gold
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        live: '#ef4444', // Red for Live/Danger
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'], // Per i timer e quote
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
        'flash': 'flash 0.5s ease-out',
        'ticker': 'ticker 20s linear infinite',
        'marquee': 'marquee 22s linear infinite',
        'shake': 'shake 0.45s ease-in-out',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float': 'float 3s ease-in-out infinite',
        'shine': 'shine 2.5s ease-in-out infinite',
        'wiggle': 'wiggle 0.8s ease-in-out infinite',
        'heartbeat': 'heartbeat 1.2s ease-in-out infinite',
        'ball-fly': 'ballFly 0.5s cubic-bezier(0.2, 0.8, 0.4, 1) forwards',
        'keeper-dive': 'keeperDive 0.45s ease-out forwards',
        'coin-pop': 'coinPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'led-blink': 'ledBlink 0.8s steps(2) infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shine: {
          '0%': { transform: 'translateX(-150%) skewX(-20deg)' },
          '60%, 100%': { transform: 'translateX(250%) skewX(-20deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '15%': { transform: 'scale(1.12)' },
          '30%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.08)' },
        },
        ballFly: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(var(--fly-x, 0), var(--fly-y, -70px)) scale(0.55)' },
        },
        keeperDive: {
          '0%': { transform: 'translateX(0) rotate(0deg)' },
          '100%': { transform: 'translateX(var(--dive-x, 0)) rotate(var(--dive-r, 0deg))' },
        },
        coinPop: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.3)' },
          '60%': { opacity: '1', transform: 'translateY(-6px) scale(1.15)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        ledBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(132, 216, 12, 0.25)' },
          '50%': { boxShadow: '0 0 22px rgba(132, 216, 12, 0.5)' },
        },
        flash: {
          '0%': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
        ticker: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'stadium-gradient': 'linear-gradient(180deg, rgba(11,17,33,0.8) 0%, rgba(11,17,33,0.95) 100%)',
      }
    },
  },
  plugins: [],
}
