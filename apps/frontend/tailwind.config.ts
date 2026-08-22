import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      screens: {
        xs: '475px',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Jeevandata brand colors
        jeevandata: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        // Status semantic colors
        success: {
          DEFAULT: '#10b981',
          light: '#ecfdf5',
          dark: '#064e3b',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fffbeb',
          dark: '#78350f',
        },
        'surface-raised': 'hsl(var(--surface-raised))',
        'surface-sunken': 'hsl(var(--surface-sunken))',
        'surface-overlay': 'hsl(var(--surface-overlay))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        glow: '0 0 20px rgba(6, 182, 212, 0.15)',
        'glow-lg': '0 0 40px rgba(6, 182, 212, 0.2)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 30px -8px rgba(6, 182, 212, 0.15)',
        'card-elevated': '0 4px 20px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.06)',
      },
      keyframes: {
        // Existing
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        // New: Entrance animations
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // Exit animations
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'fade-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(20px)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'scale-in-center': {
          from: { opacity: '0', transform: 'scale(0.9) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // New: Attention grabbers
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        // New: Shimmer loading
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // New: Scanning line
        'scan-line': {
          '0%, 100%': { top: '0%' },
          '50%': { top: '100%' },
        },
        // New: Breathing pulse for recording
        breathing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        // New: Float for subtle hover
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        // New: Gradient shift for animated backgrounds
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        // New: Spin slow for decorative elements
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        // New: Pulse glow for matched face
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(16, 185, 129, 0.6)' },
        },
      },
      animation: {
        // Existing
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
        // Entrance
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-in-down': 'fade-in-down 0.5s ease-out',
        'fade-in-left': 'fade-in-left 0.5s ease-out',
        'fade-in-right': 'fade-in-right 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'scale-in-center': 'scale-in-center 0.4s ease-out',
        // Exit
        'fade-out': 'fade-out 0.3s ease-out',
        'fade-out-right': 'fade-out-right 0.3s ease-out',
        // Attention
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        // Decorative
        shimmer: 'shimmer 2s linear infinite',
        'scan-line': 'scan-line 2s ease-in-out infinite',
        breathing: 'breathing 3s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
