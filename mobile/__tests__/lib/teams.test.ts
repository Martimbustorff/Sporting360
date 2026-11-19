import { shortClubName } from '@/lib/teams';

describe('shortClubName', () => {
  it('Sporting CP passa a Sporting; outros nomes ficam como estão', () => {
    expect(shortClubName('Sporting CP')).toBe('Sporting');
    expect(shortClubName('SC Braga')).toBe('SC Braga');
    expect(shortClubName('Sporting CP B')).toBe('Sporting B');
    expect(shortClubName('Real Sporting CPX')).toBe('Real Sporting CPX');
  });
});
