import { colors, fonts } from '@/theme/tokens';
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
  textMuted: 'muted',
  textDisabled: 'disabled',
  cardYellow: 'yellow',
  cardYellowAlt: 'yellowAlt',
  cardRed: 'red',
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
    expect(ff.bodyMedium).toEqual([fonts.bodyMedium]);
    expect(ff.bodySemiBold).toEqual([fonts.bodySemiBold]);
  });

  it('FONT_ASSETS keys are exactly the token font names', () => {
    expect(Object.keys(FONT_ASSETS)).toEqual([
      'DinCondensedBold',
      'Poppins',
      'PoppinsMedium',
      'PoppinsSemiBold',
    ]);
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(fonts).sort());
  });
});

import { layout, radius } from '@/theme/tokens';

describe('component tokens from Figma 564:6950 / 564:7259', () => {
  it('button radius is fully round at button height', () => {
    expect(radius.button).toBeGreaterThanOrEqual(layout.buttonHeight / 2);
    expect(radius.button).toBe(52);
  });
  it('header row layout', () => {
    expect(layout.headerRowBottom).toBe(13);
    expect(layout.headerIcon).toBe(24);
    expect(layout.headerSideX).toBe(20);
  });
});
