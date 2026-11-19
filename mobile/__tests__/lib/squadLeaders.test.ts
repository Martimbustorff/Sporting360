import { PlayerStatsDocSchema, type PlayerSeasonStats } from '@/data/schemas';
import { availableFilters, squadLeaders } from '@/lib/squadLeaders';

const lg = (appearances: number, minutes: number, goals: number, assists: number) => ({ appearances, minutes, goals, assists });
const p = (id: string, name: string, byLeague: PlayerSeasonStats['byLeague'], over: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats => {
  const all = Object.values(byLeague);
  const sum = (k: 'appearances' | 'minutes' | 'goals' | 'assists') => all.reduce((n, l) => n + l[k], 0);
  return {
    id, name, photo: null, appearances: sum('appearances'), minutes: sum('minutes'), goals: sum('goals'), assists: sum('assists'),
    rating: null, yellow: 0, red: 0, byLeague, ...over,
  };
};
const names = (r: ReturnType<typeof squadLeaders>) => [r.leader?.player.name, ...r.rest.map((x) => x.player.name)];

const gy = p('1', 'Gyökeres', { '94': lg(10, 800, 12, 2), '2': lg(4, 300, 4, 1) });
const tri = p('2', 'Trincão', { '94': lg(10, 700, 5, 5), '96': lg(2, 150, 1, 0) });
const pote = p('3', 'Pote', { '94': lg(10, 750, 5, 6) });

describe('squadLeaders', () => {
  it('"all" usa os totais e ordena pela métrica', () => {
    expect(names(squadLeaders([pote, tri, gy], 'all', 'goals'))).toEqual(['Gyökeres', 'Trincão', 'Pote']);
  });

  it('filtra por competição somando só os ids desse filtro', () => {
    const r = squadLeaders([gy, tri, pote], 'league', 'goals');
    expect(r.leader).toMatchObject({ value: 12, goals: 12, minutes: 800 });
    expect(squadLeaders([gy, tri, pote], 'champions', 'goals').leader?.value).toBe(4);
    expect(squadLeaders([gy, tri, pote], 'cups', 'goals').leader?.player.name).toBe('Trincão');
  });

  it('"ga" soma golos e assistências e "assists" ordena por assistências', () => {
    expect(squadLeaders([gy, tri, pote], 'all', 'ga').leader).toMatchObject({ player: { name: 'Gyökeres' }, value: 19 });
    expect(names(squadLeaders([gy, tri, pote], 'all', 'assists'))).toEqual(['Pote', 'Trincão', 'Gyökeres']);
  });

  it('empates: menos minutos primeiro, depois nome (colação pt), depois id', () => {
    const a = p('10', 'Ágata', { '94': lg(5, 400, 3, 0) });
    const b = p('11', 'Bruno', { '94': lg(5, 400, 3, 0) });
    const c = p('12', 'Zé', { '94': lg(5, 300, 3, 0) });
    const d = p('14', 'Zé', { '94': lg(5, 400, 3, 0) });
    const e = p('13', 'Zé', { '94': lg(5, 400, 3, 0) });
    const r = squadLeaders([d, b, e, a, c], 'league', 'goals');
    expect(r.rest.concat(r.leader!).map((x) => x.player.id).sort()).toHaveLength(5);
    expect([r.leader!, ...r.rest].map((x) => x.player.id)).toEqual(['12', '10', '11', '13', '14']);
  });

  it('exclui jogadores com 0 na métrica', () => {
    const none = p('20', 'Sem golos', { '94': lg(3, 200, 0, 2) });
    expect(names(squadLeaders([none, gy], 'league', 'goals'))).toEqual(['Gyökeres']);
    expect(squadLeaders([none], 'league', 'goals')).toEqual({ leader: null, rest: [] });
  });

  it('o líder traz minutos por golo (arredondado) e null sem golos', () => {
    expect(squadLeaders([gy], 'league', 'goals').leader?.minutesPerGoal).toBe(67);
    expect(squadLeaders([p('21', 'Pivô', { '94': lg(3, 200, 0, 4) })], 'league', 'assists').leader?.minutesPerGoal).toBeNull();
  });
});

describe('availableFilters', () => {
  it('esconde o chip de uma competição sem dados em nenhum jogador', () => {
    expect(availableFilters([pote])).toEqual(['all', 'league']);
    expect(availableFilters([gy, tri])).toEqual(['all', 'league', 'champions', 'cups']);
  });

  it('documento antigo sem byLeague: só "all" e os totais continuam a funcionar', () => {
    const doc = PlayerStatsDocSchema.parse({
      players: [{ id: '1', name: 'Velho', photo: null, appearances: 5, minutes: 400, goals: 4, assists: 1, rating: null, yellow: 0, red: 0 }],
    });
    expect(doc.players[0]!.byLeague).toEqual({});
    expect(availableFilters(doc.players)).toEqual(['all']);
    expect(squadLeaders(doc.players, 'all', 'goals').leader).toMatchObject({ value: 4, minutesPerGoal: 100 });
    expect(squadLeaders(doc.players, 'league', 'goals').leader).toBeNull();
  });

  it('nulos e lixo em byLeague caem para 0', () => {
    const doc = PlayerStatsDocSchema.parse({
      players: [{ id: '1', name: 'X', photo: null, appearances: 1, minutes: 90, goals: 1, assists: 0, rating: null, yellow: 0, red: 0, byLeague: { '94': { appearances: null, minutes: 'x', goals: 2 } } }],
    });
    expect(doc.players[0]!.byLeague['94']!).toMatchObject({ appearances: 0, minutes: 0, goals: 2, assists: 0 });
  });
});
