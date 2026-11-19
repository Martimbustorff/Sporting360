import { formatCardDate, formatDayMonth, formatKickoffDate, formatTime } from '@/lib/ptDate';

describe('ptDate', () => {
  it('formats the hour in Europe/Lisbon (summer, UTC+1)', () => {
    expect(formatTime(new Date('2026-09-14T19:30:00Z'))).toBe('20:30');
  });
  it('formats the hour in Europe/Lisbon (winter, UTC+0)', () => {
    expect(formatTime(new Date('2026-12-14T19:30:00Z'))).toBe('19:30');
  });
  it('uses the Lisbon calendar day around midnight', () => {
    expect(formatTime(new Date('2026-09-14T23:30:00Z'))).toBe('00:30');
    expect(formatKickoffDate(new Date('2026-09-14T23:30:00Z'), new Date('2026-09-01T10:00:00Z'))).toBe('15 Set');
  });
  it('same week as now: weekday and day', () => {
    // 13 Sep 2026 is a Sunday; Monday 7 Sep to Sunday 13 Sep is one week
    expect(formatKickoffDate(new Date('2026-09-13T19:30:00Z'), new Date('2026-09-09T10:00:00Z'))).toBe('Domingo, 13');
  });
  it('other week: short date with fixed month table', () => {
    expect(formatKickoffDate(new Date('2026-09-14T19:30:00Z'), new Date('2026-09-09T10:00:00Z'))).toBe('14 Set');
    expect(formatKickoffDate(new Date('2026-11-05T19:30:00Z'), new Date('2026-11-17T10:00:00Z'))).toBe('5 Nov');
  });
  // Task 18 (carry da revisão da Task 17): data absoluta para o cartão partilhado, nunca relativa à semana.
  it('formatDayMonth: dia e mês por extenso, em minúsculas, no fuso de Lisboa', () => {
    expect(formatDayMonth(new Date('2027-04-16T19:15:00Z'))).toBe('16 abril');
    expect(formatDayMonth(new Date('2026-09-14T23:30:00Z'))).toBe('15 setembro');
    expect(formatDayMonth(new Date('2026-03-01T00:30:00Z'))).toBe('1 março');
  });
});

describe('formatCardDate', () => {
  it('dia da semana, dia e mês abreviados em maiúsculas, no dia civil de Lisboa', () => {
    expect(formatCardDate(new Date('2026-12-21T18:00:00Z'))).toBe('SEG 21 DEZ');
    expect(formatCardDate(new Date('2026-12-26T18:00:00Z'))).toBe('SÁB 26 DEZ');
    // 23:30 UTC no verão já é o dia seguinte em Lisboa
    expect(formatCardDate(new Date('2026-07-14T23:30:00Z'))).toBe('QUA 15 JUL');
  });
});
