import { relativeTime } from '@/lib/relativeTime';

const now = new Date('2026-11-17T12:00:00Z');
const rt = (iso: string) => relativeTime(new Date(iso), now);

describe('relativeTime', () => {
  it('menos de 1 minuto: agora', () => expect(rt('2026-11-17T11:59:30Z')).toBe('agora'));
  it('futuro próximo: agora', () => expect(rt('2026-11-17T12:00:30Z')).toBe('agora'));
  it('minutos', () => expect(rt('2026-11-17T11:55:00Z')).toBe('há 5 min'));
  it('1 hora', () => expect(rt('2026-11-17T11:00:00Z')).toBe('há 1 hora'));
  it('horas', () => expect(rt('2026-11-17T09:00:00Z')).toBe('há 3 horas'));
  it('ontem', () => expect(rt('2026-11-16T10:00:00Z')).toBe('ontem'));
  it('dias', () => expect(rt('2026-11-13T12:00:00Z')).toBe('há 4 dias'));
  it('7 dias ou mais: data curta pt-PT', () => expect(rt('2026-11-05T12:00:00Z')).toBe('5 nov.'));
  it('usa a tabela fixa de meses (R8)', () => expect(rt('2026-09-14T12:00:00Z')).toBe('14 set.'));
  it('data inválida devolve string vazia em vez de lançar', () => {
    expect(relativeTime(new Date('lixo'), now)).toBe('');
    expect(relativeTime(now, new Date('lixo'))).toBe('');
  });
});
