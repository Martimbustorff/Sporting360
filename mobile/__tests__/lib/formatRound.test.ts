import { formatRound } from '@/lib/formatRound';

describe('formatRound', () => {
  it.each([
    ['Regular Season - 11', 'J11'],
    ['J11', 'J11'],
    ['11', 'J11'],
    ['League Stage - 3', 'Fase de liga, J3'],
    ['League Phase - 3', 'Fase de liga, J3'],
    ['Group Stage - 2', 'Fase de grupos, J2'],
    ['Group A - 2', 'Fase de grupos, J2'],
    ['Round of 32', '16 avos de final'],
    ['Round of 16', 'Oitavos de final'],
    ['8th Finals', 'Oitavos de final'],
    ['Quarter-finals', 'Quartos de final'],
    ['Semi-finals', 'Meias-finais'],
    ['Final', 'Final'],
    ['1st Round', '1.ª eliminatória'],
    ['2nd Round', '2.ª eliminatória'],
    ['3rd Round', '3.ª eliminatória'],
    ['4th Round', '4.ª eliminatória'],
    ['Play-offs', 'Play-off'],
    ['Knockout Round Play-offs', 'Play-off'],
    ['Qualifying Round', 'Pré-eliminatória'],
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['Algo desconhecido', 'Algo desconhecido'],
  ])('%s -> %s', (input, out) => {
    expect(formatRound(input)).toBe(out);
  });

  it('is idempotent', () => {
    expect(formatRound(formatRound('Round of 16'))).toBe('Oitavos de final');
    expect(formatRound(formatRound('League Stage - 5'))).toBe('Fase de liga, J5');
    expect(formatRound(formatRound('Regular Season - 11'))).toBe('J11');
  });

  it('passes backend-stored pt-PT text (comma separator) through unchanged', () => {
    expect(formatRound('Fase de liga, J3')).toBe('Fase de liga, J3');
    expect(formatRound('Fase de grupos, J2')).toBe('Fase de grupos, J2');
  });

  it('never leaks English or a J prefix on text rounds', () => {
    expect(formatRound('Round of 32')).not.toContain('Round');
    expect(formatRound('Round of 32')).not.toMatch(/^J/);
    expect(formatRound('Round of 32')).not.toContain('·');
  });
});
