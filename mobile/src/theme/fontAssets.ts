/** Único sítio a mudar para trocar a fonte de display. */
export const FONT_ASSETS = {
  // PROVISÓRIO: Barlow Condensed Bold (OFL) até chegar D-DIN Condensed Bold ou a DIN licenciada
  DinCondensedBold: require('../../assets/fonts/BarlowCondensed-Bold.ttf') as number,
  Poppins: require('../../assets/fonts/Poppins-Regular.ttf') as number,
  PoppinsMedium: require('../../assets/fonts/Poppins-Medium.ttf') as number,
  PoppinsSemiBold: require('../../assets/fonts/Poppins-SemiBold.ttf') as number,
} satisfies Record<'DinCondensedBold' | 'Poppins' | 'PoppinsMedium' | 'PoppinsSemiBold', number>;
