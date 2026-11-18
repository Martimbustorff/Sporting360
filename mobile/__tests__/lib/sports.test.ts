import { SPORTS, sportLabel } from '@/lib/sports';

describe('sports', () => {
  it('lists the six sports in order with pt-PT labels', () => {
    expect(SPORTS.map((s) => s.label)).toEqual([
      'Futebol',
      'Futsal',
      'Andebol',
      'Hóquei em patins',
      'Voleibol',
      'Basquetebol',
    ]);
    expect(SPORTS.map((s) => s.key)).toEqual([
      'football',
      'futsal',
      'handball',
      'roller_hockey',
      'volleyball',
      'basketball',
    ]);
  });

  it('sportLabel', () => {
    expect(sportLabel('roller_hockey')).toBe('Hóquei em patins');
    expect(sportLabel('football')).toBe('Futebol');
  });
});
