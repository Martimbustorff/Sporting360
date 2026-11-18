// Paridade com o servidor: a app duplica a lógica de nomes públicos de functions/. Se um lado mudar sem o outro, falha aqui.
import { readFileSync } from 'fs';
import { join } from 'path';
import { mvpCandidates as serverMvpCandidates, type PlayerLine } from '../../../functions/src/game/mvp';
import { mvpCandidates as appMvpCandidates } from '@/lib/gameWindows';
import type { PlayersDoc } from '@/data/schemas';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Corpo completo (assinatura incluída) de `function <name>`, sem comentários nem espaços. */
function body(src: string, name: string): string {
  const start = src.search(new RegExp(`(export\\s+)?function\\s+${name}\\b`));
  if (start < 0) throw new Error(`function ${name} not found`);
  // Fim da lista de parâmetros (os tipos dos parâmetros podem ter chavetas), depois o `{` do corpo.
  let paren = 0;
  let i = src.indexOf('(', start);
  for (; i < src.length; i++) {
    if (src[i] === '(') paren++;
    else if (src[i] === ')' && --paren === 0) break;
  }
  let depth = 0;
  for (i = src.indexOf('{', i); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      return src
        .slice(start, i + 1)
        .replace(/^export\s+/, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s+/g, '');
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const mobile = readFileSync(join(__dirname, '..', '..', 'src', 'lib', 'publicName.ts'), 'utf8');
const profiles = read('functions/src/data/profiles.ts');
const validation = read('functions/src/callables/validation.ts');

describe('mobile/server parity (publicName, titleCasePt, derivedName, validateDisplayName, validAvatarId)', () => {
  it.each([
    ['publicName', profiles],
    ['titleCasePt', profiles],
    ['derivedName', profiles],
    ['validateDisplayName', validation],
    ['validAvatarId', validation],
  ])('%s is identical on both sides', (name, serverSrc) => {
    const a = body(mobile, name);
    const b = body(serverSrc, name);
    expect(a.length).toBeGreaterThan(40);
    expect(a).toBe(b);
  });
});

// Task 17 (carry da revisão da Task 16): a nota do prolongamento usa a mesma classificação de rondas que o quadro
// das eliminatórias no servidor (functions/src/football/bracket.ts, `stageOf`). Aspas normalizadas (o servidor usa ").
describe('mobile/server parity (stageOf)', () => {
  it('stageOf is identical on both sides', () => {
    const app = readFileSync(join(__dirname, '..', '..', 'src', 'lib', 'gameWindows.ts'), 'utf8');
    const server = read('functions/src/football/bracket.ts');
    const a = body(app, 'stageOf').replace(/"/g, "'");
    const b = body(server, 'stageOf').replace(/"/g, "'");
    expect(a.length).toBeGreaterThan(40);
    expect(a).toBe(b);
  });
});

// Candidatos a MVP: vetor de comportamento (as assinaturas diferem: o servidor recebe linhas planas, a app um
// PlayersDoc). `functions/src/game/mvp.ts` não tem imports, por isso corre aqui tal como está.
describe('mobile/server parity (mvpCandidates, linha duplicada)', () => {
  type Row = { playerId: string; name: string; minutes: number | null; sporting: boolean; number: number | null };
  const rows: Row[] = [
    { playerId: '10', name: 'Pote', minutes: 90, sporting: true, number: 8 },
    { playerId: '10', name: 'Pote (repetido)', minutes: 90, sporting: true, number: 99 },
    { playerId: '20', name: 'Ábel', minutes: 45, sporting: true, number: 4 },
    { playerId: '30', name: 'Banco', minutes: 0, sporting: true, number: 12 },
    { playerId: '40', name: 'Adversário', minutes: 90, sporting: false, number: 9 },
    { playerId: '20', name: 'Ábel', minutes: 45, sporting: true, number: 4 },
  ];
  const server: PlayerLine[] = rows.map((r) => ({
    playerId: r.playerId,
    name: r.name,
    teamIsSporting: r.sporting,
    minutes: r.minutes,
    rating: 7,
  }));
  const doc = (teamId: string, sporting: boolean): PlayersDoc['teams'][number] => ({
    teamId,
    players: rows
      .filter((r) => r.sporting === sporting)
      .map((r) => ({ playerId: r.playerId, name: r.name, minutes: r.minutes, number: r.number, photo: null, position: null, rating: 7 })),
  }) as PlayersDoc['teams'][number];
  const app: PlayersDoc = { teams: [doc('228', true), doc('217', false)] };

  it('a mesma linha duas vezes dá um só candidato, a primeira, nos dois lados', () => {
    const s = serverMvpCandidates(server).map((p) => [p.playerId, p.name]);
    const a = appMvpCandidates(app).map((p) => [p.playerId, p.name]);
    expect(s).toEqual([
      ['20', 'Ábel'],
      ['10', 'Pote'],
    ]);
    expect(a).toEqual(s);
  });
});
