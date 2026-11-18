// Task 16: texto da contagem decrescente do prognóstico ("Fecha em ...").
import { countdownText } from '@/lib/countdown';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('countdownText', () => {
  it('dias e horas a partir de 1 dia', () => {
    expect(countdownText(2 * DAY + 3 * HOUR + 40 * MIN)).toBe('2 d 3 h');
    expect(countdownText(DAY)).toBe('1 d 0 h');
  });
  it('horas e minutos a partir de 1 hora', () => {
    expect(countdownText(2 * HOUR + 15 * MIN)).toBe('2 h 15 min');
    expect(countdownText(HOUR)).toBe('1 h 0 min');
  });
  it('só minutos a partir de 1 minuto', () => {
    expect(countdownText(15 * MIN + 59_000)).toBe('15 min');
    expect(countdownText(MIN)).toBe('1 min');
  });
  it('menos de 1 minuto', () => {
    expect(countdownText(30_000)).toBe('menos de 1 min');
    expect(countdownText(0)).toBe('menos de 1 min');
    expect(countdownText(-1)).toBe('menos de 1 min');
  });
});
