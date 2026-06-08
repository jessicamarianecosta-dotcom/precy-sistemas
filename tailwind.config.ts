import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './providers/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // PRECY+ Paleta Oficial
        primary: {
          DEFAULT: '#8B6C4F',
          50: '#F5F0EB',
          100: '#EDE3D8',
          200: '#D9C4A9',
          300: '#C4A47B',
          400: '#AF854E',
          500: '#8B6C4F',
          600: '#7A5D43',
          700: '#614A35',
          800: '#4A3827',
          900: '#32261A',
          hover: '#7A5D43',
        },
        secondary: {
          DEFAULT: '#B8956A',
          hover: '#A07B52',
        },
        background: {
          DEFAULT: '#FAF7F4',
          dark: '#1C1714',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#2A2220',
          card: '#FFFFFF',
          'card-dark': '#252018',
        },
        border: {
          DEFAULT: '#EDE8E2',
          dark: '#3A3028',
        },
        text: {
          primary: '#2C2018',
          secondary: '#7A6855',
          muted: '#B8A898',
        },
        // Status Colors
        success: {
          DEFAULT: '#5C8B4F',
          light: '#EBF5E8',
          dark: '#3D6B32',
        },
        warning: {
          DEFAULT: '#C4893A',
          light: '#FDF3E5',
          dark: '#9A6A22',
        },
        error: {
          DEFAULT: '#C4503A',
          light: '#FDEBE8',
          dark: '#9A3522',
        },
        info: {
          DEFAULT: '#3A7EC4',
          light: '#E8F2FD',
          dark: '#2A5E9A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-lg': ['2rem', { lineHeight: '1.25', fontWeight: '700' }],
        'display-md': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'display-sm': ['1.25rem', { lineHeight: '1.35', fontWeight: '600' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'modal': '0 20px 60px -10px rgba(0,0,0,0.15)',
        'btn': '0 1px 2px 0 rgba(0,0,0,0.08)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)',
        'gradient-soft': 'linear-gradient(135deg, #FAF7F4 0%, #F0E8DE 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1C1714 0%, #2A2220 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        fadeIn: 'fadeIn 0.3s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        scaleIn: 'scaleIn 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

export default config
