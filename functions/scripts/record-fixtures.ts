/* eslint-disable no-console */
// Grava respostas reais da API-Football (e VSports) para test/fixtures/**/real/.
// Ferramenta manual: lê as chaves SÓ de variáveis de ambiente, nunca de ficheiros, e nunca grava
// cabeçalhos nem chaves nas fixtures (guarda o corpo da resposta, depois de limpo).
//
//   RAPIDAPI_KEY=... npx tsx scripts/record-fixtures.ts --fixture 1500003
import * as fs from "fs";
import * as path from "path";
import { getJson } from "../src/sources/http";

const HELP = `Uso: npx tsx scripts/record-fixtures.ts --fixture <id> [opções]

Grava uma resposta por fixture listada na Task 2 para um jogo indicado, em
test/fixtures/api-football/real/ (e vsports/real/ se VSPORTS_KEY existir).

Obrigatório
  --fixture <id>     id do jogo na API-Football

Opções
  --team <id>        equipa (por omissão 228)
  --league <id>      liga (por omissão 94)
  --season <ano>     época (por omissão 2026)
  --player <id>      jogador para trophies/sidelined (opcional)
  --coach <id>       treinador para trophies (opcional)
  --venue <id>       recinto (opcional; por omissão o do jogo)
  --vsports-cp <id>  competição VSports para as jornadas (opcional)
  --vsports-season <n>  id de época VSports (por omissão 30 + anoInício - 2025)
  --out <dir>        raiz de destino (por omissão test/fixtures)
  --help             mostra esta ajuda e sai (não faz chamadas)

Ambiente (lido em runtime, nunca de ficheiro)
  RAPIDAPI_KEY       chave RapidAPI da API-Football (obrigatória)
  VSPORTS_KEY        chave da VSports (opcional)

O estado do jogo decide o nome do ficheiro do jogo (ns, live-1h, ht, live-2h, et, p, pen, ft, pst):
corre o script várias vezes ao longo de um jogo para apanhar cada estado.
Cada pedido gasta 1 chamada da quota diária.`;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const STATUS_FILE: Record<string, string> = {
  NS: "fixture-ns", TBD: "fixture-ns", "1H": "fixture-live-1h", HT: "fixture-ht", "2H": "fixture-live-2h",
  ET: "fixture-et", BT: "fixture-et", P: "fixture-p", PEN: "fixture-pen", FT: "fixture-ft", AET: "fixture-ft", PST: "fixture-pst",
};

const SECRET_KEY = /(^|[_-])(key|token|secret|password|authorization|bearer)([_-]|$)/i;

/** Remove recursivamente quaisquer campos cuja chave pareça uma credencial. */
function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      // Credenciais são texto; números como passes.key (passes decisivos) são dados legítimos.
      if (SECRET_KEY.test(k) && typeof val === "string") continue;
      out[k] = scrub(val);
    }
    return out;
  }
  return v;
}

function main(): Promise<void> {
  const fixtureId = opt("fixture");
  if (!fixtureId) {
    console.error("Falta --fixture <id>. Usa --help.");
    process.exit(2);
  }
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (!rapidKey) {
    console.error("RAPIDAPI_KEY não definida no ambiente.");
    process.exit(2);
  }
  const vsportsKey = process.env.VSPORTS_KEY;
  const secrets = [rapidKey, vsportsKey].filter((s): s is string => !!s);
  const team = opt("team") ?? "228";
  const league = opt("league") ?? "94";
  const season = opt("season") ?? "2026";
  const root = path.resolve(opt("out") ?? path.join(__dirname, "..", "test", "fixtures"));

  const save = (sub: string, name: string, body: unknown): void => {
    const text = JSON.stringify(scrub(body), null, 2) + "\n";
    for (const s of secrets) {
      if (text.includes(s)) throw new Error(`recusado: a resposta de ${name} contém uma credencial`);
    }
    const dir = path.join(root, sub, "real");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), text);
    console.log(`gravado ${sub}/real/${name}.json`);
  };

  const host = "api-football-v1.p.rapidapi.com";
  const af = async (p: string): Promise<{ response?: unknown }> => {
    // Os cabeçalhos só existem em memória, para o pedido.
    const { body } = await getJson<{ response?: unknown }>(fetch, `https://${host}/v3/${p}`, {
      source: "record-fixtures",
      headers: { "X-RapidAPI-Key": rapidKey, "X-RapidAPI-Host": host },
      timeoutMs: 20_000,
    });
    return body;
  };

  return (async () => {
    const game = await af(`fixtures?ids=${fixtureId}`);
    const first = (game.response as Array<{ fixture: { status: { short: string }; venue: { id: number | null } } }>)?.[0];
    const status = first?.fixture.status.short ?? "NS";
    save("api-football", STATUS_FILE[status] ?? "fixture-other", game);

    const jobs: Array<[string, string]> = [
      ["fixtures-team-season", `fixtures?team=${team}&season=${season}`],
      ["fixtures-league", `fixtures?league=${league}&season=${season}`],
      ["standings-94", `standings?league=${league}&season=${season}`],
      ["rounds-94", `fixtures/rounds?league=${league}&season=${season}`],
      ["topscorers-94", `players/topscorers?league=${league}&season=${season}`],
      ["squad-228", `players/squads?team=${team}`],
      ["coachs-228", `coachs?team=${team}`],
      ["players-228-p1", `players?team=${team}&season=${season}&page=1`],
      ["players-228-p2", `players?team=${team}&season=${season}&page=2`],
      ["team-stats-94", `teams/statistics?league=${league}&season=${season}&team=${team}`],
      ["injuries-team", `injuries?team=${team}&season=${season}`],
      ["injuries-fixture", `injuries?fixture=${fixtureId}`],
      ["predictions", `predictions?fixture=${fixtureId}`],
      ["transfers-228", `transfers?team=${team}`],
    ];
    const venue = opt("venue") ?? (first?.fixture.venue.id ? String(first.fixture.venue.id) : undefined);
    if (venue) jobs.push(["venue", `venues?id=${venue}`]);
    const player = opt("player");
    if (player) {
      jobs.push(["trophies", `trophies?players=${player}`]);
      jobs.push(["sidelined", `sidelined?players=${player}`]);
    } else if (opt("coach")) {
      jobs.push(["trophies", `trophies?coach=${opt("coach")}`]);
    }
    for (const [name, p] of jobs) save("api-football", name, await af(p));

    if (vsportsKey) {
      const cp = opt("vsports-cp");
      if (cp) {
        const now = new Date();
        const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
        const ep = opt("vsports-season") ?? String(30 + (startYear - 2025));
        const { body } = await getJson<unknown>(fetch, `https://apism.vsports.pt/pesquisa-sec?scp&cp=${cp}&ep=${ep}&lst=match&pp=0&vp=310&eq=6`, {
          source: "record-fixtures",
          headers: { KEY: vsportsKey },
          timeoutMs: 20_000,
        });
        save("vsports", "rounds-1", body);
      }
    } else {
      console.log("VSPORTS_KEY não definida: salto a VSports.");
    }
  })();
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
