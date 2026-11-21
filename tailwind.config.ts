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
        // PRECY+ — tokens de interface. Os valores reais vêm de variáveis CSS
        // (ver styles/globals.css), uma "paleta" (--data-palette) por vez,
        // para que a tela de Configurações > Aparência troque toda a
        // interface sem rebuild. `<alpha-value>` é o placeholder nativo do
        // Tailwind para opacidade (ex: bg-primary/10) funcionar com cor
        // vinda de variável — por isso os valores no CSS são "R G B".
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          hover: 'rgb(var(--color-secondary-hover) / <alpha-value>)',
        },
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          dark: 'rgb(var(--color-background-dark) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          dark: 'rgb(var(--color-surface-dark) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
          'card-dark': 'rgb(var(--color-surface-card-dark) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          dark: 'rgb(var(--color-border-dark) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
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
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
        'gradient-primary': 'linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-secondary)) 50%, rgb(var(--color-primary-300)) 100%)',
        'gradient-soft': 'linear-gradient(135deg, rgb(var(--color-background)) 0%, rgb(var(--color-primary-100)) 100%)',
        'gradient-dark': 'linear-gradient(135deg, rgb(var(--color-background-dark)) 0%, rgb(var(--color-surface-dark)) 100%)',
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
