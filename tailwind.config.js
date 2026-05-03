/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        accent: {
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          200: 'var(--accent-200)',
          300: 'var(--accent-300)',
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
        },
        success: {
          500: 'var(--success-500)',
          600: 'var(--success-600)',
        },
        warning: {
          500: 'var(--warning-500)',
          600: 'var(--warning-600)',
        },
        error: {
          500: 'var(--error-500)',
          600: 'var(--error-600)',
        },
        editor: {
          bg: 'var(--editor-bg)',
          surface: 'var(--editor-surface)',
          text: 'var(--editor-text)',
          secondary: 'var(--editor-text-secondary)',
          muted: 'var(--editor-text-muted)',
          border: 'var(--editor-border)',
          code: 'var(--editor-code-bg)',
          heading: 'var(--editor-heading)',
          link: 'var(--editor-link)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          surface: 'var(--sidebar-surface)',
          text: 'var(--sidebar-text)',
          muted: 'var(--sidebar-text-muted)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active)',
          border: 'var(--sidebar-border)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        normal: 'var(--transition-normal)',
        slow: 'var(--transition-slow)',
      },
    },
  },
  plugins: [],
}
