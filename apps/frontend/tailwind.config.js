/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /**
       * Colour-opacity modifiers (`bg-white/8`) resolve against this scale. A value
       * that isn't in it emits **no CSS at all**, silently — and the UI leaned on
       * these subtle tints in ~140 places, every one of them dead.
       *
       * The worst offender was table rows: `hover:bg-gray-50 dark:hover:bg-white/3`.
       * With `/3` missing, the dark rule never existed, so the un-gated light rule
       * applied in dark mode too — hovering a row turned it near-white and swallowed
       * the white text and buttons sitting on it.
       *
       * Every value below is one the design already uses. Extending the scale once
       * beats rewriting `bg-white/[0.03]` at 140 call sites.
       */
      opacity: {
        3: '0.03',
        4: '0.04',
        6: '0.06',
        7: '0.07',
        8: '0.08',
        12: '0.12',
        18: '0.18',
        92: '0.92',
        98: '0.98',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Segoe UI"', '"Helvetica Neue"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Arabic"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* Shadcn UI CSS-variable-based tokens */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
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
        // WhatsApp-inspired color palette
        wa: {
          // Primary WhatsApp green
          accent: '#25D366',
          'accent-dark': '#128C7E',
          'accent-light': '#DCF8C6',

          // Dark backgrounds (dark mode)
          'bg-primary': '#0B141A',
          'bg-secondary': '#111B21',
          'bg-tertiary': '#202C33',

          // Chat bubbles
          'bubble-sent': '#005C4B',
          'bubble-received': '#202C33',

          // Text colors
          'text-primary': '#E9EDEF',
          'text-secondary': '#8696A0',

          // Borders
          'border-subtle': 'rgba(255,255,255,0.08)',
        },
        // Keep brand for backward compatibility
        brand: {
          50:  '#f0fdf4',
          100: '#dcf8c6',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#25D366',
          500: '#25D366',
          600: '#128C7E',
          700: '#005C4B',
          800: '#044e3b',
          900: '#022c22',
          950: '#011a15',
        },
        success: {
          50:  '#f0fdf4',
          500: '#25D366',
          700: '#128C7E',
        },
        warning: {
          50:  '#fefce8',
          500: '#f59e0b',
          700: '#b45309',
        },
        error: {
          50:  '#fef2f2',
          500: '#ef4444',
          700: '#b91c1c',
        },
      },
      boxShadow: {
        soft:  '0 1px 2px rgba(0,0,0,0.12)',
        card:  '0 4px 12px rgba(0,0,0,0.15)',
        lift:  '0 8px 32px rgba(0,0,0,0.20)',
        brand: '0 4px 20px rgba(37,211,102,0.25)',
        'wa-sm': '0 2px 8px rgba(0,0,0,0.15)',
        'wa-md': '0 8px 20px rgba(0,0,0,0.20)',
      },
      borderRadius: {
        xl:   '1rem',
        '2xl':'1.5rem',
        '3xl':'2rem',
        '4xl':'2.5rem',
      },
      animation: {
        'fade-in':  'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-slow':'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      spacing: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
      },
    },
  },
  plugins: [],
}
