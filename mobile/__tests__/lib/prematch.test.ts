import { capacityText, formLetters, injuryText, isPrematchEmpty } from '@/lib/prematch';
import type { PrematchDoc } from '@/data/schemas';

describe('formLetters', () => {
  it('maps W/D/L to V/E/D', () => {
    expect(formLetters('WWDLW')).toEqual(['V', 'V', 'E', 'D', 'V']);
  });
  it('keeps only the last 5 and skips unknown letters', () => {
    expect(formLetters('LLLWWDLW')).toEqual(['W', 'W', 'D', 'L', 'W'].map((c) => ({ W: 'V', D: 'E', L: 'D' })[c]));
    expect(formLetters('W?D')).toEqual(['V', 'E']);
  });
  it('null or empty gives no letters', () => {
    expect(formLetters(null)).toEqual([]);
    expect(formLetters('')).toEqual([]);
  });
});

describe('injuryText', () => {
  it('type and reason in pt-PT', () => {
    expect(injuryText('Questionable', 'Knee Injury')).toBe('Dúvida, Lesão');
    expect(injuryText('Missing Fixture', 'Injury')).toBe('Fora, Lesão');
    expect(injuryText('Missing Fixture', 'Suspended')).toBe('Fora, Castigo');
    expect(injuryText('Missing Fixture', 'Red Card')).toBe('Fora, Castigo');
    expect(injuryText('Missing Fixture', 'Yellow Cards')).toBe('Fora, Castigo');
  });
  it('unknown values keep the original text; empty parts are dropped', () => {
    expect(injuryText('Missing Fixture', 'Illness')).toBe('Fora, Illness');
    expect(injuryText('Other', '')).toBe('Other');
    expect(injuryText('', 'Injury')).toBe('Lesão');
  });
});

describe('isPrematchEmpty', () => {
  it('true only for the { fetchedAt, empty: true } shape', () => {
    const empty = { fetchedAt: new Date(), empty: true } as PrematchDoc;
    const full = {
      fetchedAt: new Date(),
      advice: '',
      winner: null,
      percent: { home: 45, draw: 30, away: 25 },
      form: { home: '', away: '' },
      last5: { home: null, away: null },
      h2h: [],
    } as PrematchDoc;
    expect(isPrematchEmpty(empty)).toBe(true);
    expect(isPrematchEmpty(full)).toBe(false);
  });
});

describe('capacityText', () => {
  it('groups thousands with a space (pt-PT)', () => {
    expect(capacityText(50095)).toBe('50 095');
    expect(capacityText(1234567)).toBe('1 234 567');
    expect(capacityText(950)).toBe('950');
  });
});
