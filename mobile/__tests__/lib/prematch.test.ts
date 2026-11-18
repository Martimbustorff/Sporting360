import { capacityText, formLetters, injuryReasonText, injuryText, isPrematchEmpty } from '@/lib/prematch';
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

describe('injuryReasonText', () => {
  it('body parts in pt-PT (hamstring before the generic muscle)', () => {
    expect(injuryReasonText('Hamstring Injury')).toBe('Lesão nos isquiotibiais');
    expect(injuryReasonText('Knee Injury')).toBe('Lesão no joelho');
    expect(injuryReasonText('Ankle Injury')).toBe('Lesão no tornozelo');
    expect(injuryReasonText('Muscle Injury')).toBe('Lesão muscular');
    expect(injuryReasonText('Groin Strain')).toBe('Lesão na virilha');
    expect(injuryReasonText('Calf Injury')).toBe('Lesão na barriga da perna');
    expect(injuryReasonText('Back Injury')).toBe('Lesão nas costas');
    expect(injuryReasonText('Illness')).toBe('Doença');
  });
  it('bans are "Castigo"', () => {
    for (const r of ['Suspended', 'Red Card', 'Yellow Cards']) expect(injuryReasonText(r)).toBe('Castigo');
  });
  it('unknown or generic reasons are "Lesão", never the English text', () => {
    expect(injuryReasonText('Injury')).toBe('Lesão');
    expect(injuryReasonText('Broken nose')).toBe('Lesão');
    expect(injuryReasonText('Unknown')).toBe('Lesão');
  });
});

describe('injuryText', () => {
  it('type and reason in pt-PT', () => {
    expect(injuryText('Questionable', 'Knee Injury')).toBe('Dúvida, Lesão no joelho');
    expect(injuryText('Missing Fixture', 'Injury')).toBe('Fora, Lesão');
    expect(injuryText('Missing Fixture', 'Suspended')).toBe('Fora, Castigo');
    expect(injuryText('Missing Fixture', 'Red Card')).toBe('Fora, Castigo');
    expect(injuryText('Missing Fixture', 'Yellow Cards')).toBe('Fora, Castigo');
  });
  it('unknown type keeps the original text; unknown reason is "Lesão"; empty parts are dropped', () => {
    expect(injuryText('Missing Fixture', 'Illness')).toBe('Fora, Doença');
    expect(injuryText('Missing Fixture', 'Broken nose')).toBe('Fora, Lesão');
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
