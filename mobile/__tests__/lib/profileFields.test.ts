import {
  DEFAULT_NOTIFICATION_PREFS,
  diffForm,
  formFromUser,
  PROFILE_PATCH_KEYS,
  validMemberNumber,
  validMemberSince,
  validSeasonSeat,
} from '@/lib/profileFields';

const NOW = new Date('2026-11-18T12:00:00Z');

describe('validMemberSince', () => {
  it.each([['05/2008', true], ['01/1900', true], ['11/2026', true], ['13/2020', false], ['00/2020', false], ['5/2008', false], ['05/1899', false], ['05/2008 ', false], ['2008', false], ['12/2026', false], ['01/2027', false]])(
    '%s -> %s',
    (v, ok) => expect(validMemberSince(v, NOW)).toBe(ok),
  );
});

it('validMemberNumber: 1 a 10 algarismos', () => {
  expect(validMemberNumber('1')).toBe(true);
  expect(validMemberNumber('1234567890')).toBe(true);
  expect(validMemberNumber('12345678901')).toBe(false);
  expect(validMemberNumber('12a')).toBe(false);
  expect(validMemberNumber('')).toBe(false);
});

it('validSeasonSeat: até 60 caracteres', () => {
  expect(validSeasonSeat('a'.repeat(60))).toBe(true);
  expect(validSeasonSeat('a'.repeat(61))).toBe(false);
});

it('DEFAULT_NOTIFICATION_PREFS tem as cinco chaves ligadas', () => {
  expect(Object.values(DEFAULT_NOTIFICATION_PREFS)).toEqual([true, true, true, true, true]);
  expect(Object.keys(DEFAULT_NOTIFICATION_PREFS)).toHaveLength(5);
});

describe('diffForm', () => {
  const initial = formFromUser({ memberNumber: '123', partnerNumber: '2008', seasonSeat: 'A1', favoriteSport: 'futsal' });

  it('sem alterações o pedido é vazio', () => {
    expect(diffForm(initial, { ...initial }, NOW)).toEqual({ patch: {}, errors: {} });
  });

  it('só leva o que mudou, só com chaves permitidas', () => {
    const { patch } = diffForm(initial, { ...initial, seasonSeat: 'B2', favoriteSport: 'football' }, NOW);
    expect(patch).toEqual({ seasonSeat: 'B2', favoriteSport: 'football' });
    expect(Object.keys(patch).every((k) => (PROFILE_PATCH_KEYS as readonly string[]).includes(k))).toBe(true);
  });

  it('valor antigo fora do formato não bloqueia; se mudar, valida', () => {
    expect(diffForm(initial, { ...initial, seasonSeat: 'B2' }, NOW).errors).toEqual({});
    expect(diffForm(initial, { ...initial, partnerNumber: '13/2020' }, NOW).errors.partnerNumber).toBeTruthy();
    expect(diffForm(initial, { ...initial, partnerNumber: '05/2008' }, NOW).patch).toEqual({ partnerNumber: '05/2008' });
  });

  it('campo de texto limpo grava vazio', () => {
    expect(diffForm(initial, { ...initial, memberNumber: '  ' }, NOW).patch).toEqual({ memberNumber: '' });
  });

  it('jogador favorito novo grava id e nome', () => {
    const { patch } = diffForm(initial, { ...initial, favoritePlayer: { id: '9', name: 'Gyökeres' } }, NOW);
    expect(patch).toEqual({ favoritePlayer: { id: '9', name: 'Gyökeres' } });
  });
});
