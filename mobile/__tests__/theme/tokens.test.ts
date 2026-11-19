import { colors, fonts, layout, radius, type } from '@/theme/tokens';
import { FONT_ASSETS } from '@/theme/fontAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tw = require('../../tailwind.config.js');

// tokens.colors key -> tailwind s360 key
const MAP: Record<string, string> = {
  bg: 'bg',
  bgHeader: 'header',
  surface10: 'surface10',
  surface20: 'surface20',
  divider: 'divider',
  primary: 'primary',
  white: 'white',
  black: 'black',
  positionCircle: 'positionCircle',
  positionSilver: 'positionSilver',
  positionBronze: 'positionBronze',
  textMuted: 'muted',
  textDisabled: 'disabled',
  cardYellow: 'yellow',
  cardYellowAlt: 'yellowAlt',
  cardRed: 'red',
  toggleOn: 'toggleOn',
  sheetCard: 'sheetCard',
  sheetLabel: 'sheetLabel',
  dotInactive: 'dotInactive',
  scrim: 'scrim',
  bgRaised: 'bgRaised',
  bgTint: 'bgTint',
  primaryOnDark: 'primaryOnDark',
  textSubtle: 'textSubtle',
  separator: 'separator',
  surface06: 'surface06',
  ink: 'ink',
  inkMuted: 'inkMuted',
  inkSeparator: 'inkSeparator',
  danger: 'danger',
  scrimV71: 'scrimV71',
  formLoss: 'formLoss',
  yellow71: 'yellow71',
  yellow71Bg: 'yellow71Bg',
  pitchField: 'pitchField',
};

describe('tokens <-> tailwind', () => {
  const s360 = tw.theme.extend.colors.s360 as Record<string, string>;

  it('maps every token colour', () => {
    expect(Object.keys(MAP).sort()).toEqual(Object.keys(colors).sort());
  });

  it.each(Object.entries(MAP))('%s -> s360.%s has the same value', (tokenKey, twKey) => {
    expect(s360[twKey]).toBe((colors as Record<string, string>)[tokenKey]);
  });

  it('has no legacy colours', () => {
    expect(Object.keys(tw.theme.extend.colors)).toEqual(['s360']);
  });

  it('font families match tokens', () => {
    const ff = tw.theme.extend.fontFamily;
    expect(ff.display).toEqual([fonts.display]);
    expect(ff.body).toEqual([fonts.body]);
    expect(ff.bodyLight).toEqual([fonts.bodyLight]);
    expect(ff.bodyMedium).toEqual([fonts.bodyMedium]);
    expect(ff.bodySemiBold).toEqual([fonts.bodySemiBold]);
  });

  it('FONT_ASSETS keys are exactly the token font names', () => {
    expect(Object.keys(FONT_ASSETS)).toEqual([
      'DinCondensed',
      'DinCondensedLight',
      'Din',
      'Poppins',
      'PoppinsLight',
      'PoppinsMedium',
      'PoppinsSemiBold',
    ]);
    expect(Object.keys(FONT_ASSETS).sort()).toEqual([...new Set(Object.values(fonts))].sort());
  });
});


describe('Poppins Light usage (Figma 564:6971 / 564:7169)', () => {
  it('authIntro and termsBody use Poppins Light', () => {
    expect(type.authIntro.fontFamily).toBe('PoppinsLight');
    expect(type.termsBody.fontFamily).toBe('PoppinsLight');
  });
});

describe('component tokens from Figma 564:6950 / 564:7259', () => {
  it('button radius is fully round at button height', () => {
    expect(radius.button).toBeGreaterThanOrEqual(layout.buttonHeight / 2);
    expect(radius.button).toBe(52);
  });
  it('header row layout', () => {
    expect(layout.headerRowBottom).toBe(13);
    expect(layout.headerIcon).toBe(24);
    expect(layout.headerSideX).toBe(20);
    expect(layout.statusBarHeight).toBe(44);
  });
  it('interaction tokens', () => {
    expect(layout.minTouch).toBe(44);
    expect(layout.tabUnderline).toBe(3);
    expect(layout.disabledOpacity).toBe(0.5);
    expect(layout.pressedOpacity).toBe(0.8);
  });
});

describe('component tokens from Figma 564:6907 / 564:6938 / 500:28814 / 500:28976', () => {
  it('text field', () => {
    expect(type.fieldPlaceholder.fontSize).toBe(18);
    expect(type.fieldLabel.fontSize).toBe(14);
    expect(type.fieldValue.fontSize).toBe(16);
    expect(type.fieldPlaceholder.fontFamily).toBe(fonts.display);
    expect(type.fieldValue.fontFamily).toBe(fonts.body);
    expect(layout.fieldLineWidth).toBe(1);
    expect(layout.fieldLineWidthActive).toBe(2);
    expect(layout.fieldLineOpacity).toBe(0.3);
    expect(layout.fieldLabelOpacity).toBe(0.5);
    expect(layout.fieldGapEmpty).toBe(13);
    expect(layout.fieldGapFilled).toBe(12);
    expect(radius.line).toBe(23);
  });
  it('tab underline ends', () => {
    expect(radius.hairline).toBe(1);
  });
});

describe('standings team name (Plan 5 Task 2)', () => {
  it('standingsTeam is 10 and tableTeam stays 12 for TeamRows', () => {
    expect(type.standingsTeam.fontSize).toBe(10);
    expect(type.standingsTeam.fontFamily).toBe(fonts.bodySemiBold);
    expect(type.tableTeam.fontSize).toBe(12);
  });
});
