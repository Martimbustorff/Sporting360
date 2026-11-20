import { shortClubName } from '@/lib/teams';

describe('shortClubName', () => {
  it('Sporting CP passa a Sporting; outros nomes ficam como estão', () => {
    expect(shortClubName('Sporting CP')).toBe('Sporting');
    expect(shortClubName('SC Braga')).toBe('SC Braga');
    expect(shortClubName('Sporting CP B')).toBe('Sporting B');
    expect(shortClubName('Real Sporting CPX')).toBe('Real Sporting CPX');
  });
});

describe('teamInitials (emblema de recurso das modalidades)', () => {
  const { teamInitials } = require('@/lib/teams') as typeof import('@/lib/teams');
  it.each([
    ['AD Fundão', 'FU'],
    ['SC Ferreira do Zêzere', 'FZ'],
    ['J. Pacense / Des Compagnons', 'JP'],
    ['Riba d’Ave HC', 'RA'],
    ['Benfica', 'BE'],
    ['OC Barcelos', 'BA'],
    ['TFK Beltar', 'TB'],
    ['SCT / UP Tomar', 'SC'],
  ])('%s → %s', (name, out) => {
    expect(teamInitials(name)).toBe(out);
  });
});
