import { colors, fonts, radii, space, text71 } from '@/theme/tokens';
import { FONT_ASSETS } from '@/theme/fontAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tw = require('../../tailwind.config.js');

describe('V7.1 tokens', () => {
  it('colours', () => {
    expect(colors.bg).toBe('#001B13');
    expect(colors.bgRaised).toBe('#06261C');
    expect(colors.bgTint).toBe('#003625');
    expect(colors.primary).toBe('#00835B');
    expect(colors.primaryOnDark).toBe('#19B37E');
    expect(colors.textMuted).toBe('rgba(255, 255, 255, 0.7)');
    expect(colors.textSubtle).toBe('rgba(255, 255, 255, 0.5)');
    expect(colors.separator).toBe('rgba(255, 255, 255, 0.25)');
    expect(colors.surface06).toBe('rgba(255, 255, 255, 0.06)');
    expect(colors.surface10).toBe('rgba(255, 255, 255, 0.1)');
    expect(colors.surface20).toBe('rgba(255, 255, 255, 0.2)');
    expect(colors.ink).toBe('#001B13');
    expect(colors.inkMuted).toBe('rgba(0, 27, 19, 0.65)');
    expect(colors.inkSeparator).toBe('rgba(0, 27, 19, 0.12)');
    expect(colors.danger).toBe('#F74C66');
    expect(colors.scrimV71).toBe('rgba(0, 13, 9, 0.72)');
  });

  it('space and radii', () => {
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
    expect(Object.values(radii)).toEqual([8, 12, 16, 28]);
  });

  it('fonts', () => {
    expect(fonts.display).toBe(fonts.dinCondensed);
    expect(Object.keys(FONT_ASSETS)).toEqual(
      expect.arrayContaining(['DinCondensed', 'DinCondensedLight', 'Din']),
    );
    expect(Object.keys(FONT_ASSETS).some((k) => /barlow/i.test(k))).toBe(false);
    expect(FONT_ASSETS).not.toHaveProperty('DinCondensedBold');
  });

  it('text71 has the 14 styles plus the card countdown and the share-card brand', () => {
    expect(Object.keys(text71).sort()).toEqual(
      ['score72', 'display40', 'titleL28', 'title24', 'titleS20', 'label16', 'eyebrow13', 'menu15', 'badge11', 'body14', 'bodyLight14', 'strong14', 'caption12', 'captionStrong12', 'countdown40', 'body16', 'body18', 'brand48', 'matchLight28', 'score56', 'goal120'].sort(),
    );
  });

  it('label16 matches the spec', () => {
    expect(text71.label16).toMatchObject({
      fontFamily: fonts.dinCondensed,
      fontSize: 16,
      lineHeight: 17.6,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    });
  });

  it('spec values for the other styles', () => {
    expect(text71.score72).toMatchObject({ fontFamily: fonts.dinCondensed, fontSize: 72, lineHeight: 72, textTransform: 'uppercase' });
    expect(text71.display40).toMatchObject({ fontSize: 40, lineHeight: 40 });
    expect(text71.titleL28).toMatchObject({ fontSize: 28, lineHeight: 30.8 });
    expect(text71.title24).toMatchObject({ fontSize: 24, lineHeight: 26.4, letterSpacing: 0.2 });
    expect(text71.titleS20).toMatchObject({ fontSize: 20, lineHeight: 22, letterSpacing: 0.2 });
    expect(text71.eyebrow13).toMatchObject({ fontSize: 13, lineHeight: 15.6, letterSpacing: 0.8 });
    expect(text71.menu15).toMatchObject({ fontFamily: fonts.din, fontSize: 15, lineHeight: 18, letterSpacing: 0.6, textTransform: 'uppercase' });
    expect(text71.badge11).toMatchObject({ fontFamily: fonts.din, fontSize: 11, lineHeight: 13.2, letterSpacing: 0.6 });
    expect(text71.body14).toMatchObject({ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textTransform: 'none' });
    expect(text71.bodyLight14).toMatchObject({ fontFamily: fonts.bodyLight, lineHeight: 21.7, letterSpacing: 0.2 });
    expect(text71.strong14).toMatchObject({ fontFamily: fonts.bodyMedium, lineHeight: 19.6 });
    expect(text71.caption12).toMatchObject({ fontFamily: fonts.body, fontSize: 12, lineHeight: 16.8 });
    expect(text71.captionStrong12).toMatchObject({ fontFamily: fonts.bodySemiBold, lineHeight: 16.8 });
  });

  it('tailwind carries the new colours and fonts', () => {
    const s360 = tw.theme.extend.colors.s360;
    expect(s360.primaryOnDark).toBe(colors.primaryOnDark);
    expect(s360.bgRaised).toBe(colors.bgRaised);
    const ff = tw.theme.extend.fontFamily;
    expect(ff.dinCondensed).toEqual([fonts.dinCondensed]);
    expect(ff.din).toEqual([fonts.din]);
  });
});
