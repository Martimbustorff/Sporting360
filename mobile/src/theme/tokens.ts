/**
 * S360 design tokens, extracted from the Figma file "SCP (Copy)"
 * (pages "Last Version S360" and "Calendário").
 *
 * Every new or reworked screen must use these values. Do not hardcode hex
 * colours or font names in components.
 */

export const colors = {
  // Backgrounds
  bg: '#001B13', // screen background (dark green, almost black)
  bgHeader: 'rgba(0, 28, 19, 0.7)', // header bar, with 15px backdrop blur
  surface10: 'rgba(255, 255, 255, 0.1)', // section bars ("1ª Parte", "Informação do Jogo")
  surface20: 'rgba(255, 255, 255, 0.2)', // status strip ("Live - 23'"), tab bar
  divider: '#334942', // inactive tab underline, list separators

  // Brand
  primary: '#00835B', // titles, round badge (J16), "VERDE", button text
  white: '#FFFFFF',
  black: '#000000', // text on light sheet (Figma 564:6981)
  textMuted: 'rgba(255, 255, 255, 0.7)', // dates under the round badge
  textDisabled: 'rgba(255, 255, 255, 0.4)', // inactive tabs

  // Ranking position circle (Figma 500:29423)
  positionCircle: '#FFF068',

  // Match events
  cardYellow: '#F7CF46',
  cardYellowAlt: '#FFB648',
  cardRed: '#F74C66',
} as const;

export const fonts = {
  // Headlines: always uppercase (screen titles, names, minutes, scores, menu items)
  display: 'DinCondensedBold',
  // Body text
  body: 'Poppins',
  bodyMedium: 'PoppinsMedium',
  bodySemiBold: 'PoppinsSemiBold',
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.primary, textTransform: 'uppercase' },
  heroTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.white, textTransform: 'uppercase' },
  menuItem: { fontFamily: fonts.display, fontSize: 20, color: colors.white, textTransform: 'uppercase' },
  minute: { fontFamily: fonts.display, fontSize: 20, color: colors.white, textTransform: 'uppercase' },
  sectionScore: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
  scoreBox: { fontFamily: fonts.display, fontSize: 40, color: colors.bg },
  strip: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white, textTransform: 'uppercase' },
  tab: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  badge: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.white },
  badgeSmall: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white }, // Figma 500:28830 / 500:28917
  // Text field (Figma 564:6907 / 564:6938)
  fieldPlaceholder: { fontFamily: fonts.display, fontSize: 18, color: colors.white, textTransform: 'uppercase' },
  fieldLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.white, textTransform: 'uppercase' },
  menuRow: { fontFamily: fonts.display, fontSize: 18, color: colors.white, textTransform: 'uppercase' }, // Figma 564:7096
  sheetTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.black, textTransform: 'uppercase' }, // Figma 564:6981
  sheetTitleOpen: { fontFamily: fonts.display, fontSize: 24, color: colors.primary, textTransform: 'uppercase' }, // Figma 564:7119
  newsTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.white },
  newsMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  fieldValue: { fontFamily: fonts.body, fontSize: 16, color: colors.white },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  screenX: 14, // horizontal padding on match screens (347px content on 375px)
  screenXWide: 32, // horizontal padding on home / menu screens
} as const;

export const radius = {
  sm: 4, // score boxes
  md: 8, // section bars, tab bar
  pill: 16, // round badge, event icons
  sheet: 48, // GameBox bottom sheet, top corners (Figma 564:6981 / 564:7119)
  hairline: 1, // tab underline ends (Figma 500:28818)
  line: 23, // text field underline (Figma 564:6913)
  button: 52, // primary / secondary buttons (Figma 564:7259), fully round at 51px height
} as const;

export const layout = {
  headerHeight: 96,
  headerBlur: 15,
  crestSize: { width: 75, height: 87 }, // big team crest on match header
  crestSmall: { width: 30, height: 35 }, // crest in calendar rows
  eventIcon: 32,
  buttonHeight: 51,
  headerRowBottom: 13, // gap under the title/back row inside the 96px header (Figma 564:6950)
  headerIcon: 24, // back chevron
  headerSideX: 20, // back chevron left offset
  statusBarHeight: 44, // status bar area included in the 96px header (Figma 564:6950)
  minTouch: 44, // minimum touch target
  tabUnderline: 2, // tab underline thickness
  fieldLineWidth: 1, // empty text field underline (Figma 564:6913)
  fieldLineWidthActive: 2, // filled text field underline (Figma 564:6942)
  fieldLineOpacity: 0.3, // empty underline is white at 30%
  fieldLabelOpacity: 0.5, // small label above a filled value is white at 50%
  fieldGapEmpty: 13, // gap between placeholder row and underline
  fieldGapFilled: 12, // gap between label/value block and underline
  disabledOpacity: 0.5,
  pressedOpacity: 0.8,
  // Game header (Figma 500:28956 / 655:31868)
  teamColumnWidth: 100,
  headerColumnsGap: 33, // between team columns and the centre column
  headerCrestNameGap: 8,
  headerDateGap: 6, // between date line and time / score boxes
  scoreBoxGap: 5,
  badgeSmallPadX: 6, // small competition badge (Figma 500:28830)
  badgeSmallPadY: 2,
  mutedOpacity: 0.7, // date line under the round badge
  // Event rows (Figma 655:31908 / 655:31916)
  eventRowGap: 16,
  eventRowMinHeight: 40,
  cardWidth: 13, // yellow / red card glyph inside the 32px icon
  cardHeight: 19,
  cardRadius: 2,
  cardRotation: '9.07deg',
  subIcon: { width: 16, height: 18 }, // substitution arrows (Figma 655:31919)
  menuRowIcon: 24, // Figma 564:7096 (icon and arrow)
  menuRowGap: 16,
  sheetPadXCollapsed: 40, // Figma 564:6981
  sheetPadYCollapsed: 38,
  sheetPadXOpen: 24, // Figma 564:7119
  sheetPadYOpen: 32,
  sheetChevron: 24,
  sheetVelocity: 500, // px/s: a flick is enough to toggle
  sheetShadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 28, elevation: 16 },
  // SEM FIGMA: news card and ranking row (built from tokens)
  newsImage: { width: 96, height: 72 },
  newsGap: 12,
  positionCircle: 26, // Figma 500:29423
  rankingRowMinHeight: 44,
  avatarSize: 32,
  eventGlyph: 18, // goal / VAR glyph (no Figma; sized like the card glyph)
} as const;
