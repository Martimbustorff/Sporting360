/**
 * S360 design tokens, extracted from the Figma file "SCP (Copy)"
 * (pages "Last Version S360" and "Calendário").
 *
 * Every new or reworked screen must use these values. Do not hardcode hex
 * colours or font names in components.
 */

import type { TextStyle } from 'react-native';

export const colors = {
  // Backgrounds
  bg: '#001B13', // screen background (dark green, almost black)
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

  // V7.1 (variáveis do Figma R3IhhyNxNZuVINgUtJjZE3)
  bgRaised: '#06261C',
  bgTint: '#003625',
  primaryOnDark: '#19B37E',
  primaryDeep: '#004A33', // fim do gradiente do cartão do líder dos marcadores (4935:7479)
  textSubtle: 'rgba(255, 255, 255, 0.5)',
  separator: 'rgba(255, 255, 255, 0.25)',
  surface06: 'rgba(255, 255, 255, 0.06)',
  ink: '#001B13',
  inkMuted: 'rgba(0, 27, 19, 0.65)',
  inkSeparator: 'rgba(0, 27, 19, 0.12)',
  danger: '#F74C66',
  scrimV71: 'rgba(0, 13, 9, 0.72)',
  // Sumário V7.1 (4933:7057): derrota na forma, amarelo do cartão e da "Dúvida"
  formLoss: '#E53836',
  yellow71: '#FACC2E',
  yellow71Bg: 'rgba(250, 204, 46, 0.18)',
  // Classificação V7.1 (4935:7111): faixa de zona europeia e legenda
  zoneChampions: '#1F73F2',
  zoneEurope: '#FA8C26',
  zoneConference: '#33BFBF',
  // Formações V7.1 (4947:8531): relva do campo
  pitchField: '#006B4A',
  // Cartão S360 MATCHDAY V7.1 (4946:8197): degradê do topo (#00543b) ao bg e linha do rodapé (branco a 15 %)
  shareCardTop: '#00543B',
  shareCardRule: 'rgba(255, 255, 255, 0.15)',
  // Estádio V7.1 (4923:6136): faixa "Sectores A e B" da legenda
  stadiumSector: '#339E80',
  // Equipa V7.1 (4949:8375): selo "Lesão" na lista de indisponíveis (vermelho da derrota a 25 %)
  injuryBg: 'rgba(229, 56, 54, 0.25)',
} as const;

export const fonts = {
  // Headlines: always uppercase (screen titles, names, minutes, scores, menu items)
  display: 'DinCondensed',
  dinCondensed: 'DinCondensed',
  dinCondensedLight: 'DinCondensedLight',
  din: 'Din',
  // Body text
  body: 'Poppins',
  bodyLight: 'PoppinsLight',
  bodyMedium: 'PoppinsMedium',
  bodySemiBold: 'PoppinsSemiBold',
} as const;

export const space = { s4: 4, s8: 8, s12: 12, s16: 16, s24: 24, s32: 32, s48: 48, s64: 64 } as const;

export const radii = { r8: 8, r12: 12, r16: 16, r28: 28 } as const;

/** lineHeight em pt: fontSize x percentagem, arredondado a 2 casas. */
const lh = (size: number, pct: number) => Math.round(size * pct) / 100;

const dinC = { fontFamily: fonts.dinCondensed, textTransform: 'uppercase' } as const;
const din = { fontFamily: fonts.din, textTransform: 'uppercase' } as const;

/** Estilos de texto V7.1 (sem cor; a cor vem de `colors`). */
export const text71 = {
  score72: { ...dinC, fontSize: 72, lineHeight: lh(72, 100), letterSpacing: 0 },
  display40: { ...dinC, fontSize: 40, lineHeight: lh(40, 100), letterSpacing: 0 },
  titleL28: { ...dinC, fontSize: 28, lineHeight: lh(28, 110), letterSpacing: 0 },
  title24: { ...dinC, fontSize: 24, lineHeight: lh(24, 110), letterSpacing: 0.2 },
  titleS20: { ...dinC, fontSize: 20, lineHeight: lh(20, 110), letterSpacing: 0.2 },
  label16: { ...dinC, fontSize: 16, lineHeight: lh(16, 110), letterSpacing: 0.4 },
  eyebrow13: { ...dinC, fontSize: 13, lineHeight: lh(13, 120), letterSpacing: 0.8 },
  menu15: { ...din, fontSize: 15, lineHeight: lh(15, 120), letterSpacing: 0.6 },
  badge11: { ...din, fontSize: 11, lineHeight: lh(11, 120), letterSpacing: 0.6 },
  body14: { fontFamily: fonts.body, fontSize: 14, lineHeight: lh(14, 150), letterSpacing: 0, textTransform: 'none' },
  bodyLight14: { fontFamily: fonts.bodyLight, fontSize: 14, lineHeight: lh(14, 155), letterSpacing: 0.2, textTransform: 'none' },
  strong14: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: lh(14, 140), letterSpacing: 0, textTransform: 'none' },
  caption12: { fontFamily: fonts.body, fontSize: 12, lineHeight: lh(12, 140), letterSpacing: 0, textTransform: 'none' },
  /** Contagem do cartão do jogo (Figma 4932:6358): Title 32, números tabulares para não tremer ao segundo. */
  countdown32: { ...dinC, fontSize: 32, lineHeight: lh(32, 110), letterSpacing: 0, fontVariant: ['tabular-nums'] },
  captionStrong12: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: lh(12, 140), letterSpacing: 0, textTransform: 'none' },
  /** Marca "S360" do cartão de partilha (4946:8199): DIN Condensed 48. */
  brand48: { ...dinC, fontSize: 48, lineHeight: lh(48, 100), letterSpacing: 0 },
  /** "MATCH" fino do cartão de partilha (4946:8201): Title L 28 em DIN Condensed Light. */
  matchLight28: { fontFamily: fonts.dinCondensedLight, fontSize: 28, lineHeight: lh(28, 110), letterSpacing: 0, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.primary, textTransform: 'uppercase' },
  heroTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.white, textTransform: 'uppercase' },
  menuItem: { fontFamily: fonts.display, fontSize: 20, color: colors.white, textTransform: 'uppercase' },
  minute: { fontFamily: fonts.display, fontSize: 20, color: colors.white, textTransform: 'uppercase' },
  sectionScore: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
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
  sheetTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.black, textTransform: 'uppercase' }, // Figma 564:6981
  // Auth (Figma 564:7178 / 564:6896 / 564:6926 / 564:6956 / 564:7164)
  welcomeLogo: { fontFamily: fonts.display, fontSize: 155, lineHeight: 155, color: colors.white, textTransform: 'uppercase' }, // V7.1 13 Welcome (4940:7278): DIN Condensed 155
  // Lock screen (Figma 310:9622, frame 348:37997): logo 565:21545, hint 348:38277
  lockLogo: { fontFamily: fonts.display, fontSize: 68, lineHeight: 68, color: colors.white, textTransform: 'uppercase' }, // V7.1 48 Bloqueio: logo a 67,76 (DIN Condensed)
  // Home (Figma 1561:5056): name 1561:5135, "Sócio desde" label and value 1561:5136 (line height 27)
  authLink: { fontFamily: fonts.body, fontSize: 12, color: colors.white }, // 564:6901 (white at 50%)
  authIntro: { fontFamily: fonts.bodyLight, fontSize: 14, lineHeight: 22, letterSpacing: 0.5, color: colors.white }, // 564:6971
  // Formações (Figma 498:28140): número na camisola 498:28147 e apelido 498:28149
  // Classificação (Figma 500:29367): cabeçalho 500:29409 (DIN 18 a 60 %), equipa 500:29419, valores 500:29420, posição 500:29424
  tableHead: { fontFamily: fonts.display, fontSize: 18, color: colors.white, textTransform: 'uppercase' },
  tableTeam: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
  // SEM FIGMA: nome na tabela da classificação, mais pequeno que `tableTeam` (pedido do Martim, 18/11)
  standingsTeam: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.white },
  tableValue: { fontFamily: fonts.display, fontSize: 20, color: colors.white, textTransform: 'uppercase', textAlign: 'center' },
  tablePosition: { fontFamily: fonts.display, fontSize: 20, color: colors.black, textTransform: 'uppercase' },
  // Folha GameBox Digital (Figma 450:5419): nome 450:5527, número, etiqueta e valor dos lugares 450:5532 / 450:5533
  gameboxName: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22, letterSpacing: 0.5, color: colors.black, textAlign: 'center' },
  gameboxNumber: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, letterSpacing: 0.5, color: colors.black, textAlign: 'center' },
  // Folha vazia (Figma 348:39563): texto 13/22 e "insere manualmente" SemiBold primary sublinhado
  communityName: { fontFamily: fonts.display, fontSize: 24, color: colors.white, textTransform: 'uppercase' }, // Figma 406:13223
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
  line: 23, // text field underline (Figma 564:6913)
  button: 52, // primary / secondary buttons (Figma 564:7259), fully round at 51px height
} as const;

export const layout = {
  // V7.1 Estatísticas, Formações e Vídeos (4947:8037, 4947:8323, 4947:8624)
  segmentedRadius: 10, // alternador Jogo / partes e Sporting / adversário (4947:8240)
  segmentedPad: 4,
  segmentedGap: 4,
  segmentedItemPadY: 7,
  statBlockGap: 14, // entre blocos de estatística (4947:8239)
  statBarHeight: 4,
  statBarGap: 4,
  statLabelGap: 6, // valores à barra
  statCardW: 10, // cartão na linha "Cartões" (4947:8313)
  statCardH: 14,
  statCardRadius: 2,
  statCardCountGap: 6,
  pitchField: { width: 354, height: 430 }, // 4947:8531
  pitchFieldPad: 12, // SEM FIGMA: folga do campo às linhas dos jogadores
  pitchLinePad: 8, // linha de jogo a 8 pt da borda do campo
  pitchBox: { width: 120, height: 44 }, // grande área
  pitchCircle: 64,
  lineupPhoto: 34, // 4947:8539
  lineupPhotoBox: 36,
  lineupChipLeft: 20, // nota: left 20, top 0 (4947:8542)
  lineupChipRadius: 4,
  lineupNameGap: 2,
  lineupBlockGap: 14,
  subRowGap: 12,
  videoRowThumb: { width: 132, height: 74 }, // 4947:8624, miniatura das linhas
  videoPlayCircle: 44, // botão de play 16:9 (a miniatura grande tem o círculo a 44)
  videoPlayCircleSmall: 32,
  videoRowRadius: 8, // miniatura das linhas (4947:8624)
  videoLabelGap: 4, // rótulo do tipo ao título
  headerHeight: 96,
  headerRow: 52, // V7.1 Header (4918:5132), sem área segura
  crestSize: { width: 75, height: 87 }, // big team crest on match header
  crestSmall: { width: 30, height: 35 }, // crest in calendar rows
  buttonHeight: 52, // V7.1 (Figma 4919:5140)
  headerIcon: 24, // back chevron
  statusBarHeight: 44, // status bar area included in the 96px header (Figma 564:6950)
  minTouch: 44, // minimum touch target
  tabUnderline: 3, // V7.1: indicador (4935:7130)
  tabUnderlineRadius: 2,
  tabTopEqual: 10, // V7.1 tabs iguais (4942:7677)
  tabGapEqual: 10,
  tabTopScroll: 15, // V7.1 tabs com scroll (4935:7128)
  tabGapScroll: 11,
  settingsChevron: 20, // V7.1 19 Conta S360: seta do nome (4941:7546)
  fieldEye: 22, // V7.1 Campo de texto: olho (4939:7192)
  fieldLineWidth: 1, // empty text field underline (Figma 564:6913)
  fieldLineWidthActive: 2, // filled text field underline (Figma 564:6942)
  disabledOpacity: 0.5,
  socialGap: 10, // V7.1 Botão social: logótipo a etiqueta
  socialLogo: 20, // V7.1 Botão social: logótipo (4939:7198)
  socialLabel: 15, // V7.1 Botão social: Poppins Medium 15 (4939:7203)
  buttonOutline: 1.5, // V7.1: contorno do botão (4919:5138)
  // Interruptor (Figma 306:6426)
  toggleWidth: 51,
  toggleHeight: 31,
  toggleKnob: 27,
  toggleInset: 2,
  pressedOpacity: 0.8,
  // Game header (Figma 500:28956 / 655:31868)
  badgeSmallPadX: 6, // small competition badge (Figma 500:28830)
  badgeSmallPadY: 2,
  // Agenda match row (Figma 500:28822 / 489:7038: 102px row) and list separator (500:28839)
  matchRowPadY: 12, // row top to the badge line
  separator: 1, // 1px rgba(255,255,255,0.2) line between rows
  skeletonRowHeight: 102, // SEM FIGMA: loading placeholder, the height of a match row
  skeletonHeaderHeight: 190, // SEM FIGMA: loading placeholder, the height of the game header (500:28956)
  // Event rows (Figma 655:31908 / 655:31916)
  menuRowIcon: 24, // Figma 564:7096 (icon and arrow)
  menuRowGap: 16,
  listRowL: 64, // V7.1 List row (4919:5133), separador incluído
  listRowM: 52,
  sheetPadYCollapsed: 38,
  sheetPadXOpen: 24, // Figma 564:7119
  sheetChevron: 24,
  grabberWidth: 36, // V7.1 GameBox sheet (4920:5084)
  grabberHeight: 5,
  sheetGrabberTopOpen: 10, // folha GameBox aberta (4951:8674)
  grabberOpacity: 0.18,
  sheetVelocity: 500, // px/s: a flick is enough to toggle
  // Mapa do estádio (Figma 450:5254 normal, 450:5095 ampliado: mapa 359 -> 585 de largura) e ligações em baixo (450:5379)
  stadiumMap: { width: 359, height: 383.698 },
  stadiumZoomScale: 585 / 359,
  stadiumZoomMs: 250, // SEM FIGMA: duração da animação de ampliar/reduzir
  // Sites do clube e Comunidade Leonina (Figma 348:44569 / 406:13212)
  lionBlur: 11, // "image 2" 348:44570, desfocado a 11
  communityGap: 24, // 406:13221
  communityBottom: 24, // SEM FIGMA: folga no fim da lista
  settingsFooterBottom: 24, // "Log Out" (733) acima do indicador de início; o Screen já aplica a safe area
  settingsFormGap: 32, // Mudar password 348:26562: campos a 32 entre si
  sheetShadow: { shadowColor: colors.black, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 28, elevation: 16 },
  // Empty state (Figma 500:29854: Calendar_Check icon 122px, white at 30% inside the SVG)
  emptyIcon: 122,
  emptyGap: 16,
  // SEM FIGMA: offline banner and the "info" empty icon
  bannerPadX: 14, // V7.1 OfflineBanner (4952:9047)
  bannerPadY: 10,
  bannerIcon: 18,
  emptyInfoIcon: 64, // V7.1 47 Vazio (4952:9060): ícone Info a 64 (opacidade já no SVG), espaço 12 ao texto
  emptyInfoGap: 12,
  pushBannerCrestW: 26, // V7.1 47 PushBanner (4952:9052): emblema 26x30, padding 14/12, espaço 12, texto a 2
  pushBannerCrestH: 30,
  pushBannerPadY: 12,
  pushBannerTextGap: 2,
  pushBannerShadow: { shadowColor: colors.black, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 9, elevation: 8 }, // 0 6 18 0.4 do Figma (raio de sombra RN = metade)
  // SEM FIGMA: news card and ranking row (built from tokens)
  newsImage: { width: 96, height: 72 },
  newsGap: 12,
  positionCircle: 26, // Figma 500:29423
  rankingRowMinHeight: 44,
  // SEM FIGMA: Perfil (Task 21), composto com tokens
  profileAvatar: 64, // V7.1 22 Perfil: círculo com a inicial do nome público (4942:7650)
  playerBadgeOffsetX: 4, // V7.1 Foto do jogador: distintivo a -4 / -2 (4959:9555)
  playerBadgeOffsetY: 2,
  playerBadgeBorder: 1.5,
  // SEM FIGMA: pre-match block of the Sumário tab (Task 9), built from tokens
  formChip: 24, // V / E / D square in the "Forma" row
  formChipRadius: 6, // 4933:7347
  formRowGap: 6,
  venuePhotoAspect: 16 / 9, // stadium photo under "Informação do Jogo"
  // Estatísticas: valores a 30 % antes do jogo (500:29279)
  statMutedOpacity: 0.3,
  subNumberWidth: 28, // SEM FIGMA: coluna do número na lista de suplentes
  // Classificação (Figma 500:29367): linha de 34 px, 8 px entre divisória e linha, círculo da posição 26 px
  // (positionCircle), nome a 34 px da esquerda; colunas J/V/E/D a ~31 px, G a ~40, P a ~30 (centros 162/193/224/256/290/331).
  // Classificação V7.1 (4935:7287): colunas # 28, J 28, DG 36, PTS 40; linha com 9 de altura vertical e faixa de zona de 3
  stColPos: 28,
  stColPlayed: 28,
  stColDiff: 36,
  stColPts: 40,
  stRowPadY: 9,
  stRowPadRight: 8,
  stRowPadLeft: 10, // sem faixa; com faixa 7 + 3 de borda
  stBand: 3,
  stHeadPadY: 6,
  stArrow: { width: 8, height: 6 }, // Sobe / Desce (4935:7302)
  stArrowGap: 3,
  stLiveDot: 6, // ponto do alternador "Ao vivo" (4935:7282)
  stLegendGap: 14,
  stLegendItemGap: 6,
  stLegendBar: { width: 3, height: 12 },
  stCrestGap: 8,
  stContentGap: 12,
  // SEM FIGMA: quadro das eliminatórias (BracketView), composto com tokens
  tieTeamGap: 8,
  tieBorder: 1,
  // SEM FIGMA: leitor VSports e tab Vídeos (referência 818:20891: miniatura 16:9 a toda a largura, título por baixo)
  videoAspect: 16 / 9,
  videoRadius: 8,
  videoPlayIcon: 56,
  videoGap: 8, // miniatura ao título
  videoCloseBarHeight: 44, // barra do "Fechar" em cima do leitor
  // V7.1 Cartão do próximo jogo (Figma 4920:5140): altura fixa em todos os estados, para o menu não saltar
  matchCardHeight: 192,
  matchCardStrip: 36,
  matchCardTeamMax: 108,
  matchCardCenterMin: 84, // largura do esqueleto da hora; abaixo disto os nomes levam reticências
  matchCardBorder: 1,
  crestCard: { width: 52, height: 60 }, // 4920:5096
  matchCardIcon: 28, // calendário do estado "Sem jogo" (4920:5117)
  matchCardIconOpacity: 0.4, // nota 01b: ícone a 40 %
  matchCardBadgePadY: 3, // badge da ronda e canal de TV (4920:5094)
  matchCardShadow: { shadowColor: colors.black, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  matchCardCenterWideGrow: 2, // dia de jogo: a coluna central ganha espaço para a contagem a 320 pt
  matchCardCountdownMinScale: 0.75, // a contagem encolhe até 75 % em vez de cortar
  shimmerMin: 0.55, // esqueleto: opacidade mínima do brilho
  shimmerMs: 900,
  skeletonCircle: 32, // V7.1 47 Esqueleto (4952:9070): círculo 32 e barra 12 (raio 6) a 12 de distância, linhas a 10
  skeletonBar: 12,
  skeletonGap: 12,
  skeletonRowsGap: 10,
  // V7.1 Home backdrop (Figma 4920:5141)
  homeBackdropLion: { left: -46, top: 80, width: 494, height: 874 },
  homeBackdropLionImage: { left: '-83.11%', top: '-5.4%', width: '239.87%', height: '105.4%' },
  homeBackdropLionOpacity: 0.62,
  homeBackdropTintOpacity: 0.6,
  homeBackdropRingsClip: { width: 402, height: 520 },
  homeBackdropRings: { left: 35, top: 67, width: 608, height: 608 },
  homeBackdropFade: { height: 220, from: 'rgba(0, 27, 19, 0)', to: 'rgba(0, 27, 19, 0.9)' },
  // V7.1 Folha GameBox aberta (Figma 4951:8673 com GameBox, 4951:9190 sem)
  gameboxOpenGap: 14, // todos os espaços verticais da folha aberta (4951:8673)
  gameboxEmptyGapOpen: 20, // câmara, texto e botão (4951:9190)
  gameboxPaginationGap: 6,
  gameboxTextGap: 2, // nome e número; rótulo e valor da coluna
  gameboxOpenHeight: 630,
  gameboxEmptyOpenHeight: 327,
  gameboxQrPad: 12,
  gameboxDotActive: 8,
  gameboxDotInactive: 6,
  gameboxCamera: 64,
  // V7.1 Cabeçalho do jogo (Figma 4924:6268 ao vivo, 4945:7833 antes, 4933:7057 compacto)
  crestHeader: { width: 60, height: 70 }, // 4920:5075 a 60x70 no cabeçalho
  crestCompact: { width: 24, height: 28 }, // 4933:7267
  crestForm: { width: 18, height: 21 }, // 4933:7343 (linha de forma)
  // Sumário V7.1 (4933:7057): cronologia em duas colunas
  tlMinuteW: 44, // caixa do minuto 44x28 raio 6
  tlMinuteH: 28,
  tlMinuteRadius: 6,
  tlRowPadY: 4,
  tlColGap: 10,
  tlLineGap: 6,
  tlIcon: 14, // bola, substituição
  tlCardW: 10, // cartão 10x14 raio 2
  tlCardH: 14,
  tlCardRadius: 2,
  tlTagRadius: 3, // selo VAR
  tlBadgeRadius: 4, // selo Dúvida
  tlBadgePadX: 6,
  tlBadgePadY: 2,
  tlVarPadX: 4,
  tlVarPadY: 1,
  h2hBarHeight: 6, // barra V/E/D 4933:7373
  h2hBarRadius: 3,
  h2hBarGap: 4,
  h2hLabelGap: 6,
  headerTeamColumn: 104,
  headerTeamGap: 8,
  headerPillRadius: 14,
  headerPillPadLeft: 10,
  headerPillPadRight: 12,
  headerPillPadY: 5,
  headerPadTop: 8,
  headerScoreShadow: { shadowColor: colors.black, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  headerScoreGlowElevation: 8,
  headerBallTop: 2,
  timelineMargin: 8,
  timelineDotGap: 4,
  timelineLabelWidth: 40,
  timelineNowGlow: 8,
  chipRadius: 4,
  compactStateChipPadY: 2,
  predictionMargin: 8,
  predictionGap: 12,
  predictionNoteGap: 8,
  headerPillBorder: 1,
  headerPillDot: 8,
  headerScoreBox: { width: 64, height: 80 },
  headerScoreGap: 12,
  headerScoreRingWidth: 2,
  headerScoreRing: '#1AB27D', // contorno e brilho (a 45 %) da caixa de quem marcou por último (4924:6384)
  headerScoreGlowOpacity: 0.45,
  headerScoreGlowRadius: 24,
  headerHingeOpacity: 0.08,
  headerCenterMin: 150, // coluna central: caixas 64+12+64 = 140, com folga
  headerScorersGap: 2,
  headerBallIcon: 12,
  timelineHeight: 44,
  timelineTrack: 4,
  timelineTrackTop: 14,
  timelineGoalDot: 8,
  timelineNowDot: 12,
  timelineHalfMarkHeight: 12,
  timelineHalfMarkWidth: 2,
  timelineHalfMarkOpacity: 0.35,
  timelineLabelTop: 30,
  predictionCardHeight: 64,
  predictionPointsPadX: 10,
  predictionPointsPadY: 6,
  compactCrestGap: 8,
  compactStateChipPadX: 6,
  matchLuz: { width: 680, height: 520, top: -90 }, // 4924:6269 "Luz", centrada no ecrã
  matchRings: { size: 560, top: -74, opacity: 0.22 }, // 4924:6270 "Anéis (marca)" a 22 %
  matchBackdropHeight: 520, // altura do cantinho da luz (4924:6269)
  collapseRange: 120, // SEM FIGMA: alcance de reserva enquanto a altura do cabeçalho completo não foi medida
  collapseCompactFrom: 0.5, // progresso (scroll / altura do cabeçalho) a partir do qual o compacto é o rótulo acessível
  collapseCompactExit: 0.4, // histerese: só volta ao completo abaixo disto
  tabsScrollPad: 24, // folga ao pôr o separador ativo à vista
  homeIndicator: 34, // iOS home indicator area included in Figma bottoms
  // Entrar / Criar conta / Recuperar (Figma 564:6896 / 564:6926 / 564:6956)
  // Lock screen (Figma 310:9622 / 348:37997, no keypad). Offsets are from the top of the 812px frame.
  lockLion: { width: 669, height: 663, left: -40, top: 135 }, // "image 2" 348:37998 (clipped box)
  lockLionImage: { width: 899.6, height: 698.8, left: -271.5, top: -35.8 }, // crop inside the box: 134.46% x 105.4%, -40.59% / -5.4%
  lockTint: '#003625', // "Rectangle 954" 348:37999, over the lion
  lockTintOpacity: 0.5,
  lockButtonsGap: 12, // V7.1 48: botões a 12
  lockActionsBottom: 20, // V7.1 48: último botão a 20 do indicador de início
  // Home (Figma 1561:5056). Same lion, tint and rings as the lock screen (lockLion / lockRings / lockTint).
  homeMenuSheetGap: 9, // V7.1: o menu acaba 9 pt acima da folha GameBox (nota 01)
  authContentTop: 36, // V7.1 13 a 21: fim do Header (114) ao primeiro campo (150)
  authIntroTop: 36, // V7.1 16, 18, 21: fim do Header ao texto de introdução (150)
  authFieldsGap: 32,
  authButtonGap: 12, // V7.1: botões, ligações e nota empilhados a 12
  authLinksRowGap: 12,
  authLinkGap: 6, // V7.1 14 (4940:7374): texto e ação a 6
  authBottom: 20, // V7.1 16, 21: último botão a 20 do indicador de início
  // SEM FIGMA: cartão "S360 MATCHDAY" (Task 17; referência raster 818:20427), largura do conteúdo dos ecrãs de jogo
  mvpRowHeight: 48, // SEM FIGMA: linha de candidato da tab MVP (referência raster 818:21193)
  // V7.1 MVP com notas (4934:7087): linha do jogador, caixa da nota, escolha (radio) e selo "Melhor nota"
  mvpStackGap: 10, // banner, texto e lista
  mvpRowPadY: 6,
  mvpRowGap: 12, // foto, nome, nota, escolha
  mvpPhoto: 36,
  mvpSelectedPadX: 8, // linha escolhida: surface-06, raio 10
  mvpSelectedRadius: 10,
  mvpNameGap: 6, // nome ao selo
  mvpRatingBox: { width: 40, height: 26 }, // 4934:7271
  mvpRatingRadius: 6,
  mvpRadio: 22, // 4934:7273
  mvpRadioStroke: 2, // contorno da escolha por marcar
  mvpRadioRing: 5, // anel branco da escolha marcada
  mvpBadgePadX: 6, // selo "Melhor nota" 4934:7350
  mvpBadgePadY: 2,
  mvpBadgeRadius: 4,
  mvpBadgeGap: 4,
  mvpStar: 10,
  mvpBannerPadY: 12, // banner "Votação aberta" 4934:7256
  mvpBannerGap: 2,
  shareCardWidth: 347,
  shareCardInset: 8, // SEM FIGMA: folga mínima entre o cartão e a borda do ecrã; abaixo de 363 pt o cartão encolhe
  shareQr: 48, // V7.1 4946:8227
  shareQrPad: 6, // caixa branca à volta do QR: 4 módulos de zona de silêncio (~1,5 pt cada), o degradê nunca toca o código
  shareCaptureScale: 3, // o cartão exportado sai sempre a 3x (1041 px de largura)
  stepCompactBelow: 360, // abaixo desta largura de janela o seletor esconde o emblema (nomes longos a 320 pt)
  predictionTabTop: 20, // 4945:8053: do fim dos separadores (348) ao conteúdo (368)
  // V7.1 Prognóstico (4945:8059) e cartão S360 MATCHDAY (4946:8197)
  stepValue: { width: 52, height: 60 }, // caixa branca do seletor
  stepValueRadius: 8,
  stepRowRadius: 16,
  stepRowPadLeft: 16,
  stepRowPadRight: 12,
  stepRowPadY: 12,
  stepRowGap: 12,
  rulesRadius: 12,
  statusIcon: 16, // relógio e visto
  statusGap: 8,
  shareBox: { width: 48, height: 58 }, // caixas do cartão
  shareBoxRadius: 6,
  shareBoxGap: 8,
  shareCardRadius: 20,
  shareCardPadX: 20,
  shareCardPadTop: 20,
  shareCardPadBottom: 18,
  shareCardGap: 14,
  shareTeamWidth: 88,
  shareTeamGap: 6,
  shareFooterPadTop: 10,
  // GameBox (Figma 323:12992 lista, 327:15134 / 450:5633 / 450:5683 formulário)
  gameboxFab: 60, // botão "+" redondo branco (327:14894)
  gameboxFieldsGap: 16, // entre campos (327:15141 / 327:15159)
  gameboxBlockGap: 24, // campos de cima ao cartão Estádio/Pavilhão (327:15140)
  // Folha GameBox Digital (Figma 450:5419 com GameBox, 348:39454 vazia, 348:40189 só Estádio)
  gameboxQr: 189, // 450:5526
  // V7.1 Empréstimo de GameBox (Figma 4984:11545 folha; 4984:11918 cartão do empréstimo ativo)
  loanCardGap: 12, // folha: emblemas e texto
  loanCardPadX: 14,
  loanCardPadY: 12,
  loanStateGap: 8, // cartão ativo: ponto e estado; linhas a 8
  loanDot: 8,
  loanBlockGap: 12, // cartão ativo e botão Cancelar
  // V7.1 Empréstimo, ecrã de quem recebe (Figma 4984:12396) e linha "emprestada a mim" (4984:11976)
  loanQr: 165, // QR do cartão do empréstimo (4984:13083), dentro da caixa branca
  loanQrPad: 16, // zona de silêncio da caixa branca (4984:13082)
  loanRowPadY: 14, // linha com nome e "Emprestada por": 14 em cima e em baixo (as outras linhas levam gameboxRowPadY)
  // V7.1 Modo bilhete (Figma 4936:7161)
  ticketRadius: 20, // cartão branco e faixa de cima
  ticketBandPadX: 20,
  ticketBandPadY: 16,
  ticketBandGap: 12,
  ticketCrest: 40, // emblema redondo na faixa
  ticketCrestImage: { width: 30, height: 35 },
  ticketQr: 220,
  ticketQrPadTop: 24,
  ticketQrPadBottom: 16,
  ticketQrGap: 12,
  ticketPerforation: 1.5, // picotado (traço tracejado)
  ticketSeatPadX: 20,
  ticketSeatPadTop: 16,
  ticketSeatPadBottom: 20,
  ticketSeatGap: 8,
  ticketSeatMinScale: 0.6, // um sector ou lugar comprido encolhe em vez de cortar
  ticketBlockGap: 16, // cartão, sócio e aviso do brilho
  ticketTop: 16, // do Header ao cartão
  // V7.1 Gestão de GameBox (Figma 4951:9204) e Editar (4951:9265)
  gameboxRowGap: 14, // arrastar, nome e seta
  gameboxRowPadY: 18,
  gameboxRowArrow: 20,
  gameboxListTop: 8, // do Header à primeira linha
  gameboxFabEdge: 24, // "+" a 24 pt da direita e de baixo
  gameboxScanButton: 48, // botão de ler o código (4951:9315)
  gameboxScanOffset: 7, // alinha o botão com a linha do número (campo de 55 pt)
  gameboxSeatsPadX: 16, // cartão dos lugares (4951:9327)
  gameboxSeatsPadTop: 4,
  gameboxSeatsPadBottom: 16,
  gameboxSeatsGap: 20,
  gameboxSeatsFieldsGap: 12,
  gameboxContentTop: 16, // do Header ao primeiro campo
  // V7.1 Ler código (Figma 4951:9373)
  scanAim: { width: 260, height: 160 }, // mira
  scanAimCorner: 34,
  scanAimStroke: 3,
  scanSheetPadTop: 20,
  scanSheetPadBottom: 10, // somado à área do indicador home
  scanSheetGap: 14,
  termsTop: 16, // header bottom to text (564:7169)
  termsSectionGap: 20, // V7.1 17: secções a 20
  termsTitleGap: 6, // V7.1 17: título e corpo a 6
  // V7.1 Entrada, conta e bloqueio (frames 13 a 21b, 48, 48b)
  welcomeRingsSize: 560, // 13 Welcome: anéis (4940:7187) a 560 pt
  welcomeRingsOpacity: 0.22,
  welcomeRingsRise: 37, // centro dos anéis 37 pt acima do centro do ecrã
  welcomeLogoDrop: 98, // grupo S360 + frase centrado no espaço acima dos botões, 49 pt abaixo do centro
  welcomeLogoGap: 8, // logo a frase (4940:7279)
  welcomeActionsBottom: 8, // último botão a 8 pt do indicador de início (4940:7284)
  authIntroGap: 24, // 16 Recuperar: texto, campo e mensagem a 24
  authStackGap: 20, // 18 e 21: texto, botão, mensagem e campo a 20
  noticePadX: 14, // mensagem em caixa (16, 18): padding 12 / 14
  noticeGap: 8, // 18: visto e texto
  noticeIcon: 18, // 18: visto
  settingsFieldGap: 24, // 19 Conta S360: campos a 24
  modalSheetGap: 16, // 48b: elementos da folha a 16
  modalSheetGapLoose: 20, // 21b: elementos da folha a 20
  modalSheetBottomExtra: 6, // folha: 40 em baixo = indicador de início (34) + 6
  modalSheetIcon: 40, // 48b: ícone Face ID
  lockLogoOffset: 48, // 48 Bloqueio: logo a 48 pt do fim da barra de estado (62 > 110)
  lockHintGapV71: 22, // 48: logo (fim a 158) a frase (180)
  // V7.1 Marcadores e assistências (4935:7423)
  leaderChipPadX: 14, // chips de competição (4935:7464)
  leaderChipPadY: 7,
  leaderChipRadius: 999,
  leaderCardPadX: 20, // cartão do líder (4935:7479)
  leaderCardPadY: 18,
  leaderPhoto: 56,
  leaderRowPhoto: 36, // linhas (4935:7488)
  leaderRowPadY: 10,
  leaderRankWidth: 16,
  leaderBarHeight: 4,
  leaderBarRadius: 2,
  leaderTextGap: 2,
  leaderNameMinWidth: 96, // o nome do jogador tem prioridade sobre a equipa ao lado (320 pt)
  leaderNameGap: 6, // nome / posição e barra (4935:7490)
  // V7.1 Perfil, Editar perfil, Ranking, Notícias, Definições, Estádio e Consentimento (frames 22 a 27, 02, 04, 05)
  statTilePadX: 16, // 22: PONTOS / POSIÇÃO (4942:7687)
  statTilePadY: 14,
  statTileRadius: 16,
  numberTileRadius: 12, // 22: ACERTO / EXATOS / SÉRIE / MVP (4942:7694)
  numberTileGap: 8,
  historyBadgePadX: 8, // 22: selo de pontos (4942:7712)
  historyBadgePadY: 4,
  historyBadgeRadius: 6,
  editFieldsTop: 26, // 23: do Header ao primeiro campo (4942:7790)
  editFieldsGap: 28,
  chipsLabelGap: 10, // 23: etiqueta e opções (4942:7818)
  chipsGap: 8,
  playerChoiceGap: 10, // 23: Escolha do jogador favorito (4942:7835)
  playerChoicePhoto: 32,
  rankCircle: 32, // 26: posição (4943:7813)
  rankRowPadY: 10,
  rankPinnedRadius: 20, // 26: "A tua posição" fixa em baixo (4943:7862)
  rankPinnedPadTop: 12,
  rankPinnedPadBottom: 12, // 46 no frame, com o indicador de início (34) já dado pela área segura do Screen
  newsImageRadius: 10, // 27: imagem (4943:7926)
  newsTextGap: 6,
  newsRowPadY: 12,
  settingsCardPadLeft: 16, // 02: cartão da conta (4922:5872)
  settingsCardPadRight: 12,
  settingsCardAvatar: 48,
  settingsCardGap: 2,
  settingsFooterGap: 2, // 02: rodapé com a versão (4922:5956)
  stadiumLuz: 520, // 04: luz do relvado (4923:5984)
  stadiumLuzLeft: -59,
  stadiumLuzTop: 68,
  stadiumLegendDoor: 20, // 04: legenda (4923:6131)
  stadiumLegendSectorWidth: 20,
  stadiumLegendSectorHeight: 12,
  stadiumLegendSectorRadius: 3,
  stadiumLegendMuseumPad: 2,
  stadiumLegendMuseumRadius: 4,
  stadiumLegendMuseumIcon: 12,
  stadiumLegendGap: 6,
  stadiumBelowTop: 8, // 04: legenda e ligações a 8
  consentIcon: 48, // 05: folha de consentimento (4923:6368)
  consentCheck: 20,
  consentPadTop: 8,
  consentContentTop: 20,
  consentBottomExtra: 8, // 05: 42 em baixo no frame = indicador de início (34) + 8
  consentItemGap: 8,
  linkNoteIcon: 14, // 03: nota "Abre no navegador" (4922:6039)
  linkNoteGap: 6,
  chipPadX: 12, // pílulas de filtro (4948:8262)
  chipPadY: 6,
  pillRadius: 999,
  playerPhotoRoundedRadius: 20, // Foto do jogador 4959:9551: cantos de 20 também a 84 (frame 42)
  // V7.1 Calendário e jornadas (35 a 37): linha de jogo (4948:8278), seletor de ronda (4948:8390), quadro (4948:8517)
  crestRow: { width: 22, height: 25.52 }, // 4948:8283
  matchRowDate: 56, // coluna da data
  matchRowCenter: 58, // caixa da hora ou do resultado (4948:8286)
  matchRowCenterRadius: 6,
  matchRowCenterPadX: 8,
  matchRowCenterPadY: 4,
  matchRowSideGap: 6, // nome ao emblema
  matchRowDateGap: 2,
  tieCardPadX: 14, // eliminatória (4948:8517)
  tieCardPadY: 10,
  tieCardGap: 8,
  tieCardRadius: 12,
  // V7.1 Equipa (38 a 41): pessoa, estatísticas, transferências e troféus
  personPhoto: 36, // 4949:8366
  personRowPadY: 9,
  personRowGap: 12,
  personArrow: 18, // seta à direita
  tagPadX: 6, // selo Lesão / Dúvida / Entrada / Saída / total de troféus (4949:8375)
  tagPadY: 2,
  tagRadius: 4,
  trophyIcon: 18, // 4949:8708
  trophyGap: 10,
  formBox: 28, // forma V / E / D (4949:8491)
  formBoxGap: 6,
  formBoxRadius: 6,
  splitCardPadX: 14, // Casa / Fora / Total (4949:8502)
  splitCardPadY: 10,
  splitCardGap: 8,
  splitCol: 56,
  periodBarMax: 63, // barra do período com mais golos (4949:8559); as outras em proporção
  periodBarMin: 4,
  periodBarRadius: 4,
  periodBarGap: 6,
  periodColGap: 4,
  ptColGames: 30, // tabela de jogadores (4950:8409)
  ptColMinutes: 44,
  ptColGoals: 26,
  ptColAssists: 26,
  ptColRating: 40,
  ptRowPadY: 8,
  ptPhoto: 24,
  ptPhotoGap: 8,
  transferRowPadY: 10, // 4949:8618
  transferRowGap: 10,
  blockGap: 8, // espaço entre blocos das listas da equipa (4949:8351)
  statsBlockGap: 14, // Estatísticas (4949:8468)
  // V7.1 Jogador (42)
  playerHeaderPhoto: 84, // 4950:8502
  playerHeaderGap: 16,
  playerNameGap: 8, // número e nome
  playerTileGap: 8,
  playerTilePadY: 12, // mosaicos da época (4950:8510)
} as const;
