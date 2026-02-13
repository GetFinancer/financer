/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        background: {
          DEFAULT: 'hsl(var(--background))',
          surface: 'hsl(var(--background-surface))',
          'surface-hover': 'hsl(var(--background-surface-hover))',
        },

        // Foreground/Text colors
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          secondary: 'hsl(var(--foreground-secondary))',
          disabled: 'hsl(var(--foreground-disabled))',
          inverse: 'hsl(var(--foreground-inverse))',
        },

        // Border colors
        border: {
          DEFAULT: 'hsl(var(--border))',
          focus: 'hsl(var(--border-focus))',
        },

        // Input
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Primary (Electric Blue)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          active: 'hsl(var(--primary-active))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        // Secondary (Violet)
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          hover: 'hsl(var(--secondary-hover))',
          active: 'hsl(var(--secondary-active))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        // Muted
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        // Accent
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // Destructive
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        // Card
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Status colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          subtle: 'hsl(var(--success-subtle))',
          background: 'hsl(var(--success-background))',
        },
        warning: 'hsl(var(--warning))',
        error: 'hsl(var(--error))',

        // Income/Expense
        income: 'hsl(var(--income))',
        expense: 'hsl(var(--expense))',

        // Chart/Data Visualization
        chart: {
          primary: 'hsl(var(--chart-primary))',
          secondary: 'hsl(var(--chart-secondary))',
          success: 'hsl(var(--chart-success))',
          muted: 'hsl(var(--chart-muted))',
          grid: 'hsl(var(--chart-grid))',
        },

        // Glass Effects
        glass: {
          DEFAULT: 'hsl(var(--glass-bg))',
          elevated: 'hsl(var(--glass-bg-elevated))',
          border: 'hsl(var(--glass-border))',
        },
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
        'glass-heavy': 'var(--glass-blur-heavy)',
        'glass-light': 'var(--glass-blur-light)',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
