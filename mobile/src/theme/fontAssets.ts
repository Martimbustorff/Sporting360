/** Único sítio a mudar para trocar a fonte de display. DIN licenciada (Martim). */
export const FONT_ASSETS = {
  DinCondensed: require('../../assets/fonts/DINCondensed-Regular.ttf') as number,
  DinCondensedLight: require('../../assets/fonts/DINCondensed-Light.ttf') as number,
  Din: require('../../assets/fonts/DIN-Bold.ttf') as number,
  Poppins: require('../../assets/fonts/Poppins-Regular.ttf') as number,
  PoppinsLight: require('../../assets/fonts/Poppins-Light.ttf') as number,
  PoppinsMedium: require('../../assets/fonts/Poppins-Medium.ttf') as number,
  PoppinsSemiBold: require('../../assets/fonts/Poppins-SemiBold.ttf') as number,
} satisfies Record<'DinCondensed' | 'DinCondensedLight' | 'Din' | 'Poppins' | 'PoppinsLight' | 'PoppinsMedium' | 'PoppinsSemiBold', number>;
