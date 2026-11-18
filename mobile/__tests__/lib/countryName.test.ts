import { countryNamePt, resetCountryNameCacheForTests } from '@/lib/countryName';

const CASES: [string, string][] = [
  ['Portugal', 'Portugal'],
  ['Spain', 'Espanha'],
  ['Brazil', 'Brasil'],
  ['England', 'Inglaterra'],
  ['France', 'França'],
  ['Argentina', 'Argentina'],
  ['Italy', 'Itália'],
  ['Germany', 'Alemanha'],
  ['Netherlands', 'Países Baixos'],
  ['Belgium', 'Bélgica'],
  ['Uruguay', 'Uruguai'],
  ['Colombia', 'Colômbia'],
  ['Croatia', 'Croácia'],
  ['Denmark', 'Dinamarca'],
  ['Sweden', 'Suécia'],
  ['Norway', 'Noruega'],
  ['Switzerland', 'Suíça'],
  ['Poland', 'Polónia'],
  ['Greece', 'Grécia'],
  ['Morocco', 'Marrocos'],
  ['USA', 'Estados Unidos'],
];

describe('countryNamePt', () => {
  afterEach(() => resetCountryNameCacheForTests());

  it.each(CASES)('%s com Intl.DisplayNames', (en, pt) => {
    expect(countryNamePt(en)).toBe(pt);
  });

  it.each(CASES)('%s sem Intl.DisplayNames (Hermes): o mapa', (en, pt) => {
    const intl = Intl as unknown as { DisplayNames?: unknown };
    const original = intl.DisplayNames;
    intl.DisplayNames = undefined;
    resetCountryNameCacheForTests();
    try {
      expect(countryNamePt(en)).toBe(pt);
    } finally {
      intl.DisplayNames = original;
    }
  });

  it('ignora maiúsculas e espaços', () => {
    expect(countryNamePt('  spain ')).toBe('Espanha');
  });

  it('desconhecido ou vazio: null (o ecrã esconde, nunca mostra inglês)', () => {
    expect(countryNamePt('Ivory Coast')).toBeNull();
    expect(countryNamePt('')).toBeNull();
    expect(countryNamePt(null)).toBeNull();
    expect(countryNamePt(undefined)).toBeNull();
  });
});
