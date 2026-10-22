/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sampled directly from the project mockups
        purple: {
          50: '#F7F0FB', 100: '#EEDFF6', 200: '#DCBFEC',
          300: '#C193DC', 400: '#A25FC6', 500: '#7A1FA2',
          600: '#6B1B8E', 700: '#581674', 800: '#45115B', 900: '#320D42',
        },
        orange: {
          50: '#FFF4E5', 100: '#FFE7C7', 200: '#FFD08F',
          300: '#FFB454', 400: '#FE9C22', 500: '#FE8A00',
          600: '#E07800', 700: '#B86200', 800: '#8F4C00', 900: '#663600',
        },
        canvas: '#F8F9FD',
        hairline: '#ECEDF4',
        ink: { DEFAULT: '#181C1F', soft: '#4B5563', mute: '#8A90A0' },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(24,28,31,0.04), 0 8px 24px rgba(24,28,31,0.05)',
        lift: '0 4px 12px rgba(24,28,31,0.06), 0 18px 40px rgba(24,28,31,0.08)',
        glow: '0 8px 22px rgba(254,138,0,0.32)',
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
    },
  },
  plugins: [],
}
