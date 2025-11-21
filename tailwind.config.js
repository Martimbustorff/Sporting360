/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#003625',
        secondary:'#373737',
        bgauth:'#001B13',
        titleauth:'#00835B',
        black_gray:'#979797',
        white_gray:'#D3D3D3',
        whiteHomeGamebox:'#F1F1F1',
        white_20 :'rgba(255, 255, 255, 0.2)',
        white_10 :'rgba(255, 255, 255, 0.1)',
        black_20 :'rgba(60, 60, 60, 0.8)',
        background:'#010101',
        background_800:'#121212',
      },
      fontFamily: {
        dinBold: "DinBold",
        dinRegular: ["DinRegular"],
        dinLight: ["DinLight"],
        dinMedium: ["DinMedium"],
        dinCondensed: ["DinCondensed"],
        dinCondensedBold: ["DinCondensedBold"],
        Poppins:["Poppins"],
        PoppinsMedium:["PoppinsMedium"],
        PoppinsBold:["PoppinsBold"],
      },
      // spacing: {
      //   sm: '20px', // Increase spacing
      //   lg: '48px',
      // },
      // fontSize: {
      //   sm: '1rem', // Larger fonts
      //   lg: '1.2rem',
      //   xl: '2rem',
      //   'ssm': '0.9rem',
      //   'mark': '3rem',
      //   'score': '2.5rem',
      //   'base': '1.1rem',
      //   'markscore': '1.4rem',
      //   'header': '1.7rem'
      // },
    },
  },
  plugins: [],
}

