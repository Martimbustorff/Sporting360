// Task 14: funções puras da equipa e do jogador (lib/team).
import type { PlayerSeasonStats, SquadPlayer, TeamStatsDoc } from '@/data/schemas';
import {
  calendarDateText,
  groupSquad,
  orderCompetitions,
  playerPositionLabel,
  playerSeasonLine,
  playersByGoals,
  playersWithTrophies,
  positionLabel,
  seasonLabel,
  sidelinedPeriodText,
  teamStatsVM,
  transferTypeLabel,
  trophyPlaceText,
  unavailablePlayers,
} from '@/lib/team';

const p = (id: string, name: string, position: string | null, number: number | null): SquadPlayer => ({
  id,
  name,
  age: 25,
  number,
  position,
  photo: null,
});

describe('positionLabel', () => {
  it('as quatro posições da API em pt-PT; desconhecida vai para "Outros"', () => {
    expect(positionLabel('Goalkeeper')).toBe('Guarda-redes');
    expect(positionLabel('Defender')).toBe('Defesas');
    expect(positionLabel('Midfielder')).toBe('Médios');
    expect(positionLabel('Attacker')).toBe('Avançados');
    expect(positionLabel('Coach')).toBe('Outros');
  });
  it('no singular para o detalhe do jogador', () => {
    expect(playerPositionLabel('Goalkeeper')).toBe('Guarda-redes');
    expect(playerPositionLabel('Defender')).toBe('Defesa');
    expect(playerPositionLabel('Midfielder')).toBe('Médio');
    expect(playerPositionLabel('Attacker')).toBe('Avançado');
    expect(playerPositionLabel(null)).toBe('');
    // Desconhecida: não se mostra (nunca o texto inglês).
    expect(playerPositionLabel('Wingback')).toBe('');
  });
});

describe('groupSquad', () => {
  it('quatro posições pela ordem e, em cada uma, por número (sem número no fim)', () => {
    const groups = groupSquad([
      p('9', 'Avançado 9', 'Attacker', 9),
      p('3', 'Defesa 3', 'Defender', 3),
      p('50', 'Médio sem número', 'Midfielder', null),
      p('8', 'Médio 8', 'Midfielder', 8),
      p('1', 'Guarda-redes 1', 'Goalkeeper', 1),
      p('2', 'Defesa 2', 'Defender', 2),
      p('41', 'Guarda-redes 41', 'Goalkeeper', 41),
      p('17', 'Avançado 17', 'Attacker', 17),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Guarda-redes', 'Defesas', 'Médios', 'Avançados']);
    expect(groups.map((g) => g.players.map((x) => x.id))).toEqual([['1', '41'], ['2', '3'], ['8', '50'], ['9', '17']]);
  });
  it('grupos vazios não aparecem; posição desconhecida ou em falta vai para "Outros", no fim', () => {
    const groups = groupSquad([p('1', 'A', 'Attacker', 9), p('2', 'B', null, 4), p('3', 'C', 'Wingback', 2)]);
    expect(groups.map((g) => g.label)).toEqual(['Avançados', 'Outros']);
    expect(groups[1]?.players.map((x) => x.id)).toEqual(['3', '2']);
  });
});

describe('transferTypeLabel', () => {
  it('tipos da API em pt-PT; valores tal como vêm; N/A e null vazios', () => {
    expect(transferTypeLabel('Loan')).toBe('Empréstimo');
    expect(transferTypeLabel('Free')).toBe('Custo zero');
    expect(transferTypeLabel('N/A')).toBe('');
    expect(transferTypeLabel(null)).toBe('');
    expect(transferTypeLabel('€ 10M')).toBe('€ 10M');
    expect(transferTypeLabel('Transfer')).toBe('Transferência');
    expect(transferTypeLabel('Return from loan')).toBe('Regresso de empréstimo');
  });
});

describe('datas e épocas', () => {
  it('data civil "AAAA-MM-DD" em pt-PT; outro formato fica como vem', () => {
    expect(calendarDateText('2026-07-01')).toBe('1 Jul 2026');
    expect(calendarDateText('2025-12-31T00:00:00+00:00')).toBe('31 Dez 2025');
    expect(calendarDateText('ontem')).toBe('ontem');
  });
  it('época de futebol "2026" → "2026/27"', () => {
    expect(seasonLabel('2026')).toBe('2026/27');
    expect(seasonLabel('1999')).toBe('1999/00');
  });
});

describe('lesões', () => {
  it('período: com fim "a"; sem fim "em curso"', () => {
    expect(sidelinedPeriodText({ type: 'Knee Injury', start: '2026-03-15', end: '2026-04-02' })).toBe('15 Mar 2026 a 2 Abr 2026');
    expect(sidelinedPeriodText({ type: 'Knee Injury', start: '2026-10-20', end: null })).toBe('Desde 20 Out 2026, em curso');
  });
  it('indisponíveis: um por jogador (o documento repete por jogo), pela ordem de chegada', () => {
    const item = (playerId: string, name: string, fixtureId: string) => ({
      playerId,
      name,
      photo: null,
      type: 'Missing Fixture',
      reason: 'Knee Injury',
      fixtureId,
      date: null,
    });
    const out = unavailablePlayers({ items: [item('5', 'A', '1'), item('7', 'B', '1'), item('5', 'A', '2')] });
    expect(out.map((i) => i.playerId)).toEqual(['5', '7']);
  });
});

describe('troféus', () => {
  it('lugar em pt-PT', () => {
    expect(trophyPlaceText('Winner')).toBe('Vencedor');
    expect(trophyPlaceText('2nd Place')).toBe('2.º lugar');
    expect(trophyPlaceText('Runner-up')).toBe('Finalista');
    expect(trophyPlaceText('Semi-finals')).toBe('Semi-finals');
  });
  it('jogadores do plantel com troféus, mais troféus primeiro e depois pelo nome', () => {
    const squad = { players: [p('1', 'Zé', 'Attacker', 9), p('2', 'Ana', 'Defender', 2), p('3', 'Rui', 'Defender', 3)] };
    const t = { league: 'Primeira Liga', country: 'Portugal', season: '2023/2024', place: 'Winner' };
    const out = playersWithTrophies(squad, { byPlayer: { '1': [t], '2': [t], '3': [], '99': [t, t] }, coach: [] });
    expect(out.map((x) => [x.player.id, x.count])).toEqual([['2', 1], ['1', 1]]);
  });
});

const line = (id: string, name: string, over: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats => ({
  id,
  name,
  photo: null,
  appearances: 10,
  minutes: 800,
  goals: 0,
  assists: 0,
  rating: 7,
  yellow: 0,
  red: 0,
  byLeague: {},
  ...over,
});

describe('estatísticas de jogadores', () => {
  it('por golos, depois assistências e minutos; sem jogos ficam de fora', () => {
    const out = playersByGoals({
      players: [
        line('1', 'A', { goals: 2, assists: 1 }),
        line('2', 'B', { goals: 5 }),
        line('3', 'C', { goals: 2, assists: 3 }),
        line('4', 'D', { appearances: 0, minutes: 0 }),
      ],
    });
    expect(out.map((x) => x.id)).toEqual(['2', '3', '1']);
  });
  it('linha do jogador: null sem documento, sem linha ou sem jogos', () => {
    const doc = { players: [line('1', 'A'), line('2', 'B', { appearances: 0 })] };
    expect(playerSeasonLine(doc, '1')?.name).toBe('A');
    expect(playerSeasonLine(doc, '2')).toBeNull();
    expect(playerSeasonLine(doc, '3')).toBeNull();
    expect(playerSeasonLine(null, '1')).toBeNull();
  });
});

describe('orderCompetitions', () => {
  it('liga, taças, europeias e depois pelo nome', () => {
    const c = (key: string, name: string, type: 'league' | 'cup' | 'supercup' | 'europe') => ({ key, leagueId: key, name, type });
    const out = orderCompetitions([
      c('2', 'Liga dos Campeões', 'europe'),
      c('97', 'Taça da Liga', 'cup'),
      c('550', 'Supertaça', 'supercup'),
      c('96', 'Taça de Portugal', 'cup'),
      c('94', 'Liga Portugal', 'league'),
    ]);
    expect(out.map((x) => x.key)).toEqual(['94', '550', '97', '96', '2']);
  });
});

describe('teamStatsVM', () => {
  const split = (home: number, away: number) => ({ home, away, total: home + away });
  const minute = (vals: number[]) =>
    Object.fromEntries(
      ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90', '91-105', '106-120'].map((k, i) => [
        k,
        { total: vals[i] ?? 0, percentage: null },
      ]),
    );
  const doc: TeamStatsDoc = {
    form: 'WWDLW',
    goals: {
      for: { total: split(12, 8), minute: minute([1, 2, 3, 4, 5, 5, 9]) },
      against: { total: split(3, 4), minute: minute([0, 1, 1, 2, 2, 1]) },
    },
    fixtures: { played: split(6, 5), wins: split(5, 3), draws: split(1, 1), loses: split(0, 1) },
    cleanSheet: split(3, 2),
    failedToScore: split(0, 1),
  };

  it('forma, golos em casa e fora, períodos até 76-90 e jogos sem sofrer', () => {
    const vm = teamStatsVM(doc);
    expect(vm.form).toEqual(['V', 'V', 'E', 'D', 'V']);
    expect(vm.goalsFor).toEqual({ home: 12, away: 8, total: 20 });
    expect(vm.goalsAgainst).toEqual({ home: 3, away: 4, total: 7 });
    expect(vm.cleanSheet).toEqual({ home: 3, away: 2, total: 5 });
    expect(vm.periods).toEqual([
      { label: '0-15', for: 1, against: 0 },
      { label: '16-30', for: 2, against: 1 },
      { label: '31-45', for: 3, against: 1 },
      { label: '46-60', for: 4, against: 2 },
      { label: '61-75', for: 5, against: 2 },
      { label: '76-90', for: 5, against: 1 },
    ]);
    expect(vm.empty).toBe(false);
  });

  it('formas inesperadas da API não rebentam: ficam a null ou vazias', () => {
    const vm = teamStatsVM({
      form: null,
      goals: { for: { total: 'x', minute: {} }, against: { total: null, minute: {} } },
      fixtures: null,
      cleanSheet: { home: 'a' },
      failedToScore: undefined,
    });
    expect(vm).toEqual({ form: [], goalsFor: null, goalsAgainst: null, cleanSheet: null, periods: [], empty: true });
  });
});
