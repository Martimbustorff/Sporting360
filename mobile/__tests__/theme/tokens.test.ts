import { colors, fonts, layout, radius, type } from '@/theme/tokens';
import { FONT_ASSETS } from '@/theme/fontAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tw = require('../../tailwind.config.js');

// tokens.colors key -> tailwind s360 key
const MAP: Record<string, string> = {
  bg: 'bg',
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
  bgRaised: 'bgRaised',
  bgTint: 'bgTint',
  homeVeil: 'homeVeil',
  primaryOnDark: 'primaryOnDark',
  primaryTint: 'primaryTint',
  primaryDeep: 'primaryDeep',
  textSubtle: 'textSubtle',
  separator: 'separator',
  surface06: 'surface06',
  ink: 'ink',
  inkMuted: 'inkMuted',
  inkSeparator: 'inkSeparator',
  danger: 'danger',
  scrimV71: 'scrimV71',
  stadiumSector: 'stadiumSector',
  formLoss: 'formLoss',
  yellow71: 'yellow71',
  yellow71Bg: 'yellow71Bg',
  injuryBg: 'injuryBg',
  goalOverlay: 'goalOverlay',
  pitchField: 'pitchField',
  zoneChampions: 'zoneChampions',
  zoneEurope: 'zoneEurope',
  zoneConference: 'zoneConference',
  shareCardTop: 'shareCardTop',
  shareCardRule: 'shareCardRule',
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
      'PoppinsLightItalic',
      'PoppinsMedium',
      'PoppinsSemiBold',
    ]);
    expect(Object.keys(FONT_ASSETS).sort()).toEqual([...new Set(Object.values(fonts))].sort());
  });
});


describe('Poppins Light usage (Figma 564:6971 / 564:7169)', () => {
  it('authIntro uses Poppins Light', () => {
    expect(type.authIntro.fontFamily).toBe('PoppinsLight');
  });
});

describe('component tokens from Figma 564:6950 / 564:7259', () => {
  it('button radius is fully round at button height', () => {
    expect(radius.button).toBeGreaterThanOrEqual(layout.buttonHeight / 2);
    expect(radius.button).toBe(52);
  });
  it('header row layout', () => {
    expect(layout.headerIcon).toBe(24);
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
    expect(layout.fieldLineWidth).toBe(1);
    expect(layout.fieldLineWidthActive).toBe(2);
    expect(radius.line).toBe(23);
  });
});

describe('standings team name (Plan 5 Task 2)', () => {
  it('standingsTeam is 10 and tableTeam stays 12 for TeamRows', () => {
    expect(type.standingsTeam.fontSize).toBe(10);
    expect(type.standingsTeam.fontFamily).toBe(fonts.bodySemiBold);
    expect(type.tableTeam.fontSize).toBe(12);
  });
});
