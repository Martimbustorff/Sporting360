import { formatMemberSince, memberYears, memberYearsText } from '@/lib/profileFields';

// 20/11/2026 ao meio-dia em Lisboa.
const NOW = new Date('2026-11-20T12:00:00Z');

describe('memberYears', () => {
  it('counts the year once the joining month has arrived', () => {
    expect(memberYears('11/1996', NOW)).toBe(30);
    expect(memberYears('05/2008', NOW)).toBe(18);
  });
  it('does not count the year before the joining month', () => {
    expect(memberYears('12/1996', NOW)).toBe(29);
  });
  it('accepts a year alone (old data) and loose spacing', () => {
    expect(memberYears('2000', NOW)).toBe(26);
    expect(memberYears(' 5 / 2008 ', NOW)).toBe(18);
    expect(memberYears('52008', NOW)).toBe(18); // V2 numérico: 52008 = 05/2008
  });
  it('returns null for unreadable or future dates', () => {
    expect(memberYears('abc', NOW)).toBeNull();
    expect(memberYears('13/2000', NOW)).toBeNull();
    expect(memberYears('12/2026', NOW)).toBeNull();
  });
  it('uses Lisbon time at the turn of the month', () => {
    // 31/10 23:30 UTC = 31/10 23:30 em Lisboa (hora de inverno), ainda outubro.
    expect(memberYears('11/2000', new Date('2026-10-31T23:30:00Z'))).toBe(25);
  });
});

describe('memberYearsText', () => {
  it('formats plural, singular and under one year', () => {
    expect(memberYearsText('11/1996', NOW)).toBe('30 anos de sócio');
    expect(memberYearsText('11/2025', NOW)).toBe('1 ano de sócio');
    expect(memberYearsText('11/2026', NOW)).toBe('Sócio há menos de 1 ano');
    expect(memberYearsText('xx', NOW)).toBeNull();
  });
});

describe('21/11: outros separadores e a máscara do campo', () => {
  it('aceita - . espaço e AAAA-MM', () => {
    expect(memberYears('05-2008', NOW)).toBe(18);
    expect(memberYears('05.2008', NOW)).toBe(18);
    expect(memberYears('05 2008', NOW)).toBe(18);
    expect(memberYears('2008-05', NOW)).toBe(18);
    expect(memberYears('2008/12', NOW)).toBe(17);
    expect(memberYears('13-2008', NOW)).toBeNull();
    expect(memberYears('abc', NOW)).toBeNull();
  });
  it('a máscara deixa só algarismos e põe a barra depois do mês', () => {
    expect(formatMemberSince('0')).toBe('0');
    expect(formatMemberSince('05')).toBe('05');
    expect(formatMemberSince('052')).toBe('05/2');
    expect(formatMemberSince('052008')).toBe('05/2008');
    expect(formatMemberSince('05/20089')).toBe('05/2008');
    expect(formatMemberSince('05-2008')).toBe('05/2008');
  });
});
