/** @type {import('tailwindcss').Config} */
// Valores iguais a src/theme/tokens.ts (verificado em __tests__/theme/tokens.test.ts).
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        s360: {
          bg: '#001B13',
          header: 'rgba(0, 28, 19, 0.7)',
          surface10: 'rgba(255, 255, 255, 0.1)',
          surface20: 'rgba(255, 255, 255, 0.2)',
          divider: '#334942',
          primary: '#00835B',
          white: '#FFFFFF',
          black: '#000000',
          positionCircle: '#FFF068',
          muted: 'rgba(255, 255, 255, 0.7)',
          disabled: 'rgba(255, 255, 255, 0.4)',
          yellow: '#F7CF46',
          yellowAlt: '#FFB648',
          red: '#F74C66',
        },
      },
      fontFamily: {
        display: ['DinCondensedBold'],
        body: ['Poppins'],
        bodyMedium: ['PoppinsMedium'],
        bodySemiBold: ['PoppinsSemiBold'],
      },
    },
  },
  plugins: [],
};
