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
  positionSilver: '#919191', // 2.º lugar (Figma 500:29433)
  positionBronze: '#95735A', // 3.º lugar (Figma 500:29443)

  // Match events
  cardYellow: '#F7CF46',
  cardYellowAlt: '#FFB648',
  cardYellowStat: '#FFC700', // Figma 498:28525 (cartão amarelo nas Estatísticas)
  cardRed: '#F74C66',
} as const;

export const fonts = {
  // Headlines: always uppercase (screen titles, names, minutes, scores, menu items)
  display: 'DinCondensedBold',
  // Body text
  body: 'Poppins',
  bodyLight: 'PoppinsLight',
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
  // Linha de jogo da Agenda (Figma 500:28822): nome de equipa 500:28824; caixa de resultado 489:7158
  rowTeam: { fontFamily: fonts.body, fontSize: 12, color: colors.white },
  rowScore: { fontFamily: fonts.display, fontSize: 24, color: colors.bg },
  // Text field (Figma 564:6907 / 564:6938)
  fieldPlaceholder: { fontFamily: fonts.display, fontSize: 18, color: colors.white, textTransform: 'uppercase' },
  fieldLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.white, textTransform: 'uppercase' },
  menuRow: { fontFamily: fonts.display, fontSize: 18, color: colors.white, textTransform: 'uppercase' }, // Figma 564:7096
  sheetTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.black, textTransform: 'uppercase' }, // Figma 564:6981
  sheetTitleOpen: { fontFamily: fonts.display, fontSize: 24, color: colors.primary, textTransform: 'uppercase' }, // Figma 564:7119
  newsTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.white },
  newsSummary: { fontFamily: fonts.bodyLight, fontSize: 12, color: colors.textMuted },
  newsMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  fieldValue: { fontFamily: fonts.body, fontSize: 16, color: colors.white },
  // Auth (Figma 564:7178 / 564:6896 / 564:6926 / 564:6956 / 564:7164)
  welcomeLogo: { fontFamily: fonts.display, fontSize: 110, color: colors.white, textTransform: 'uppercase' }, // 565:8145
  welcomeTagline: { fontFamily: fonts.display, fontSize: 30, color: colors.white, textTransform: 'uppercase', textAlign: 'center' }, // 564:7256
  // Lock screen (Figma 310:9622, frame 348:37997): logo 565:21545, hint 348:38277
  lockLogo: { fontFamily: fonts.display, fontSize: 48, color: colors.white, textTransform: 'uppercase' },
  // Home (Figma 1561:5056): name 1561:5135, "Sócio desde" label and value 1561:5136 (line height 27)
  homeName: { fontFamily: fonts.display, fontSize: 24, color: colors.white, textTransform: 'uppercase' },
  homeSinceLabel: { fontFamily: fonts.display, fontSize: 14, lineHeight: 27, color: colors.white, textTransform: 'uppercase' },
  homeSinceValue: { fontFamily: fonts.display, fontSize: 20, lineHeight: 27, color: colors.white, textTransform: 'uppercase' },
  authLink: { fontFamily: fonts.body, fontSize: 12, color: colors.white }, // 564:6901 (white at 50%)
  authLinkAction: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.primary }, // 564:6902
  authNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 22, color: colors.white, textAlign: 'center' }, // 564:6929
  authIntro: { fontFamily: fonts.bodyLight, fontSize: 14, lineHeight: 22, letterSpacing: 0.5, color: colors.white }, // 564:6971
  termsBody: { fontFamily: fonts.bodyLight, fontSize: 12, lineHeight: 22, letterSpacing: 0.5, color: colors.white }, // 564:7169
  // Formações (Figma 498:28140): número na camisola 498:28147 e apelido 498:28149
  pitchNumber: { fontFamily: fonts.display, fontSize: 14, color: colors.white, textTransform: 'uppercase' },
  pitchName: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.black, textAlign: 'center' },
  pitchRating: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.white }, // SEM FIGMA: nota do jogador
  // Classificação (Figma 500:29367): cabeçalho 500:29409 (DIN 18 a 60 %), equipa 500:29419, valores 500:29420, posição 500:29424
  tableHead: { fontFamily: fonts.display, fontSize: 18, color: colors.white, textTransform: 'uppercase' },
  tableTeam: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
  tableValue: { fontFamily: fonts.display, fontSize: 20, color: colors.white, textTransform: 'uppercase', textAlign: 'center' },
  tablePosition: { fontFamily: fonts.display, fontSize: 20, color: colors.black, textTransform: 'uppercase' },
  // SEM FIGMA: cartão "S360 MATCHDAY" (Task 17; referência raster 818:20427): "S360" display com o S a primary,
  // "MATCH" fino e "DAY" carregado
  shareLogo: { fontFamily: fonts.display, fontSize: 48, color: colors.white, textTransform: 'uppercase' },
  shareMatch: { fontFamily: fonts.bodyLight, fontSize: 28, color: colors.white, textTransform: 'uppercase' },
  shareDay: { fontFamily: fonts.bodySemiBold, fontSize: 28, color: colors.white, textTransform: 'uppercase' },
  termsTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 22, letterSpacing: 0.5, color: colors.white }, // SEM FIGMA (only lorem body in 564:7169)
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  screenX: 14, // horizontal padding on match screens (347px content on 375px)
  screenXWide: 32, // horizontal padding on home / menu screens
  authX: 30, // horizontal padding on auth screens (315px content on 375px, Figma 564:6906)
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
  // Agenda match row (Figma 500:28822 / 489:7038: 102px row) and list separator (500:28839)
  matchRowPadY: 12, // row top to the badge line
  matchRowGap: 15, // badge line to the crests line
  separator: 1, // 1px rgba(255,255,255,0.2) line between rows
  skeletonRowHeight: 102, // SEM FIGMA: loading placeholder, the height of a match row
  skeletonHeaderHeight: 190, // SEM FIGMA: loading placeholder, the height of the game header (500:28956)
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
  consentSheetHeight: 380, // SEM FIGMA: analytics consent sheet (title, 5 lines of text, two buttons) above the home indicator
  consentGap: 16,
  sheetShadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 28, elevation: 16 },
  // Empty state (Figma 500:29854: Calendar_Check icon 122px, white at 30% inside the SVG)
  emptyIcon: 122,
  emptyGap: 16,
  // SEM FIGMA: offline banner and the "info" empty icon
  offlineBannerPadY: 8,
  emptyInfoIconOpacity: 0.3, // matches the 30% of the calendar SVG
  // SEM FIGMA: news card and ranking row (built from tokens)
  newsImage: { width: 96, height: 72 },
  newsGap: 12,
  positionCircle: 26, // Figma 500:29423
  rankingRowMinHeight: 44,
  avatarSize: 32,
  playerPhoto: 96, // SEM FIGMA: foto redonda no topo do detalhe do jogador (Task 14)
  eventGlyph: 18, // goal / VAR glyph (no Figma; sized like the card glyph)
  // SEM FIGMA: pre-match block of the Sumário tab (Task 9), built from tokens
  formChip: 24, // V / E / D square in the "Forma" row
  formChipGap: 4,
  venuePhotoAspect: 16 / 9, // stadium photo under "Informação do Jogo"
  // Estatísticas (Figma 500:28650): linha de 23 px, 20 px entre linhas e divisória; valores a 30 % antes do jogo (500:29279)
  statRowGap: 20,
  statRowHeight: 23,
  statValueWidth: 64,
  statCardGap: 9,
  statMutedOpacity: 0.3,
  // Formações (Figma 498:28129 campo 347x533.14; jogador 498:28140: camisola 30.028x28, número a 7 px do topo,
  // caixa do apelido branca com padding 5/4 e raio 4). Guarda-redes da casa sobe 7 px sobre a linha de fundo (498:28345).
  pitch: { width: 347, height: 533.14 },
  shirt: { width: 30.028, height: 28 },
  shirtNumberTop: 7,
  pitchNamePadX: 5,
  pitchNamePadY: 4,
  pitchGkOverlap: 7,
  pitchMidGap: 16, // SEM FIGMA: folga entre a última linha e o meio-campo (a maqueta tem 14 a 21 px)
  pitchNameMaxWidth: 76, // SEM FIGMA: a 4 por linha cabem 4 caixas sem se tocarem; o resto leva reticências
  pitchRatingPadX: 4, // SEM FIGMA: etiqueta da nota ao lado da camisola
  subNumberWidth: 28, // SEM FIGMA: coluna do número na lista de suplentes
  // Classificação (Figma 500:29367): linha de 34 px, 8 px entre divisória e linha, círculo da posição 26 px
  // (positionCircle), nome a 34 px da esquerda; colunas J/V/E/D a ~31 px, G a ~40, P a ~30 (centros 162/193/224/256/290/331).
  tableRowHeight: 34,
  tableRowGap: 8,
  tableHeadOpacity: 0.6,
  tableHeadGap: 8, // texto do cabeçalho em 348, primeira divisória em 375 (27 px menos a altura da linha de texto)
  tableNameGap: 8,
  tableColWidth: 31,
  tableGoalsWidth: 44,
  tablePointsWidth: 30,
  // SEM FIGMA: quadro das eliminatórias (BracketView), composto com tokens
  tieTeamGap: 8,
  tieScoreWidth: 32,
  tieBorder: 1,
  // SEM FIGMA: leitor VSports e tab Vídeos (referência 818:20891: miniatura 16:9 a toda a largura, título por baixo)
  videoAspect: 16 / 9,
  videoRadius: 8,
  videoPlayIcon: 56,
  videoGap: 8, // miniatura ao título
  videoListGap: 24, // entre vídeos
  videoCloseBarHeight: 44, // barra do "Fechar" em cima do leitor
  // Welcome (Figma 564:7178)
  welcomeRings: { width: 709.004, height: 709.029 }, // ring group 564:7180 (welcome-rings.svg)
  welcomeRingsLift: 99, // ring/logo centre sits 49.5px above the screen centre (2 x 49.5)
  welcomeLogoGap: 32, // between "S360" and the tagline (564:7253)
  welcomeTaglineWidth: 302,
  welcomeButtonsGap: 20, // between "Entrar" and "Criar uma conta"
  welcomeBottom: 16, // under "Criar uma conta", above the home indicator
  homeIndicator: 34, // iOS home indicator area included in Figma bottoms
  // Entrar / Criar conta / Recuperar (Figma 564:6896 / 564:6926 / 564:6956)
  // Lock screen (Figma 310:9622 / 348:37997, no keypad). Offsets are from the top of the 812px frame.
  lockLogoTop: 77, // logo top; status bar is 44 of it
  lockHintGap: 33, // logo bottom (111) to hint text (144)
  lockHintWidth: 315,
  lockLion: { width: 669, height: 663, left: -40, top: 135 }, // "image 2" 348:37998 (clipped box)
  lockLionImage: { width: 899.6, height: 698.8, left: -271.5, top: -35.8 }, // crop inside the box: 134.46% x 105.4%, -40.59% / -5.4%
  lockRings: { width: 659.006, height: 659.029, left: -5.94, top: -23.78 }, // Frame 39 (348:38002); same ring SVG as welcome at ~0.9295 scale
  lockTint: '#003625', // "Rectangle 954" 348:37999, over the lion
  lockTintOpacity: 0.5,
  lockButtonsGap: 20,
  lockBottom: 16,
  lockScrim: 'rgba(0, 0, 0, 0.6)', // SEM FIGMA: backdrop behind the enable-biometrics prompt
  lockModalPad: 32,
  lockModalGap: 16,
  // Home (Figma 1561:5056). Same lion, tint and rings as the lock screen (lockLion / lockRings / lockTint).
  homeLogoTop: 77, // logo row top (1561:5137); status bar is 44 of it
  homeNameGap: 82, // logo bottom (111, cap-trimmed) to the name (193), measured like lockHintGap
  homeSinceGap: 14, // name bottom (222) to "Sócio desde" (236)
  homeSinceLabelOpacity: 0.5,
  homeBlockGap: 32, // SEM FIGMA: between name, next-game card and menu (card is not on 1561:5056)
  homeMenuSheetGap: 41, // menu bottom (812 - 141) to the collapsed sheet top (712)
  homeSheetExpandedRatio: 0.8, // SEM FIGMA: open GameBox sheet height as a share of the window (content in Task 24)
  authContentTop: 32, // header bottom to the first field
  authIntroTop: 24, // header bottom to the intro text (564:6971)
  authFieldsGap: 32,
  authButtonGap: 16, // button to links / terms note
  authLinksRowGap: 8,
  authLinkGap: 8,
  authBottom: 16, // last footer line to keyboard / bottom
  authRecoverBottom: 30, // "Enviar" to keyboard / bottom
  authMutedOpacity: 0.5,
  authNoteWidth: 267, // terms note under "Criar conta"
  // SEM FIGMA: cartão "S360 MATCHDAY" (Task 17; referência raster 818:20427), largura do conteúdo dos ecrãs de jogo
  mvpRowHeight: 48, // SEM FIGMA: linha de candidato da tab MVP (referência raster 818:21193)
  shareCardWidth: 347,
  shareCardInset: 8, // SEM FIGMA: folga mínima entre o cartão e a borda do ecrã; abaixo de 363 pt o cartão encolhe
  shareQr: 72,
  shareQrQuietZone: 4,
  termsTop: 16, // header bottom to text (564:7169)
  termsSectionGap: 12,
} as const;
