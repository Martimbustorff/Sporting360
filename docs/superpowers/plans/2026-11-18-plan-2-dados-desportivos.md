# Plano 2: Dados desportivos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer para o codebase `v2027` (Admin SDK, europe-west1, Node 22) toda a ingestão de dados que hoje corre nas functions antigas com o SDK cliente sem sessão, escrevendo ao mesmo tempo as coleções antigas (para a app V2 continuar igual até ao corte) e o modelo novo multi-modalidade, e depois publicar com o OK do Martim: functions novas, apagar as antigas, regras fase 1 e o motor do Plano 1.

**Architecture:** Cada fonte (API-Football, API-Sports andebol/voleibol/basquetebol, fontes gratuitas de futsal e hóquei, VSports, RSS, Twitter/X) tem um cliente fino com `fetch` injetável. Funções puras mapeiam cada resposta para dois resultados: o modelo novo (`matches`, `competitions`, `teams`) e os documentos antigos (`games`, `summaries`, `stastistics`, `lineups`, `players`, `standings`, `videos`, `news`, `tweets`) com os campos exatos que a V2 lê. Um único escritor grava os dois em lote, só o que mudou, respeita jogos bloqueados à mão e regista a saúde de cada fonte. As functions agendadas só orquestram: chamam o cliente uma vez por dado e passam o resultado ao mapeamento e ao escritor.

**Tech Stack:** Node 22, TypeScript 5, firebase-functions 7.x (`onSchedule`, `defineSecret`, `defineString`), firebase-admin 13.x, Jest + ts-jest, Firebase Emulator (`demo-scp360`), `fetch` nativo do Node 22, rss-parser 3.x, tsx (scripts), date-fns + date-fns-tz. Sem axios e sem o SDK cliente `firebase` em código de produção.

**Spec:** `docs/superpowers/specs/2026-11-17-scp360-v2027-design.md` (secções 3, 5.4 a 5.6, 5.10, 5.16, 7, 8, 9 e 10). Ler também `docs/superpowers/notes/2026-11-17-plano1-handoff.md` e `docs/superpowers/notes/2026-11-17-plano2-inputs.md`.

## Global Constraints

- Projeto Firebase `scp360-37a74`, Firestore `eur3`. Functions novas no codebase `v2027`, região `europe-west1`, runtime `nodejs22`, `timeZone: "Europe/Lisbon"` em todos os `onSchedule`.
- Toda a escrita de dados é feita com o **Admin SDK**. O pacote `firebase` (SDK cliente) só existe em `devDependencies`, para os testes de regras.
- As coleções antigas mantêm **exatamente** os ids de documento, os nomes de campo, os tipos e as peculiaridades atuais (tabela "Contrato das coleções antigas" abaixo). Pode-se acrescentar o campo `_ingest: "v2027"`; não se remove nem se renomeia nada.
- Uma chamada à API por dado: a mesma resposta alimenta o modelo antigo e o novo.
- Chaves só em Secret Manager: `RAPIDAPI_KEY`, `VSPORTS_KEY`, `TWITTER_BEARER_TOKEN` (`defineSecret`). Nunca em código, testes, fixtures, logs ou commits. Não se rodam as chaves (decisão do Martim).
- Testes sem chamadas reais: só fixtures gravadas em `functions/test/fixtures/**` (JSON, XML ou HTML) servidas por um `fetch` falso.
- Comandos de publicação sempre com nomes: `--only functions:v2027:<nome>,...`. Nunca `firebase deploy` sem `--only`, nunca `--only functions` sem nomes. As functions antigas apagam-se só por nome, em `us-central1`, depois do OK do Martim.
- Passos marcados **PARAGEM** só correm com o OK explícito do Martim na conversa.
- Sporting: API-Football equipa `228`; VSports equipa `"6"`; ids das API-Sports e das fontes gratuitas vêm da Task 1.
- A competição aparece sempre com nome e jornada ou fase em português ("J11", "Oitavos de final"); uma ronda desconhecida mostra o texto original e nunca "J" + texto.
- Live: polling a cada 15 s só com um jogo de futebol do Sporting em curso; fora disso, nenhuma chamada no ticker.
- Sem odds. Sem push. Sem estatísticas, formações ou diretos nas outras modalidades (só calendário, resultado e classificação).
- Textos em pt-PT, sem travessões.
- Nada pode partir a app V2 em produção antes do corte do Plano 5.

## Review Focus

1. **Jogo adiado (`PST`) ou com hora alterada** → o `matches` e o `games` antigo passam a ter a nova hora, o ticker não faz polling enquanto está `PST`, e a liquidação antiga não o liquida como 0-0 (a antiga fazia-o quando `endTime` passava). Testes nas Tasks 7 e 15.
2. **A API falha, devolve `errors` num 200 ou devolve listas vazias a meio do jogo** → os dados já gravados (lances, formações, estatísticas, `summaries`) não são apagados nem substituídos por vazios, e fica um alerta em `ingestHealth`. Testes nas Tasks 6 e 12.
3. **Jogo com prolongamento e penáltis** → o ticker continua a 15 s durante `ET`, `BT` e `P`; o `finishedAt` é a hora real a que se viu `AET`/`PEN`; o `games` antigo mostra os golos com prolongamento e sem penáltis. Teste na Task 12.
4. **Jogo corrigido à mão no Firestore (`locked: true`)** → nenhuma ingestão o reescreve. Teste na Task 6.
5. **Uma fonte de futsal ou hóquei devolve zero jogos ou HTML diferente a meio da época** → os jogos existentes ficam, usa-se a fonte de recurso e sai um alerta. Teste na Task 17.

---

## Decisões de desenho (documentadas aqui, não reabrir)

**Modelo novo.** Coleção nova `matches/{matchId}`, separada de `games`, porque a V2 lê `games` inteira (Home, agenda) e o campo `games.competition` é uma string; pôr lá outras modalidades ou mudar o tipo partiria a V2.

- `matchId` do futebol = id do fixture API-Football em string, igual ao id de `games/{api}` e ao `gameId` que o motor do Plano 1 já usa (`matchPredictions/{gameId}_{uid}`). Outras modalidades: `hb_`, `vb_`, `bb_`, `fs_` (futsal), `hq_` (hóquei) + id da fonte (ou o id reconciliado da Task 17).
- Detalhe do jogo em documentos únicos (um `onSnapshot` por ecrã): `matches/{id}/details/{events|statistics|lineups|players|prematch|injuries}`. Vídeos em `matches/{id}/videos/{videoId}`.
- Época e competição: `competitions/{sport}_{leagueId}_{season}` e `competitions/{key}/data/{standings|rounds|fixtures|topscorers|topassists|topyellowcards|topredcards}`.
- Equipa: `teams/{sport}_{teamId}` (ex. `teams/football_228`) e `teams/{key}/data/{squad|coach|playerStats_{season}|teamStats_{leagueId}_{season}|injuries|transfers|trophies|sidelined}`.
- Estádios: `venues/{venueId}` (cache; a cópia resumida vai para `matches.venue`).
- Interno, sem leitura pública: `ingestHealth/{source}`, `ingestState/{key}`, coleções `_shadow_*`.
- `config/app`: versão mínima, textos, Comunidade Leonina.

**Fim do jogo real.** `status` vem da API (`fixture.status.short`). `finishedAt` = hora a que o ticker viu o estado final pela primeira vez (`finishedAtSource: "observed"`); se nunca foi visto ao vivo, estimativa a partir de `fixture.periods.second` (`"estimated"`). Acaba o `endTime = início + 150 min` no motor; o campo antigo `endTime` passa a valer `finishedAt` quando existe (senão mantém a estimativa, só para a V2).

**Modo sombra.** O parâmetro `LEGACY_COLLECTION_PREFIX` (`defineString`, por omissão `""`) prefixa as coleções antigas. Publica-se primeiro com `_shadow_`, compara-se com o que as functions antigas escrevem, e só depois se muda para `""` e se apagam as antigas. Com prefixo diferente de `""` a liquidação antiga portada não corre.

**Contrato das coleções antigas** (verificado contra `legacy/v2-functions/src/database/models/*`, `services/*` e os leitores da V2 em `src/api/firebase/*` e `src/screens/app/game/details.tsx`):

| Coleção | Id do doc | Campos e tipos (todos obrigatórios salvo indicação) | Lida pela V2 em |
|---|---|---|---|
| `games` | `{fixtureId}` | `api` str, `timestamp` Timestamp, `teamhome`/`teamaway` `{name, logo, api: str}`, `scorehome`/`scoreaway` str (`"0"` se null), `competition` str (`league.name`), `season` str, `channel` str (preserva o existente, senão `""`), `elapsedTime` str (`"0"` se null), `journey` str (`round.split("-")[1]` com o espaço inicial, ex. `" 11"`, senão `round`, senão `""`), `isActive` bool, `startTime` ISO, `endTime` ISO, `predictionsSettled` (só a liquidação escreve; preservar com merge) | Home, agenda (`timestamp` + `orderBy`), detalhe (`onSnapshot` por id), `where('api','==')` |
| `summaries` | `{player.id}_{team.name}_{fixtureId}_{detail}_{elapsed}` | `api`, `detail`, `GameId`, `type`, `time` (str de `elapsed`), `player {name, api: str, logo: ""}`, `playerSub {name, api, logo: ""}` (assist, `""` se null), `team {name, api: str, logo}`. Os obsoletos do jogo apagam-se depois do upsert | `where GameId`, `where GameId & type=='subst'` |
| `stastistics` (sic) | `{teamId}_{fixtureId}_{type}` | `api`, `GameId`, `team {name, logo, api: str}`, `type`, `value` = `String(value)` (null fica `"null"`) | `where GameId` |
| `lineups` | `{teamId}_{fixtureId}` | `GameId`, `id`, `teamId` str, `formation` (`""` se null), `startXI[]`/`substitutes[]` `{playerId: str, number, name, grid, position: str}` | `where GameId` |
| `players` | `{teamId}_{fixtureId}` | `GameId`, `id`, `teamId` **número**, `Players[]` `{playerId: str, number, name, photo, position, rating (str ou null), goals (0 se null), assists, saves, passesAccuracy, tackles, foulsCommitted, cardsYellow, cardsRed, teamId número, grid, minutes, substitute}`; `grid` do suplente = grid do titular que substituiu (via `summaries` subst: `playerSub` entra, `player` sai). Sem estatísticas mas com onzes: plantel mínimo a partir de `lineups` | `where GameId`; MVP da V2 |
| `standings` | `{teamId}_{leagueId}_{season}` | `api`, `season`, `points`, `rank`, `goalsfor`, `goalsagainst`, `played`, `win`, `draw`, `lose` (todos str), `competition` (94 `Primeira Liga`, 2 `UEFA Champions League`, 97 `Taça da Liga`, senão `Taça de Portugal`), `team {name, logo, api}`. Só ligas `[94, 2, 97, 96]` e só o grupo onde está o 228 | `where competition` + filtro de `season` |
| `videos` | `{vdo.id}` | `title`, `videoUrl` (= `links.embed` tal como vem), `minute`, `GameId`, `bigpicture`, `id`. Só tipos `goal`, `resume`, `flash`; só jogos com `api >= 1210619` e fora da Champions | `where GameId` |
| `news` | `slugifyUrl(link)` | `id`, `title`, `image`, `summary`, `content` (= summary), `source`, `url`, `created_at` ISO str. Acrescenta-se `sport` e `publishedAt` | `orderBy created_at desc` |
| `tweets` | `{tweet.id}` | `id`, `text` (`note_tweet.text` senão `text`), `created_at`, `username`, `name`, `profile_image_url`, `media[] {url, type}`, `metrics {retweet_count, reply_count, like_count, quote_count, bookmark_count, impression_count}` | `orderBy created_at desc` |
| `predictions`, `rankings`, `point_events` | (liquidação antiga) | ver Task 15 | ranking V2 |

**Substituição das functions antigas** (todas em `us-central1`, codebase por omissão):

| Antiga | Cron | Substituta `v2027` |
|---|---|---|
| `gamesSheduler` | `0 */2 * * *` | `footballFixturesSync` (cada 3 h) |
| `liveMatchUpdater` | cada minuto | `footballLiveTicker` |
| `summarySheduler`, `statisticsSheduler`, `PlayersSheduler`, `lineupsheduler` | 2 h e 09:00 | `footballLiveTicker` + `footballPostMatchSync` (09:00) |
| `standingsSheduler` | `0 */2 * * *` | `footballStandingsSync` (cada 6 h, e cada 15 min durante o jogo) |
| `videosSheduler` | `*/5` | `videosSync` |
| `newsSheduler` | `*/15` | `newsSync` |
| `twitterScheduler` | `0 */10 * * *` | `tweetsSync` |
| `predictionsSettlementScheduler` | `*/5` | `legacyPredictionSettlement` |
| `games`, `backfill` (HTTP, sem autenticação) | | sem substituta (o histórico já está em `games`; `scripts/backfill-season.ts` preenche o modelo novo da época atual) |

**Orçamento RapidAPI (API-Football, quota diária).**

| Dado | Cadência | Pedidos/dia |
|---|---|---|
| `fixtures?team=228&season=S` (até 3 épocas) | cada 3 h | 24 |
| `fixtures?ids=` pós-jogo | 09:00 | 1 |
| `standings` (≈5 competições) | cada 6 h | 20 |
| `fixtures/rounds` + `fixtures?league&season` (≈5) | diário | 10 |
| tops (marcadores, assistências, amarelos, vermelhos) × 2 ligas | diário | 8 |
| plantel, treinador, estatísticas da época (≈3 páginas), estatísticas da equipa (≈5), lesões | diário | 11 |
| transferências, troféus, histórico de lesões, estádios | semanal | ≈1 (média) |
| pré-jogo (`predictions` + `injuries?fixture`) | 2 por jogo, cada 12 h nas 48 h antes | ≈4 por jogo |
| **Base por dia sem jogo** | | **≈75** |
| Ticker: pré-jogo 75 min × 1/min | | 75 |
| Ticker: em jogo ≈115 min × 4/min (+140 com prolongamento) | | 460 a 600 |
| Ticker: pós-jogo 25 min × 1/min + 3 refrescos de notas + standings 8 | | ≈36 |
| **Dia de jogo** | | **≈650 a 800** |

Mês típico (10 jogos): ≈9.000 em dias de jogo + ≈2.250 de base ≈ **11.000/mês**, máximo diário < 1.000. Cabe no plano Pro da API-Football (7.500/dia); o Free (100/dia) não chega. API-Sports andebol, voleibol e basquetebol têm quotas separadas: ≈40/dia cada (jogos cada 3 h, cada 10 min só em janela de jogo, classificações 4×/dia). VSports e RSS não usam RapidAPI.

---

## Estrutura de ficheiros

```
functions/
  package.json                       + rss-parser, tsx (dev)
  .env.scp360-37a74                  LEGACY_COLLECTION_PREFIX (não é segredo)
  src/index.ts                       exports e agendamentos
  src/config/secrets.ts              defineSecret e defineString
  src/sources/http.ts                getJson/getText, SourceError, timeout
  src/sources/apiFootball.ts         cliente API-Football + tipos em apiFootball.types.ts
  src/sources/apiSports.ts           cliente andebol, voleibol, basquetebol
  src/sources/vsports.ts             cliente VSports
  src/sources/rss.ts                 feeds RSS
  src/sources/twitter.ts             cliente Twitter/X
  src/sources/free/*.ts              fontes de futsal e hóquei (Task 17)
  src/model/types.ts                 Sport, MatchDoc, detalhes
  src/model/status.ts                mapas de estado por fornecedor
  src/model/labels.ts                nomes de competição e rondas em pt-PT
  src/model/seasons.ts               épocas da API (futebol e outras)
  src/football/mapFixture.ts         fixture → modelo novo
  src/football/fixturesSync.ts       calendário e pós-jogo
  src/football/competitionSync.ts    classificações, rondas, tops
  src/football/teamSync.ts           plantel, época, transferências, troféus, lesões
  src/football/prematchSync.ts       previsão, lesões do jogo, estádio
  src/football/liveTicker.ts         polling ao vivo
  src/legacy/footballLegacy.ts       fixture → coleções antigas
  src/legacy/standingsLegacy.ts      standings antigos
  src/legacy/predictionSettlement.ts porta da liquidação antiga
  src/store/writer.ts                escrita em lote, deteção de mudanças, prefixo, locked
  src/store/health.ts                ingestHealth e alertas
  src/videos/videosSync.ts           VSports
  src/news/newsSync.ts               RSS
  src/social/tweetsSync.ts           Twitter/X
  src/modalities/apiSportsSync.ts    andebol, voleibol, basquetebol
  src/modalities/freeSourcesSync.ts  futsal, hóquei, reconciliação
  src/modalities/sourcesConfig.ts    ids e fontes escolhidos na Task 1
  src/data/gamesRepo.ts              (alterado) lê matches
  scripts/record-fixtures.ts         grava respostas reais para fixtures (Martim)
  scripts/backfill-season.ts         preenche matches da época atual
  scripts/compare-legacy.ts          compara _shadow_* com as coleções antigas
  scripts/check-predeploy.ts         verificações antes das regras
  scripts/seed-config.ts             semeia config/app
  seed/config-app.json
  test/helpers/fakeFetch.ts          fetch falso a partir de fixtures
  test/helpers/emulatorDb.ts         app admin no emulator e limpeza
  test/helpers/seedMatch.ts          semear matches e details
  test/fixtures/**                   respostas gravadas
firestore.rules, firestore.indexes.json   (alterados)
docs/superpowers/notes/2026-11-2x-fontes-modalidades.md   (Task 1)
```

---

### Task 1: Investigação de fontes das modalidades (24/11)

Primeira tarefa. Não escreve código de produção. O resultado decide as Tasks 16 e 17.

**Files:**
- Create: `docs/superpowers/notes/2026-11-24-fontes-modalidades.md`
- Create: `functions/src/modalities/sourcesConfig.ts`
- Create: `functions/test/fixtures/free/<fonte>/*.{html,json}` e `functions/test/fixtures/api-sports/<sport>/*.json` (amostras públicas, sem chaves)
- Modify: `legacy/v2-functions/README.md` (linha de `midleware/videos.ts`: "contém a chave VSports como valor por omissão de `VSPORTS_KEY`")

**Interfaces:**
- Produces:
  - `export const API_SPORTS: Record<"handball" | "volleyball" | "basketball", { host: string; teamId: number; seasonFormat: "year" | "span"; leagues: { id: number; name: string; covered: boolean }[] }>`
  - `export const FREE_SOURCES: Record<"futsal" | "roller_hockey", { primary: FreeSourceRef; fallback: FreeSourceRef }>` e, para cada liga que a API-Sports não cobre, uma entrada em `API_SPORTS_GAPS: { sport; competition; primary: FreeSourceRef; fallback: FreeSourceRef }[]`
  - `interface FreeSourceRef { key: string; kind: "html" | "json" | "ical" | "rss"; url: string; notes: string }`
  - A lista de textos de ronda reais de cada fonte (para os testes de `roundLabel` das Tasks 16 e 17).

- [ ] **Step 1:** Avaliar, para futsal e hóquei em patins (Sporting masculino, época 2026-2027, todas as competições: campeonato, taças, Supertaça, Europa), pelo menos: FPF (resultados e calendários do futsal), Federação de Patinagem de Portugal, World Skate Europe (competições europeias de hóquei), UEFA (Futsal Champions League), site do Sporting (calendário das modalidades), feeds iCal públicos se existirem, APIs gratuitas ou não oficiais e resultados indexados pelo Google. Para cada fonte registar numa tabela: cobertura (competições e campos: hora, local, resultado, ronda), estabilidade (formato, histórico de mudanças, se exige JavaScript), termos de uso e robots.txt, e frequência aceitável de pedidos. Excluir fontes cujos termos proíbam recolha automática.
- [ ] **Step 2:** Para andebol, voleibol e basquetebol, confirmar na documentação pública da API-Sports (RapidAPI) o host, o id da equipa do Sporting, os ids das ligas onde joga em 2026-2027, o formato da época e quais competições **não** estão cobertas (ex. taças nacionais). Para essas, escolher fonte principal e de recurso como no Step 1.
- [ ] **Step 3:** Escolher uma fonte principal e uma de recurso por modalidade (e por lacuna), com a justificação numa frase cada. Se a única opção viável exigir pagamento ou tiver termos duvidosos, **parar e perguntar ao Martim**; caso contrário seguir.
- [ ] **Step 4:** Guardar uma amostra real de cada fonte escolhida em `test/fixtures/free/<key>/` (calendário com jogos passados e futuros, e uma página ou resposta vazia se existir) e amostras documentadas das API-Sports em `test/fixtures/api-sports/<sport>/` (`games.json`, `standings.json`). Verificar: `grep -rniE "key|token|bearer" functions/test/fixtures` não devolve credenciais.
- [ ] **Step 5:** Escrever `sourcesConfig.ts` com os valores escolhidos e `npm run lint`. Esperado: sem erros.
- [ ] **Step 6:** Commit `docs: sources research for futsal, roller hockey and api-sports`.

### Task 2: Clientes HTTP finos com `fetch` injetável

**Files:**
- Create: `functions/src/sources/http.ts`, `apiFootball.ts`, `apiFootball.types.ts`, `apiSports.ts`, `vsports.ts`, `rss.ts`, `twitter.ts`
- Create: `functions/src/config/secrets.ts`
- Create: `functions/test/helpers/fakeFetch.ts`, `functions/scripts/record-fixtures.ts`
- Create: `functions/test/fixtures/api-football/{fixtures-team-season.json,fixture-ns.json,fixture-live-1h.json,fixture-ht.json,fixture-live-2h.json,fixture-et.json,fixture-pen.json,fixture-ft.json,fixture-pst.json,errors-ratelimit.json,standings-94.json,rounds-94.json,topscorers-94.json,squad-228.json,coachs-228.json,players-228-p1.json,players-228-p2.json,team-stats-94.json,injuries-team.json,injuries-fixture.json,predictions.json,transfers-228.json,trophies.json,sidelined.json,venue.json}`, `functions/test/fixtures/vsports/{rounds-1.json,videos-match.json}`, `functions/test/fixtures/rss/{record.xml,maisfutebol.xml}`, `functions/test/fixtures/twitter/user-tweets.json`
- Modify: `functions/package.json` (+ `rss-parser` ^3.13.0; dev `tsx`)
- Test: `functions/test/unit/sources.test.ts`

**Interfaces:**
- Produces:
  - `type FetchFn = typeof fetch`
  - `class SourceError extends Error { source: string; kind: "http" | "api" | "parse" | "timeout"; status?: number }`
  - `getJson<T>(f: FetchFn, url: string, o: { source: string; headers?: Record<string, string>; timeoutMs?: number }): Promise<{ body: T; headers: Headers }>` e `getText(...)` com a mesma forma. Timeout por omissão 10 s (`AbortSignal.timeout`).
  - `apiFootball(o: { key: string; fetch?: FetchFn; host?: string }): ApiFootballClient`, host por omissão `api-football-v1.p.rapidapi.com`, base `https://{host}/v3`, cabeçalhos `X-RapidAPI-Key` e `X-RapidAPI-Host`. Métodos (todos devolvem o array `response`): `fixturesByTeamSeason(team, season)`, `fixturesByIds(ids: string[])` (máx. 20, separados por `-`; inclui events, lineups, statistics e players), `rounds(league, season)`, `fixturesByLeague(league, season)`, `standings(league, season)`, `topPlayers(kind: "topscorers" | "topassists" | "topyellowcards" | "topredcards", league, season)`, `squad(team)`, `coachs(team)`, `playersBySeason(team, season)` (segue `paging` até ao fim), `teamStatistics(league, season, team)` (objeto), `injuries(q: { team: number; season: string } | { fixture: string })`, `predictions(fixture)`, `transfers(team)`, `trophies(q: { players: string[] } | { coach: string })`, `sidelined(players: string[])`, `venue(id)`. Propriedades `calls: number` e `remaining: number | null` (de `x-ratelimit-requests-remaining`).
  - `apiSports(o: { sport: "handball" | "volleyball" | "basketball"; key: string; fetch?: FetchFn; host?: string }): ApiSportsClient` com `games(q: { team: number; season: string })`, `standings(q: { league: number; season: string })`, `calls`, `remaining`. Host por omissão de `API_SPORTS[sport].host` (Task 1).
  - `vsports(o: { key: string; fetch?: FetchFn }): VsportsClient` com `rounds(cp: string, seasonId: number)` (`/pesquisa-sec?scp&cp=&ep=&lst=match&pp=0&vp=310&eq=6`, cabeçalho `KEY`) e `videosByMatch(matchId: string)` (`/vdo-pesquisa-sec?scp&gm=`); `vsportsSeasonId(now: Date, override?: number): number` = `30 + (anoInícioÉpoca - 2025)`, com a época a começar em agosto.
  - `fetchFeed(f: FetchFn, s: { name: string; url: string }): Promise<FeedItem[]>` com `FeedItem { title; link; pubDate; summary; image; source }`, usando `getText` + `new Parser().parseString`, com a extração de imagem (enclosure, senão primeiro `<img src>`) e a limpeza de CDATA do código antigo.
  - `twitter(o: { token: string; fetch?: FetchFn }): TwitterClient` com `userTweets(userId: string)` e os mesmos `params` do código antigo.
  - Tipos exportados: `ApiFootballClient`, `ApiSportsClient`, `VsportsClient`, `TwitterClient`, e em `apiFootball.types.ts` `AfFixture` (fixture com `events`, `lineups`, `statistics`, `players`), `AfStandingsResponse`, `AfPlayerSeason`, `AfPrediction`.
  - `secrets.ts`: `RAPIDAPI_KEY`, `VSPORTS_KEY`, `TWITTER_BEARER_TOKEN` (`defineSecret`), `LEGACY_COLLECTION_PREFIX` (`defineString`, default `""`), `VSPORTS_SEASON_ID` (`defineString`, default `""`).
  - `fakeFetch(routes: Array<[RegExp, string | object | { status: number; body?: unknown; headers?: Record<string, string> }]>): FetchFn & { calls: string[] }`: uma string é um caminho relativo a `test/fixtures`; sem rota → lança erro (nunca rede real).

As fixtures deste passo seguem a forma documentada da API-Football v3 (copiar a estrutura de `legacy/v2-functions/src/midleware/interface/**`), com 2 equipas (228 e 211), lances de golo, cartão, substituição e VAR, `expected_goals` nas estatísticas, `periods.first/second` e `referee`. A Task 21 troca-as por respostas reais gravadas.

- [ ] **Step 1: Escrever os testes** em `sources.test.ts`:
  - `apiFootball` chama `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=228&season=2026` com os dois cabeçalhos e devolve `response`; `calls === 1`; `remaining` lido do cabeçalho.
  - Resposta 200 com `errors: { requests: "..." }` (`errors-ratelimit.json`) → `SourceError` com `kind: "api"`; com `errors: []` → ok.
  - HTTP 500 → `kind: "http"`, `status: 500`; fetch que nunca responde com `timeoutMs: 50` → `kind: "timeout"`.
  - `fixturesByIds` com 21 ids lança erro; com 3 ids usa `ids=a-b-c`.
  - `playersBySeason` com `paging.total: 2` faz 2 chamadas e junta os dois arrays.
  - `vsportsSeasonId(new Date("2026-11-17T12:00:00Z")) === 31`; `(new Date("2026-07-31T12:00:00Z")) === 30`; override 40 → 40.
  - `fetchFeed` com `record.xml` tira o CDATA do título e lê a imagem do enclosure; com `maisfutebol.xml` lê a imagem do `<img>` do conteúdo.
  - `twitter().userTweets("21389998")` envia `Authorization: Bearer <token de teste>` e os `params` antigos.
  - `fakeFetch` sem rota correspondente lança `Error("fakeFetch: sem rota para ...")`.
- [ ] **Step 2:** `cd functions && npm test -- sources`. Esperado: falha (módulos inexistentes).
- [ ] **Step 3:** Implementar os módulos com as assinaturas acima.
- [ ] **Step 4:** `npm test -- sources`. Esperado: passa.
- [ ] **Step 5:** Escrever `scripts/record-fixtures.ts`: lê `RAPIDAPI_KEY` e `VSPORTS_KEY` de variáveis de ambiente (nunca de ficheiro), faz uma chamada por fixture listada acima para um jogo indicado por `--fixture <id>`, remove cabeçalhos e quaisquer campos com chave, e grava em `test/fixtures/**/real/`. Sem teste (é só ferramenta); verificar `npx tsx scripts/record-fixtures.ts --help` imprime a ajuda sem fazer chamadas.
- [ ] **Step 6:** Commit `feat(sources): thin api clients with injectable fetch and recorded fixtures`.

### Task 3: Modelo novo, estados, épocas e rótulos em pt-PT (lógica pura)

**Files:**
- Create: `functions/src/model/types.ts`, `status.ts`, `labels.ts`, `seasons.ts`
- Modify: `functions/src/data/gamesRepo.ts` (passa a importar `footballStatus` de `model/status.ts` em vez do `STATUS_MAP` local)
- Test: `functions/test/unit/model.test.ts`

**Interfaces:**
- Consumes: `GameStatus` de `src/game/types.ts` (Plano 1).
- Produces:
  - `type Sport = "football" | "futsal" | "handball" | "roller_hockey" | "volleyball" | "basketball"`
  - `type CompetitionType = "league" | "cup" | "supercup" | "europe" | "friendly"`
  - `interface TeamRef { id: string; name: string; logo: string | null }`
  - `interface MatchDoc { id: string; sport: Sport; competition: { key: string; id: string; name: string; type: CompetitionType; season: string; round: string | null; roundLabel: string | null }; home: TeamRef; away: TeamRef; sportingSide: "home" | "away"; kickoff: Date; status: GameStatus; statusRaw: string; elapsed: number | null; elapsedExtra: number | null; score: { home: number | null; away: number | null; halftime: Pair | null; extratime: Pair | null; penalty: Pair | null; sets?: Pair[] }; finishedAt: Date | null; finishedAtSource: "observed" | "estimated" | null; venue: { id: string | null; name: string; city: string | null; capacity?: number | null; image?: string | null } | null; referee: string | null; source: { provider: string; id: string; fallbackUsed?: boolean }; locked?: boolean }` com `type Pair = { home: number | null; away: number | null }`. As datas são `Date` no modelo; o escritor converte para `Timestamp`.
  - `FINAL_STATUSES: ReadonlySet<GameStatus>` = `FT`, `AET`, `PEN`; `LIVE_STATUSES` = `LIVE`, `HT`.
  - `footballStatus(short: string): GameStatus` (o mapa atual do `gamesRepo`, incluindo `INT`, `SUSP`, `ABD`, `AWD`, `WO`; desconhecido → `NS`).
  - `apiSportsStatus(sport: "handball" | "volleyball" | "basketball", short: string): GameStatus`: andebol `1H/2H/ET/BT/PT` → LIVE, `HT` → HT, `FT` → FT, `AET`/`AP` → AET/PEN; voleibol `S1`..`S5` → LIVE, `FT`/`AW` → FT/CANC; basquetebol `Q1`..`Q4`, `OT`, `BT` → LIVE, `HT` → HT, `FT`, `AOT` → FT/AET; comuns `NS`, `POST` → PST, `CANC`, `INTR`/`SUSP` → PST, `ABD` → CANC.
  - `footballApiSeason(now: Date): string` (ano de início, com agosto como primeiro mês, como o código antigo) e `seasonsToFetch(now: Date): string[]` = únicos de `[footballApiSeason(now), anoCivil(now)]` mais `footballApiSeason(now) + 1` de maio a julho (hora de Lisboa).
  - `competitionLabel(sport: Sport, leagueId: number | null, rawName: string): { name: string; type: CompetitionType }`. Futebol: 94 `Liga Portugal` (league), 96 `Taça de Portugal` (cup), 97 `Taça da Liga` (cup), 550 `Supertaça` (supercup), 2 `Liga dos Campeões`, 3 `Liga Europa`, 848 `Liga Conferência`, 531 `Supertaça Europeia` (europe), 10 e 667 `Particular` (friendly); desconhecido → `rawName`, `league`.
  - `roundLabel(raw: string | null, type: CompetitionType): string | null`.
  - `competitionKey(sport, leagueId, season): string` = `${sport}_${leagueId}_${season}`.

- [ ] **Step 1: Escrever os testes.**
  - `roundLabel`: `"Regular Season - 11"` → `"J11"`; `"League Stage - 5"` → `"Fase de liga, J5"`; `"Group Stage - 3"` e `"Group A - 3"` → `"Fase de grupos, J3"`; `"Round of 32"` → `"16 avos de final"`; `"Round of 16"` → `"Oitavos de final"`; `"Quarter-finals"` → `"Quartos de final"`; `"Semi-finals"` → `"Meias-finais"`; `"Final"` → `"Final"`; `"1st Round"` → `"1.ª eliminatória"`; `"3rd Round"` → `"3.ª eliminatória"`; `"Knockout Round Play-offs"` e `"Play-offs"` → `"Play-off"`; `"Club Friendlies 3"` com `friendly` → `null`; `null` → `null`; `"Strange Round"` → `"Strange Round"` (nunca começa por `"J"` se não houver número de jornada).
  - `competitionLabel("football", 94, "Primeira Liga")` → `{ name: "Liga Portugal", type: "league" }`; `(…, 667, "Club Friendlies")` → `Particular`/`friendly`; `(…, 9999, "Liga X")` → `Liga X`/`league`.
  - `footballApiSeason(2026-11-17)` → `"2026"`; `(2027-07-31T22:00Z)` → `"2026"`; `(2027-08-01T00:00+01:00)` → `"2027"`. `seasonsToFetch(2026-11-17)` → `["2026"]`; `(2027-03-10)` → `["2026","2027"]`; `(2027-06-10)` → `["2026","2027"]` (2027 já está pelo ano civil, sem duplicar).
  - `footballStatus("2H") === "LIVE"`, `("P") === "LIVE"`, `("AET") === "AET"`, `("XYZ") === "NS"`; `apiSportsStatus("volleyball","S3") === "LIVE"`, `("basketball","AOT") === "AET"`, `("handball","POST") === "PST"`.
- [ ] **Step 2:** `npm test -- model`. Esperado: falha.
- [ ] **Step 3:** Implementar. `roundLabel` reconhece por expressões regulares as formas acima; tudo o resto devolve o texto original.
- [ ] **Step 4:** `npm test`. Esperado: passa, incluindo todos os testes do Plano 1.
- [ ] **Step 5:** Commit `feat(model): multi-sport match model, statuses and pt-PT labels`.

### Task 4: Mapeamento do fixture API-Football para o modelo novo

**Files:**
- Create: `functions/src/football/mapFixture.ts`
- Test: `functions/test/unit/mapFixture.test.ts`

**Interfaces:**
- Consumes: tipos da Task 2 (`AfFixture`), `MatchDoc`, `footballStatus`, `competitionLabel`, `roundLabel`, `competitionKey` (Task 3).
- Produces:
  - `interface EventItem { minute: number; extra: number | null; teamId: string; playerId: string | null; playerName: string | null; assistId: string | null; assistName: string | null; type: "goal" | "card" | "subst" | "var" | "other"; detail: string; comments: string | null }`
  - `interface FootballDetails { events: { items: EventItem[] } | null; statistics: { teams: { teamId: string; items: Record<string, string | number | null> }[]; xg: Pair | null } | null; lineups: { teams: { teamId: string; formation: string | null; coach: { id: string | null; name: string; photo: string | null } | null; startXI: LineupPlayer[]; substitutes: LineupPlayer[] }[] } | null; players: { teams: { teamId: string; players: PlayerStatLine[] }[] } | null }` com `LineupPlayer { playerId: string; name: string; number: number | null; pos: string | null; grid: string | null }` e `PlayerStatLine { playerId; name; photo; number; position; minutes: number | null; rating: number | null; goals; assists; saves; passesAccuracy; tackles; foulsCommitted; cardsYellow; cardsRed; substitute: boolean }`. Um detalhe vem `null` quando a resposta traz o array vazio (o escritor não grava `null` por cima de dados existentes).
  - `mapFixture(f: AfFixture, ctx: { now: Date; previous: Pick<MatchDoc, "status" | "finishedAt" | "finishedAtSource"> | null; observedLive: boolean }): { match: MatchDoc; details: FootballDetails }`
  - `estimateFinishedAt(f: AfFixture, now: Date): Date` = `periods.second` (s) + 50 min, ou kickoff + 110 min sem `periods.second`; +35 min se `AET` ou `PEN`; nunca depois de `now`.
  - `sportingSide` = `home` se `teams.home.id === 228`.

- [ ] **Step 1: Escrever os testes.**
  - `fixture-live-2h.json` → `status: "LIVE"`, `statusRaw: "2H"`, `elapsed` igual ao da fixture, `competition.key: "football_94_2026"`, `roundLabel: "J11"`, `referee` e `venue.name` preenchidos, `score.home/away` = `goals`.
  - Transição: `previous.status: "LIVE"`, fixture `FT`, `observedLive: true`, `now = 22:41Z` → `finishedAt = now`, `finishedAtSource: "observed"`.
  - Já final antes: `previous.finishedAt = 22:20Z` → mantém 22:20Z mesmo com `now` mais tarde.
  - `FT` sem `previous` e `observedLive: false` → `estimated`, igual a `periods.second + 50 min`; com `PEN` soma 35 min; nunca maior que `now`.
  - `fixture-pen.json`: `score.home/away` = golos com prolongamento, `score.penalty` preenchido, `status: "PEN"`.
  - Eventos: `Goal` → `goal`, `Card` → `card`, `subst` → `subst` com `assistId` = quem entra, `Var` → `var`.
  - Estatísticas: `expected_goals` "1.43" e "0.88" → `xg: { home: 1.43, away: 0.88 }`; ausente → `xg: null`.
  - Ratings: `"7.3"` → 7.3; `null` ou `""` → `null`.
  - `fixture-ns.json` (arrays vazios) → `details.events`, `statistics`, `lineups` e `players` todos `null`.
- [ ] **Step 2:** `npm test -- mapFixture`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test -- mapFixture`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(football): map api-football fixtures to the new match model`.

### Task 5: Mapeamento para as coleções antigas (contrato campo a campo)

**Files:**
- Create: `functions/src/legacy/footballLegacy.ts`
- Test: `functions/test/unit/footballLegacy.test.ts`

**Interfaces:**
- Consumes: `AfFixture`, `MatchDoc` (Tasks 2 a 4).
- Produces:
  - `interface LegacyDocs { games: Record<string, DocumentData>; summaries: Record<string, DocumentData>; stastistics: Record<string, DocumentData>; lineups: Record<string, DocumentData>; players: Record<string, DocumentData> }` (chave = id do documento, valor = conteúdo exato)
  - `legacyFromFixture(f: AfFixture, match: MatchDoc, existing: { channel?: string } | null): LegacyDocs`
  - `legacyGame(f: AfFixture, match: MatchDoc, existing): DocumentData`: os campos de `games` da tabela de contrato; `isActive = LIVE_STATUSES.has(match.status)`; `endTime = (match.finishedAt ?? kickoff + 150 min).toISOString()`; `timestamp` como `Timestamp`; acrescenta `_ingest: "v2027"`.
  - Os arrays vazios na resposta produzem mapas vazios (`summaries: {}`), e o escritor (Task 6) trata-os como "sem dados", não como "apagar tudo".

- [ ] **Step 1: Escrever os testes** (um `it` por coleção, comparando com `toEqual` contra objetos escritos à mão a partir da tabela de contrato, para que uma diferença de nome ou tipo falhe):
  - `games/{id}`: `scorehome: "0"` quando `goals.home` é null; `elapsedTime: "0"` quando `elapsed` é null; `journey: " 11"` para `"Regular Season - 11"` e `"Final"` para `"Final"`; `competition: "Primeira Liga"` (o nome da API, não o pt-PT); `season: "2026"`; `channel` preserva `existing.channel`; `isActive: true` em `HT`; `endTime` = `finishedAt` em `FT`.
  - `summaries`: id `"<pid>_Sporting CP_<fx>_Normal Goal_23"`; `playerSub` vazio (`{name:"", api:"", logo:""}`) sem assist; `time: "23"`; `player.logo: ""`.
  - `stastistics`: id `"228_<fx>_Ball Possession"`; `value: "55%"`; valor null → `"null"`.
  - `lineups`: `teamId: "228"`, `position` em string, `formation: ""` quando null.
  - `players`: `teamId` número 228 no documento e em cada jogador; `goals: 0` quando null; `grid` do suplente = grid do titular que saiu (subst com `assist.id` = suplente); sem `players` na resposta mas com `lineups` → plantel mínimo (`rating: ""`, `minutes: 0`, `photo: ""`, `substitute` certo).
  - Nenhum valor `undefined` em nenhum documento (percorrer recursivamente).
- [ ] **Step 2:** `npm test -- footballLegacy`. Esperado: falha.
- [ ] **Step 3:** Implementar, portando a lógica de `legacy/v2-functions/src/services/{games,summary,statistics,lineups,players}.ts` e `todayGame.ts`, com a única diferença documentada (`isActive` e `endTime` reais).
- [ ] **Step 4:** `npm test -- footballLegacy`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(legacy): exact v2 document shapes from api-football fixtures`.

### Task 6: Escritor único, deteção de mudanças, jogos bloqueados e saúde das fontes

**Files:**
- Create: `functions/src/store/writer.ts`, `functions/src/store/health.ts`
- Create: `functions/test/helpers/emulatorDb.ts`
- Modify: `functions/src/index.ts` (`getFirestore().settings({ ignoreUndefinedProperties: true })` uma vez)
- Test: `functions/test/emulator/writer.test.ts`, `functions/test/emulator/health.test.ts`

**Interfaces:**
- Consumes: `MatchDoc`, `FootballDetails`, `LegacyDocs` (Tasks 3 a 5).
- Produces:
  - `legacyCollection(name: string, prefix?: string): string` = `prefix + name`; por omissão lê `LEGACY_COLLECTION_PREFIX.value()`.
  - `interface DocWrite { path: string; data: DocumentData; merge?: boolean }`
  - `writeDocs(db: Firestore, writes: DocWrite[], o: { stateKey: string }): Promise<{ written: number; skipped: number }>`: hash estável (sha1 do JSON com chaves ordenadas, sem `updatedAt`) por caminho guardado em `ingestState/{stateKey}.hashes`; só escreve o que mudou; lotes de até 450; acrescenta `updatedAt` (serverTimestamp) aos documentos do modelo novo.
  - `saveMatch(db, m: { match: MatchDoc; details?: FootballDetails | null; legacy?: Partial<LegacyDocs> | null }, o?: { prefix?: string }): Promise<{ written: number; skipped: number; locked: boolean }>`:
    - lê `matches/{id}`; se tiver `locked: true`, não escreve nada desse jogo (nem modelo novo nem antigo) e devolve `locked: true`;
    - converte `Date` em `Timestamp`;
    - escreve `matches/{id}` e cada detalhe não `null` em `matches/{id}/details/{nome}`;
    - escreve as coleções antigas com `legacyCollection`; `games` com `merge: true` (preserva `predictionsSettled` e `channel`);
    - `summaries`: só quando `legacy.summaries` foi passado e não está vazio, depois do upsert apaga as do jogo (`where GameId ==`) cujo id não veio.
  - `getMatch(db, id): Promise<MatchDoc | null>` (converte `Timestamp` de volta para `Date`).
  - `recordRun(db, source: string, r: { ok: true; count: number; remaining?: number | null } | { ok: false; error: string }, o?: { expectNonZero?: boolean; minRemaining?: number }): Promise<void>`: escreve `ingestHealth/{source}` `{ lastRunAt, lastOkAt, lastCount, lastError, consecutiveFailures, remaining }` e faz `logger.error("INGEST_ALERT", { source, reason })` quando `ok: false`, quando `expectNonZero` e `count === 0`, ou quando `remaining < minRemaining`.
  - `runJob(db, source, fn: () => Promise<{ count: number; remaining?: number | null }>, o?)`: chama `fn`, regista com `recordRun` e nunca relança (o scheduler não deve entrar em retry).
  - Helpers de teste: `testDb(name: string): Firestore` (app admin `demo-scp360`, `ignoreUndefinedProperties`) e `clearAll(db): Promise<void>` (apaga recursivamente todas as coleções de topo).

- [ ] **Step 1: Escrever os testes (emulator).**
  - `saveMatch` de um jogo novo → existem `matches/1001`, `matches/1001/details/events`, `games/1001`, `summaries/*`, `stastistics/*`, `lineups/*`, `players/*`; `matches/1001.kickoff` é `Timestamp`.
  - Repetir a mesma chamada → `written: 0`.
  - Mudar só o minuto → só `matches/1001` e `games/1001` são escritos.
  - **Review Focus 4:** `matches/1001` com `locked: true` e `score.home: 3` → `saveMatch` devolve `locked: true`, e nem `matches/1001` nem `games/1001` mudam.
  - **Review Focus 2:** detalhes existentes com 3 lances e uma nova chamada com `details.events: null` e `legacy.summaries: {}` → os 3 lances e os 3 `summaries` ficam. Com 2 lances novos (um removido pela API) → fica só o removido apagado.
  - `games/1001` com `predictionsSettled: true` e `channel: "SPTV"` → continuam depois do `saveMatch`.
  - Com `prefix: "_shadow_"` → escreve `_shadow_games/1001` e não toca em `games`.
  - `recordRun` com `ok: false` três vezes → `consecutiveFailures: 3`; depois `ok: true` → 0. Com `expectNonZero` e `count: 0` → o logger recebe `"INGEST_ALERT"` (espiar `logger.error` com `jest.spyOn`).
  - `runJob` com uma função que lança → não lança e `ingestHealth/x.lastError` tem a mensagem.
- [ ] **Step 2:** `npm run test:emulator -- writer health`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(store): single writer with change detection, locked matches and source health`.

### Task 7: Calendário de futebol e refresco pós-jogo

**Files:**
- Create: `functions/src/football/fixturesSync.ts`, `functions/scripts/backfill-season.ts`
- Modify: `functions/src/index.ts` (`footballFixturesSync` "every 3 hours"; `footballPostMatchSync` "0 9 * * *"; ambas com `secrets: [RAPIDAPI_KEY]`, `region: "europe-west1"`, `timeoutSeconds: 300`)
- Modify: `firestore.indexes.json` (composto `matches`: `sport` ASC + `kickoff` ASC; `sport` ASC + `finishedAt` ASC)
- Test: `functions/test/emulator/fixturesSync.test.ts`

**Interfaces:**
- Consumes: `apiFootball`, `mapFixture`, `legacyFromFixture`, `saveMatch`, `getMatch`, `runJob`, `seasonsToFetch`.
- Produces:
  - `interface FootballDeps { db: Firestore; api: ApiFootballClient; now: () => Date; prefix?: string }`
  - `syncFixtures(d: FootballDeps): Promise<{ count: number }>`: uma chamada `fixturesByTeamSeason(228, s)` por época de `seasonsToFetch`, sem filtro de liga (entram Supertaça e Europa automaticamente); para cada fixture `mapFixture` com `previous` do Firestore e `observedLive: false`, e `saveMatch` com `legacy.games` apenas (o calendário não traz lances).
  - `refreshRecent(d: FootballDeps, o: { finishedWithinMs: number }): Promise<{ count: number }>`: jogos de futebol finais com `finishedAt` dentro da janela → `fixturesByIds` em lotes de 20 → `saveMatch` completo (modelo novo e todas as coleções antigas). Por omissão 36 h.
  - `backfillFinished(d: FootballDeps, season: string, o: { newModelOnly: boolean }): Promise<{ count: number }>`, usado pelo script.
  - `listFootballWindow(db, from: Date, to: Date): Promise<MatchDoc[]>` (query `sport == "football"` e `kickoff` entre `from` e `to`), usado pelas Tasks 11, 12 e 13.

- [ ] **Step 1: Escrever os testes (emulator, `fakeFetch` com `fixtures-team-season.json`).**
  - `syncFixtures` com `now` 2026-11-17 → 1 chamada, um `matches/{id}` e um `games/{id}` por fixture, `games/{id}` com os campos do contrato.
  - **Review Focus 1:** segunda execução com o mesmo fixture em `PST` e `fixture.date` mudado para o dia seguinte → `matches.status: "PST"`, `matches.kickoff` e `games.timestamp`/`startTime` com a nova hora.
  - Um fixture já `FT` antes desta execução e visto pela primeira vez aqui → `finishedAtSource: "estimated"`.
  - `refreshRecent` com dois jogos `FT` nas últimas 36 h → uma única chamada `fixtures?ids=a-b` e `summaries`, `stastistics`, `lineups`, `players` escritos.
  - `backfillFinished(..., { newModelOnly: true })` não escreve nenhuma coleção antiga.
  - Falha da API → `ingestHealth/football_fixtures.consecutiveFailures === 1` e nenhum `matches` apagado.
- [ ] **Step 2:** `npm run test:emulator -- fixturesSync`. Esperado: falha.
- [ ] **Step 3:** Implementar; exportar as duas functions em `index.ts` através de `runJob`.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(football): fixtures sync, post-match refresh and season backfill`.

### Task 8: O adaptador do motor passa a ler `matches`

**Files:**
- Modify: `functions/src/data/gamesRepo.ts`
- Create: `functions/test/helpers/seedMatch.ts`
- Modify: `functions/test/emulator/gamesRepo.test.ts`, `callables.test.ts`, `settle.test.ts` (só os helpers de semente e as coleções limpas; nenhuma asserção muda)

**Interfaces:**
- Consumes: `getMatch`, `MatchDoc`, `FootballDetails["players"]`.
- Produces (assinaturas do Plano 1 inalteradas):
  - `getGameState(db, gameId, now?)`: lê `matches/{gameId}`; `null` se não existir **ou se `sport !== "football"`**; mapeia `status`, `elapsed`, `score`, `finishedAt`, `kickoff`, `sportingSide` diretamente (sem derivar de `isActive`/`endTime`).
  - `listFinishedUnsettled(db, now)`: query `sport == "football"` e `finishedAt` entre `now - 7 dias` e `now - 2 h`, filtra `FINAL_STATUSES` e exclui `settlements/{id}` com `settledAt`.
  - `getPlayerLines(db, gameId)`: lê `matches/{gameId}/details/players`; `teamIsSporting = teamId === "228"`.
  - `seedFootballMatch(db, over: Partial<MatchDoc> & { id: string }): Promise<void>` e `seedPlayers(db, gameId, lines: { teamId: string; players: Partial<PlayerStatLine>[] }[]): Promise<void>`.
  - O comentário do topo de `gamesRepo.ts` passa a descrever `matches` e a dizer que o fallback por `isActive`/`endTime` acabou.

- [ ] **Step 1: Reescrever os testes de `gamesRepo.test.ts`** para o modelo novo: jogo inexistente → null; `FT` com `finishedAt` → `GameState` completo; `LIVE` com `elapsed: 67`; `sportingSide: "away"`; **jogo de andebol `hb_1` → null**; `listFinishedUnsettled` devolve só os terminados há ≥ 2 h, não liquidados e dentro de 7 dias (os casos A a F atuais, reescritos com `seedFootballMatch`); `getPlayerLines` achata as duas equipas e converte rating vazio em null.
- [ ] **Step 2:** Migrar os `seedGame` e `seedPlayers` de `callables.test.ts` e `settle.test.ts` para `seedFootballMatch` e `seedPlayers` (ex. `isActive: true, elapsedTime: "80"` passa a `status: "LIVE", elapsed: 80`). Não alterar nenhum `expect`.
- [ ] **Step 3:** `npm run test:emulator`. Esperado: falham os testes do repositório e das callables/liquidação.
- [ ] **Step 4:** Implementar as três funções.
- [ ] **Step 5:** `npm run lint && npm test && npm run test:emulator`. Esperado: tudo passa.
- [ ] **Step 6:** Commit `refactor(data): engine adapter reads matches with real status and finishedAt`.

### Task 9: Classificações, rondas, calendário da competição e tops

**Files:**
- Create: `functions/src/football/competitionSync.ts`, `functions/src/legacy/standingsLegacy.ts`
- Modify: `functions/src/index.ts` (`footballStandingsSync` "every 6 hours")
- Test: `functions/test/emulator/competitionSync.test.ts`, `functions/test/unit/standingsLegacy.test.ts`

**Interfaces:**
- Consumes: `FootballDeps`, `writeDocs`, `legacyCollection`, `competitionLabel`, `roundLabel`, `competitionKey`.
- Produces:
  - `currentCompetitions(db, season: string): Promise<{ leagueId: number; season: string }[]>`: ligas distintas dos `matches` de futebol dessa época, sem `friendly`.
  - `refreshStandings(d: FootballDeps, leagueId: number, season: string): Promise<{ count: number }>`: 1 chamada; escreve `competitions/{key}` (nome, tipo, logo) e `competitions/{key}/data/standings` `{ groups: { name: string; rows: { rank; teamId; name; logo; points; played; win; draw; lose; goalsFor; goalsAgainst; goalsDiff; form; description }[] }[] }`; e, se `leagueId` estiver em `[94, 2, 97, 96]`, os documentos antigos de `standings` via `legacyStandings`.
  - `legacyStandings(response, leagueId: number, season: string): Record<string, DocumentData>` (contrato da tabela: só o grupo do 228, todos os números em string, rótulos de competição antigos).
  - `syncCompetitions(d: FootballDeps): Promise<{ count: number }>`: para cada competição atual, `rounds` → `data/rounds` `{ items: { raw; label }[]; current: string | null }`, `fixturesByLeague` → `data/fixtures` `{ items: { id; kickoff; round; roundLabel; home; away; status; score }[] }`; para ligas (`type` league ou europe) os 4 tops → `data/topscorers` etc. `{ items: { playerId; name; photo; teamId; teamName; value }[] }`.
  - `syncStandings(d)`: `refreshStandings` para cada competição atual.

- [ ] **Step 1: Escrever os testes.**
  - Unit `legacyStandings` com `standings-94.json`: id `"228_94_2026"`, `competition: "Primeira Liga"`, `points: "30"` (string), só as equipas do grupo do 228; liga 2 com fase de liga → `"UEFA Champions League"`.
  - Emulator `refreshStandings(94, "2026")` → `competitions/football_94_2026/data/standings.groups[0].rows` com 18 linhas e `standings/228_94_2026` com o contrato. Liga 550 → só o modelo novo, nenhum doc em `standings`.
  - `syncCompetitions` → `data/rounds.items` com `label: "J11"` para `"Regular Season - 11"`; `data/topscorers.items[0]` com `value` numérico; uma Taça não pede tops.
  - Resposta de standings vazia → o documento existente fica e `recordRun` com `count: 0`.
- [ ] **Step 2:** `npm test -- standingsLegacy && npm run test:emulator -- competitionSync`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(football): standings, rounds, competition fixtures and top players`.

### Task 10: Plantel, treinador, época, transferências, troféus e lesões

**Files:**
- Create: `functions/src/football/teamSync.ts`
- Modify: `functions/src/index.ts` (`footballSeasonSync` "0 5 * * *" chama `syncCompetitions` e `syncTeamDaily`; `footballWeeklySync` "30 5 * * 1" chama `syncTeamWeekly`)
- Test: `functions/test/emulator/teamSync.test.ts`

**Interfaces:**
- Consumes: `FootballDeps`, `writeDocs`, `currentCompetitions`, `syncCompetitions`.
- Produces (todos em `teams/football_228` e `teams/football_228/data/*`):
  - `syncTeamDaily(d): Promise<{ count: number }>`: `squad` → `data/squad` `{ players: { id; name; age; number; position; photo }[] }`; `coachs` → `data/coach` (treinador atual: o que tem `career` sem `end` na equipa 228); `playersBySeason` → `data/playerStats_{season}` `{ players: { id; name; photo; appearances; minutes; goals; assists; rating: number | null; yellow; red }[] }` (somando as competições); `teamStatistics` por competição atual → `data/teamStats_{leagueId}_{season}` `{ form; goals: { for: { total: { home; away; total }; minute: Record<string, { total; percentage }> }; against: { ... } }; fixtures; cleanSheet; failedToScore }`; `injuries({ team, season })` → `data/injuries` `{ items: { playerId; name; photo; type; reason; fixtureId; date }[] }` só os dos próximos 14 dias e dos últimos 3.
  - `syncTeamWeekly(d): Promise<{ count: number }>`: `transfers` → `data/transfers` (últimas 2 épocas); `trophies({ players })` em lotes de 20 com os ids do plantel e `trophies({ coach })` → `data/trophies` `{ byPlayer: Record<string, Trophy[]>; coach: Trophy[] }`; `sidelined(players)` em lotes de 20 → `data/sidelined` `{ byPlayer: Record<string, { type; start; end }[]> }`. Se a API rejeitar ids múltiplos (`errors.players`), repetir um a um e registar o número de chamadas.

- [ ] **Step 1: Escrever os testes (emulator).**
  - `syncTeamDaily` com as fixtures → `data/squad.players` com números e fotos; `data/coach.name` preenchido; `data/playerStats_2026` soma golos de duas competições do mesmo jogador; `data/teamStats_94_2026.form` é uma string; 2 páginas de jogadores → 2 chamadas.
  - `syncTeamWeekly` com 30 jogadores no plantel → 2 chamadas de troféus, 1 do treinador e 2 de `sidelined`; com `errors.players` na primeira resposta → cai para uma chamada por jogador.
  - Plantel vazio na resposta → `data/squad` existente fica e alerta `expectNonZero`.
- [ ] **Step 2:** `npm run test:emulator -- teamSync`. Esperado: falha.
- [ ] **Step 3:** Implementar e exportar as duas functions.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(football): squad, coach, season stats, transfers, trophies and injuries`.

### Task 11: Pré-jogo, lesões do jogo e estádio

**Files:**
- Create: `functions/src/football/prematchSync.ts`
- Modify: `functions/src/index.ts` (`footballPrematchSync` "every 6 hours")
- Test: `functions/test/emulator/prematchSync.test.ts`

**Interfaces:**
- Consumes: `FootballDeps`, `listFootballWindow`, `writeDocs`, `getMatch`.
- Produces:
  - `syncPrematch(d): Promise<{ count: number }>`: jogos `NS` com kickoff nas próximas 48 h e `matches/{id}/details/prematch.fetchedAt` com mais de 12 h (ou inexistente): `predictions(fixture)` → `details/prematch` `{ fetchedAt; advice; winner: { id; name; comment } | null; percent: { home; draw; away }; form: { home: string; away: string }; last5: { home; away }; h2h: { id; kickoff; home; away; score }[] }` (o h2h vem na própria resposta de previsões; não há chamada separada) e `injuries({ fixture })` → `details/injuries` `{ items: { teamId; playerId; name; photo; type; reason }[] }`.
  - Estádio: se `match.venue.id` existir e `venues/{id}` não, `venue(id)` → `venues/{id}` `{ name; city; address; capacity; surface; image }` e atualizar `matches/{id}.venue.capacity` e `.image` (estádio já em cache não gasta chamada).

- [ ] **Step 1: Escrever os testes (emulator).**
  - Jogo `NS` daqui a 30 h sem prematch → 2 chamadas (+1 de estádio) e `details/prematch.percent.home` igual à fixture.
  - Segunda execução 1 h depois → 0 chamadas.
  - Jogo daqui a 3 dias → 0 chamadas.
  - Estádio já em `venues/` → nenhuma chamada `venues`, mas `matches.venue.capacity` preenchido.
- [ ] **Step 2:** `npm run test:emulator -- prematchSync`. Esperado: falha.
- [ ] **Step 3:** Implementar e exportar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(football): pre-match predictions, form, h2h, injuries and venues`.

### Task 12: Ticker ao vivo (15 s durante o jogo)

**Files:**
- Create: `functions/src/football/liveTicker.ts`
- Modify: `functions/src/index.ts` (`footballLiveTicker`: "every 1 minutes", `timeoutSeconds: 75`, `maxInstances: 1`, `retryCount: 0`, `secrets: [RAPIDAPI_KEY]`)
- Test: `functions/test/unit/livePhase.test.ts`, `functions/test/emulator/liveTicker.test.ts`

**Interfaces:**
- Consumes: `FootballDeps`, `listFootballWindow`, `mapFixture`, `legacyFromFixture`, `saveMatch`, `getMatch`, `refreshStandings`, `runJob`.
- Produces:
  - `type Phase = "idle" | "prematch" | "live" | "postmatch" | "ratings"`
  - `phaseFor(m: MatchDoc, now: Date): Phase`: `prematch` se `NS` e `kickoff - 75 min <= now < kickoff`; `live` se `LIVE`/`HT`, ou `NS` com `kickoff <= now < kickoff + 4 h` (atraso no início); `postmatch` se final e `now < finishedAt + 25 min`; `ratings` se final e os minutos desde `finishedAt` forem 30, 60 ou 110 (minuto exato); `idle` em tudo o resto (incluindo `PST` e `CANC`).
  - `tick(d: FootballDeps & { sleep: (ms: number) => Promise<void> }): Promise<{ calls: number; ids: string[] }>`:
    - lê a janela `[now - 6 h, now + 75 min]`; sem nenhum jogo fora de `idle` → devolve `{ calls: 0 }` sem chamar a API;
    - algum `live` → até 4 iterações alinhadas a 0, 15, 30 e 45 s desde o início da invocação, cada uma com **uma** chamada `fixturesByIds` com todos os ids ativos (prematch e postmatch incluídos na mesma chamada), `mapFixture(..., { observedLive: true })`, `legacyFromFixture` e `saveMatch`; para quando nenhum jogo continua `live` ou quando passaram 50 s;
    - só `prematch`, `postmatch` ou `ratings` → uma iteração;
    - na primeira iteração de um minuto múltiplo de 15, para cada jogo `live`, `refreshStandings(leagueId, season)` se a competição não for `friendly`.
  - Constantes `LIVE_INTERVAL_MS = 15_000`, `LIVE_ITERATIONS = 4`, `PREMATCH_LEAD_MS = 75 * 60_000`, `POSTMATCH_TAIL_MS = 25 * 60_000`, `RATINGS_REFRESH_MIN = [30, 60, 110]`.

- [ ] **Step 1: Testes unitários de `phaseFor`:** NS a 80 min → idle; NS a 70 min → prematch; NS 5 min depois do kickoff → live; `HT` → live; `FT` com `finishedAt` há 10 min → postmatch; há 30 min → ratings; há 31 min → idle; `PST` com kickoff há 10 min → idle.
- [ ] **Step 2: Testes no emulator** (`now` e `sleep` falsos, `fakeFetch` com uma sequência de respostas):
  - Sem jogos na janela → `calls: 0` e nenhum pedido ao `fakeFetch`.
  - Jogo `LIVE` → `calls: 4`; `sleep` chamado com 15.000 ms três vezes (ou o necessário para alinhar); `games/{id}.elapsedTime` e `matches/{id}.elapsed` com o valor da 4.ª resposta.
  - Duas respostas iguais seguidas → a segunda iteração escreve 0 documentos.
  - **Review Focus 3:** sequência `2H` 90' → `ET` 105' → `P` → `PEN`, `now` a avançar 15 s → o ticker mantém 4 chamadas por minuto em `ET` e `P`; ao ver `PEN`, `finishedAt` = `now` dessa iteração e `finishedAtSource: "observed"`; `games.scorehome/scoreaway` = golos com prolongamento; `score.penalty` preenchido.
  - **Review Focus 2:** a meio do jogo a API devolve `errors-ratelimit.json` → os detalhes existentes ficam, `ingestHealth/football_live.consecutiveFailures === 1`, e a iteração seguinte continua.
  - Jogo `NS` a 60 min do início → 1 chamada; com lineups na resposta → `details/lineups` e `lineups/*` escritos.
  - Minuto :15 com jogo `live` da liga 94 → 1 chamada extra de `standings`.
  - Jogo `PST` → 0 chamadas.
- [ ] **Step 3:** `npm test -- livePhase && npm run test:emulator -- liveTicker`. Esperado: falha.
- [ ] **Step 4:** Implementar e exportar.
- [ ] **Step 5:** Repetir. Esperado: passa.
- [ ] **Step 6:** Commit `feat(football): live ticker polling every 15s during sporting matches`.

### Task 13: Vídeos (VSports)

**Files:**
- Create: `functions/src/videos/videosSync.ts`
- Modify: `functions/src/index.ts` (`videosSync` "every 5 minutes", `secrets: [VSPORTS_KEY]`)
- Test: `functions/test/unit/videosMap.test.ts`, `functions/test/emulator/videosSync.test.ts`

**Interfaces:**
- Consumes: `vsports`, `vsportsSeasonId`, `listFootballWindow`, `writeDocs`, `legacyCollection`.
- Produces:
  - `VSPORTS_ROUNDS = ["1", "7", "9"]`, `VSPORTS_SPORTING_ID = "6"`.
  - `embedSrc(embed: string): string | null`: se não contiver `<`, é já o URL; senão o `src` do primeiro `<iframe>`, com `&amp;` → `&`; `null` se não houver.
  - `videoType(t: string): "golo" | "resumo" | "flash_interview" | "outro"` (`goal`, `resume`, `flash`, resto).
  - `lisbonDayKey(d: Date): string` no formato `D/M/YYYY` sem zeros à esquerda (como o `dt` da VSports), calculado em `Europe/Lisbon`.
  - `syncVideos(d: { db; vs: VsportsClient; now: () => Date; prefix?: string }): Promise<{ count: number }>`:
    - jogos de futebol fora da Champions (`competition.id !== "2"`) com kickoff em `[now - 48 h, now]`; nenhum → 0 chamadas;
    - cada 5 min entre kickoff e kickoff + 6 h; depois disso só quando o minuto atual é 0 (de hora a hora);
    - as 3 rondas uma vez por execução; cada jogo VSports com o Sporting (`hteam.id` ou `ateam.id` `"6"`) e `dt` igual ao dia do jogo → `videosByMatch`;
    - modelo novo: todos os vídeos com `embedSrc` em `matches/{id}/videos/{videoId}` `{ id; title; minute: string | null; type; thumbnail: bigpic; embedSrc; videoUrl: links.embed; publishedAt }`;
    - antigo: só `goal`/`resume`/`flash` e `parseInt(id) >= 1210619`, em `videos/{vdo.id}` com o contrato.

- [ ] **Step 1: Testes unitários:** `embedSrc('<div><iframe src="https://x.pt/e/1?a=1&amp;b=2"></iframe><script>…</script></div>') === "https://x.pt/e/1?a=1&b=2"`; `embedSrc("https://x.pt/e/1")` → o mesmo; `embedSrc("<div></div>") === null`; `videoType("flash") === "flash_interview"`, `("pressconf") === "outro"`; `lisbonDayKey(new Date("2026-11-08T23:30:00Z")) === "8/11/2026"`, `(new Date("2026-08-01T23:30:00Z")) === "2/8/2026"` (verão, já é dia 2 em Lisboa).
- [ ] **Step 2: Testes no emulator:** jogo há 1 h → 3 + 1 chamadas, `matches/{id}/videos` com todos os tipos e `videos/*` só com os três tipos antigos e `videoUrl` igual ao HTML original; jogo da Champions → ignorado; nenhum jogo nas 48 h → 0 chamadas; jogo há 10 h e minuto 7 → 0 chamadas.
- [ ] **Step 3:** Correr. Esperado: falha.
- [ ] **Step 4:** Implementar e exportar.
- [ ] **Step 5:** Correr. Esperado: passa.
- [ ] **Step 6:** Commit `feat(videos): vsports videos with embed src and legacy videoUrl`.

### Task 14: Notícias RSS e tweets

**Files:**
- Create: `functions/src/news/newsSync.ts`, `functions/src/social/tweetsSync.ts`
- Modify: `functions/src/index.ts` (`newsSync` "every 15 minutes"; `tweetsSync` "0 */10 * * *" com `secrets: [TWITTER_BEARER_TOKEN]`)
- Test: `functions/test/unit/news.test.ts`, `functions/test/emulator/newsSync.test.ts`, `functions/test/emulator/tweetsSync.test.ts`

**Interfaces:**
- Consumes: `fetchFeed`, `twitter`, `writeDocs`, `legacyCollection`, `runJob`.
- Produces:
  - `NEWS_SOURCES = [{ name: "Maisfutebol", url: "https://maisfutebol.iol.pt/rss" }, { name: "Record", url: "https://www.record.pt/rss" }]`
  - `slugifyUrl(url)` e `isSportingCPArticle(item)` portados tal e qual (incluindo a lista de falsos positivos).
  - `detectSport(item: FeedItem): Sport`: pelo URL primeiro (`/futsal/`, `/andebol/`, `/hoquei`, `/voleibol/`, `/basquetebol/`), depois por palavras no título e resumo (`futsal`, `andebol`, `hóquei`/`hoquei`, `voleibol`, `basquetebol`/`basquete`); por omissão `football`.
  - `summarize(text: string, max = 400): string` (corta na última palavra inteira e acrescenta `…`).
  - `syncNews(d: { db; fetch: FetchFn; now: () => Date; prefix?: string }): Promise<{ count: number }>`: `news/{slug}` com o contrato antigo + `sport` + `publishedAt` (Timestamp), `merge: true`; uma fonte a falhar não impede a outra e regista `ingestHealth/news_{nome}`.
  - `syncTweets(d: { db; tw: TwitterClient; prefix?: string }): Promise<{ count: number }>`: utilizadores `21389998` (SportingCP) e `60026862` (scpmodalidades), documento com o contrato antigo.

- [ ] **Step 1: Testes.**
  - Unit: `detectSport` com URL `record.pt/modalidades/futsal/...` → `futsal`; título "Sporting vence no andebol" → `handball`; "Hóquei: Sporting..." → `roller_hockey`; notícia de futebol → `football`. `isSportingCPArticle` rejeita "Sporting de Braga" e aceita `/sporting/` no URL do Maisfutebol. `summarize` de 600 caracteres → ≤ 401 e acaba em `…`.
  - Emulator: `syncNews` com as duas fixtures → `news/{slug}` com `created_at` em ISO, `content === summary`, `sport` e `source`; a mesma notícia duas vezes não duplica; o feed do Record a dar 500 → o Maisfutebol grava na mesma e `ingestHealth/news_Record.lastError` preenchido.
  - Emulator: `syncTweets` com `user-tweets.json` → `tweets/{id}` com `text` do `note_tweet` quando existe, `media` com `url` ou `preview_image_url`, e as 6 métricas.
- [ ] **Step 2:** Correr. Esperado: falha.
- [ ] **Step 3:** Implementar e exportar.
- [ ] **Step 4:** Correr. Esperado: passa.
- [ ] **Step 5:** Commit `feat(news): rss news with sport and source, and tweets on admin sdk`.

### Task 15: Porta da liquidação antiga dos palpites da V2

**Files:**
- Create: `functions/src/legacy/predictionSettlement.ts`
- Modify: `functions/src/index.ts` (`legacyPredictionSettlement` "every 5 minutes"; não corre se `LEGACY_COLLECTION_PREFIX.value() !== ""`)
- Test: `functions/test/emulator/legacySettlement.test.ts`

**Interfaces:**
- Consumes: `getMatch`, `FINAL_STATUSES`.
- Produces:
  - `settleLegacyPredictions(db: Firestore, now: Date): Promise<{ games: number; predictions: number }>`: igual a `legacy/v2-functions/src/services/predictionSettlement.ts` (lê `games` dos últimos 3 dias sem `predictionsSettled`; `predictions` com `gameId == api` e `scored == false`; acerto exato por comparação de strings com `scorehome`/`scoreaway`; `rankings/{userId}_{season}` +3; `point_events/exact_score_{api}_{userId}`; `predictionsSettled: true` em `games`), com **uma** diferença: o jogo só conta como terminado se `matches/{api}.status` estiver em `FINAL_STATUSES` e `finishedAt <= now` (em vez de `isActive === false && endTime <= now`).
  - Os documentos com `source` (v2027) nunca são tocados (as callables novas escrevem em `matchPredictions`, mas fica a guarda).

- [ ] **Step 1: Escrever os testes (emulator).**
  - Jogo `FT` 2-1 terminado há 10 min, palpites 2-1 e 1-1 (`scored: false`) → o 2-1 fica `scored: true, correct: true`, `rankings/alice_2026-2027.points` +3, `point_events/exact_score_1001_alice` com `type: "exact_score"`; o 1-1 fica `correct: false`; `games/1001.predictionsSettled === true`.
  - Segunda execução → nada muda (pontos continuam +3).
  - **Review Focus 1:** jogo `PST` com `games.endTime` no passado e `isActive: false`, palpite 0-0 → não é liquidado e `predictionsSettled` fica ausente.
  - Jogo `LIVE` → não é liquidado.
- [ ] **Step 2:** Correr. Esperado: falha.
- [ ] **Step 3:** Implementar e exportar.
- [ ] **Step 4:** Correr. Esperado: passa.
- [ ] **Step 5:** Commit `feat(legacy): port v2 exact-score settlement to admin sdk with real status`.

### Task 16: Andebol, voleibol e basquetebol (API-Sports)

**Files:**
- Create: `functions/src/modalities/apiSportsSync.ts`
- Modify: `functions/src/index.ts` (`apiSportsSync` "every 10 minutes", `secrets: [RAPIDAPI_KEY]`)
- Modify: `functions/test/unit/model.test.ts` (casos de `roundLabel` com os textos reais recolhidos na Task 1)
- Test: `functions/test/unit/apiSportsMap.test.ts`, `functions/test/emulator/apiSportsSync.test.ts`

**Interfaces:**
- Consumes: `apiSports`, `API_SPORTS` (Task 1), `apiSportsStatus`, `competitionLabel`, `roundLabel`, `saveMatch`, `writeDocs`, `runJob`. As ligas com `covered: false` não são pedidas aqui: são tratadas pela `freeSourcesSync` (Task 17, via `API_SPORTS_GAPS`).
- Produces:
  - `mapApiSportsGame(sport, g): MatchDoc`: id `hb_`/`vb_`/`bb_` + `g.id`; `score` = golos ou pontos; voleibol: `score.home/away` = sets ganhos e `score.sets` = parciais; `source.provider = "api-" + sport`; `competition.name` em pt-PT (ex. `"Andebol 1"`, `"Liga dos Campeões"`, valores da Task 1).
  - `apiSportsDue(state: { lastRunAt: Date | null }, matches: MatchDoc[], now: Date): boolean`: verdadeiro se houver um jogo da modalidade em `[kickoff - 15 min, kickoff + 3 h]` ou se `lastRunAt` tiver mais de 3 h.
  - `syncApiSports(d: { db; clients: Record<"handball" | "volleyball" | "basketball", ApiSportsClient>; now: () => Date }): Promise<{ count: number }>`: por modalidade, se `apiSportsDue`: `games({ team, season })` → `saveMatch` (só modelo novo); de 6 em 6 horas `standings` de cada liga coberta → `competitions/{key}/data/standings`; regista `ingestHealth/apisports_{sport}` com `expectNonZero` entre setembro e junho.

- [ ] **Step 1: Testes.**
  - Unit: `games.json` de cada modalidade → `MatchDoc` com o id prefixado, estado mapeado, competição em pt-PT e `roundLabel` dos textos reais; voleibol 3-1 com os 4 parciais.
  - Unit: `apiSportsDue` com jogo a começar daqui a 10 min → true; sem jogos e última execução há 2 h → false; há 3 h e 1 min → true.
  - Emulator: execução com tudo devido → 3 chamadas de jogos + as de classificações; segunda execução 10 min depois sem jogos → 0 chamadas; a modalidade com `getMatch` de um jogo `locked` não o reescreve.
  - Emulator: liga marcada `covered: false` → nenhuma chamada de classificação para essa liga.
- [ ] **Step 2:** Correr. Esperado: falha.
- [ ] **Step 3:** Implementar e exportar.
- [ ] **Step 4:** Correr. Esperado: passa.
- [ ] **Step 5:** Commit `feat(modalities): handball, volleyball and basketball from api-sports`.

### Task 17: Futsal e hóquei em patins (fontes gratuitas, reconciliação e alertas)

**Files:**
- Create: `functions/src/sources/free/<key>.ts` (uma por fonte escolhida na Task 1), `functions/src/modalities/freeSourcesSync.ts`
- Modify: `functions/package.json` (só se a Task 1 escolher HTML: `cheerio` ^1)
- Modify: `functions/src/index.ts` (`freeSourcesSync` "every 15 minutes")
- Test: `functions/test/unit/freeSources.test.ts`, `functions/test/unit/reconcile.test.ts`, `functions/test/emulator/freeSourcesSync.test.ts`

**Interfaces:**
- Consumes: `FREE_SOURCES`, `API_SPORTS_GAPS`, `FreeSourceRef` (Task 1), `getText`/`getJson`, `saveMatch`, `getMatch`, `recordRun`, `roundLabel`, `competitionLabel`.
- Produces:
  - `interface NormalizedMatch { sourceKey: string; sourceId: string; sport: Sport; competition: { name: string; round: string | null; type: CompetitionType }; kickoff: Date; home: TeamRef; away: TeamRef; status: GameStatus; score: Pair; venue: string | null }`
  - `interface MatchSource { key: string; sport: Sport; fetchMatches(f: FetchFn, season: string, now: Date): Promise<NormalizedMatch[]> }`, uma implementação por fonte, só com parsing (sem escrita).
  - `opponentSlug(name: string): string` (minúsculas, sem acentos, sem "SC", "CF", "FC", "Clube", "de", pontuação).
  - `reconcile(existing: MatchDoc[], primary: NormalizedMatch[] | Error, fallback: NormalizedMatch[] | Error, prefix: "fs" | "hq" | ...): { matches: MatchDoc[]; used: "primary" | "fallback" | "merged" | "none"; alerts: string[] }`:
    - o mesmo jogo = mesmo `opponentSlug` e mesma competição com kickoff a menos de 3 dias;
    - id = o do documento existente se houver correspondência, senão `${prefix}_${sourceKey}_${sourceId}`;
    - campos da principal; a de recurso só preenche nulos (resultado, local) e guarda `source.fallbackUsed: true` quando é ela que dá o jogo;
    - nunca devolve remoções: um jogo existente que deixou de aparecer fica como está;
    - alertas: principal com erro; principal com 0 jogos e recurso com > 0; ambas a 0 entre setembro e junho; diferença de resultado entre fontes num jogo final.
  - `syncFreeCompetition(d: { db; fetch: FetchFn; now: () => Date }, ref: { sport; primary: MatchSource; fallback: MatchSource; prefix }): Promise<{ count: number }>`
  - `syncFreeSources(d)`: futsal, hóquei e lacunas; cada uma devida cada 15 min em janela de jogo (`kickoff - 15 min` a `kickoff + 3 h`) e cada 6 h fora dela (estado em `ingestState/free_{key}`), para não sobrecarregar as fontes.

- [ ] **Step 1: Testes.**
  - Unit (um bloco por fonte): a amostra gravada na Task 1 → número exato de jogos, um jogo passado com resultado e um futuro com hora, competição e ronda; página vazia → `[]`; HTML ou JSON sem a estrutura esperada → `SourceError` com `kind: "parse"` (nunca `[]` silencioso).
  - Unit `reconcile`: as duas fontes com o mesmo jogo ("Sporting CP" vs "SL Benfica" e "Sporting" vs "Benfica", kickoff igual) → 1 jogo, `used: "merged"`; principal com erro → jogos da recurso e alerta; **Review Focus 5:** principal com 0 jogos em novembro e 5 existentes → os 5 existentes não são removidos e há alerta; jogo adiado 2 dias na principal → mantém o id existente com a nova hora.
  - Unit: `roundLabel` com os textos reais das fontes (ex. "Jornada 11" → "J11", "1/8 Final" → "Oitavos de final"), acrescentados a `model.test.ts`.
  - Emulator: `syncFreeSources` com `fakeFetch` das amostras → `matches/fs_*` e `matches/hq_*` escritos, `ingestHealth/free_<key>` com `lastCount`; segunda execução 15 min depois fora de janela → 0 pedidos.
- [ ] **Step 2:** Correr. Esperado: falha.
- [ ] **Step 3:** Implementar as fontes e a reconciliação e exportar.
- [ ] **Step 4:** Correr. Esperado: passa.
- [ ] **Step 5:** Commit `feat(modalities): futsal and roller hockey from free sources with reconciliation and alerts`.

### Task 18: Regras para o modelo novo e `config/app`

**Files:**
- Modify: `firestore.rules`
- Modify: `functions/test/emulator/rules.phase1.test.ts`
- Create: `functions/scripts/seed-config.ts`, `functions/seed/config-app.json`
- Test: `functions/test/emulator/seedConfig.test.ts`

**Interfaces:**
- Produces:
  - Regras: leitura pública de `matches/{id}`, `matches/{id}/{sub=**}`, `competitions/{id}`, `competitions/{id}/{sub=**}`, `teams/{id}`, `teams/{id}/{sub=**}`, `venues/{id}`, `config/{id}`; escrita negada a todos os clientes nessas coleções; `ingestHealth`, `ingestState` e qualquer `_shadow_*` sem leitura nem escrita. O cabeçalho deixa de dizer "DO NOT DEPLOY" e passa a dizer "publicar só depois de apagar as functions antigas (Plano 2, Task 21)". O resto da fase 1 não muda.
  - `config/app`: `{ minVersion: { ios: "0.0.0", android: "0.0.0" }, texts: { updateRequiredTitle: "Atualização obrigatória", updateRequiredBody: "Há uma versão nova da S360. Atualiza a app para continuar.", updateButton: "Atualizar" }, comunidadeLeonina: { name: string; description: string | null; image: string | null; links: { twitter?: string; patreon?: string; youtube?: string } }[], updatedAt }` (a versão mínima sobe no Plano 5).
  - `seedConfig(db: Firestore, data: AppConfig, o: { force: boolean }): Promise<"created" | "exists" | "overwritten">` e o script `npx tsx scripts/seed-config.ts --project <id> [--force]` que a chama com credenciais ADC.

- [ ] **Step 1: Escrever os testes.**
  - Regras: leitura anónima de `matches/1001`, `matches/1001/details/events`, `matches/1001/videos/v1`, `competitions/football_94_2026/data/standings`, `teams/football_228/data/squad`, `venues/1`, `config/app`: permitida. Escrita autenticada em todas essas: negada. Leitura anónima de `ingestHealth/x`, `ingestState/x`, `_shadow_games/x`: negada. Todos os testes da fase 1 continuam.
  - `seedConfig` sem documento → `"created"`; com documento → `"exists"` e conteúdo intacto; com `force` → `"overwritten"`. O JSON de seed valida contra o tipo `AppConfig` (o teste importa-o).
- [ ] **Step 2:** `npm run test:emulator -- rules.phase1 seedConfig`. Esperado: falha.
- [ ] **Step 3:** Escrever as regras, a seed e o script. A lista `comunidadeLeonina` vem do Figma (ficheiro `R3IhhyNxNZuVINgUtJjZE3`, página "Last Version S360", ecrã Comunidade Leonina) se houver acesso ao Figma; senão fica `[]` e o Martim preenche antes da Task 21.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(rules,config): public read for the new model and app config seed`.

### Task 19: Pendentes menores do Plano 1

**Files:**
- Create: `functions/src/callables/validation.ts`
- Modify: `functions/src/callables/submitPrediction.ts`, `voteMvp.ts`, `functions/src/points/ledger.ts`, `functions/src/scheduled/settle.ts`, `functions/src/time/periods.ts`
- Modify: `functions/test/unit/periods.test.ts`, `result.test.ts`, `windows.test.ts`, `mvp.test.ts`, `functions/test/emulator/ledger.test.ts`, `settle.test.ts`

**Interfaces:**
- Produces: `validGameId(v: unknown): v is string` em `callables/validation.ts` (não vazio, sem `/`, diferente de `"none"`); `awardPoints` lança `Error` com uid ou gameId vazio ou com `/`, `periods: []`, `gameDate` inválida ou `type` desconhecido; `settleGame` não reescreve `settledAt` de um jogo já liquidado; `settleDue` faz `logger.warn` quando `getGameState` devolve null.

Ficam fora (decisão): o risco +1 ilimitado em `rankings` já está no cabeçalho das regras; o email como `userName` nos `rankings` da V2 e o reset final ficam para o corte do Plano 5; `idEndsWithUid('_uid')` é inofensivo.

- [ ] **Step 1: Escrever os testes.**
  - `periodKeys(new Date("2026-07-12T23:30:00Z")).week === "2026-W29"`; `(new Date("2026-12-27T23:30:00Z")).week === "2026-W52"`; `(new Date("2026-12-28T00:00:00Z")).week === "2026-W53"`; `season` de 2026-12-15 e de 2027-01-15 → `"2026-2027"`.
  - `countedScore` com `FT`, `AET` e `PEN` e golos null → null.
  - `mvpWindow` com `LIVE` e `elapsed` 95 e 105 → `open`.
  - `officialMvpIds` com rating `NaN` → ignorado.
  - `awardPoints` com `uid: ""`, `gameId: "a/b"`, `periods: []`, `gameDate: new Date("x")` → rejeita.
  - `settleGame` chamado duas vezes → `settlements/{id}.settledAt` igual ao da primeira.
  - `validGameId("none") === false`.
- [ ] **Step 2:** Correr unit e emulator. Esperado: os novos falham.
- [ ] **Step 3:** Implementar e acrescentar a `periods.ts` o comentário sobre o padrão `toZonedTime` + getters locais.
- [ ] **Step 4:** `npm run lint && npm test && npm run test:emulator`. Esperado: tudo passa.
- [ ] **Step 5:** Commit `fix: plan 1 deferred minors (validation, periods, settle idempotency)`.

### Task 20: Ferramentas de publicação e verificação

**Files:**
- Create: `functions/scripts/deployLists.ts`, `functions/scripts/compare-legacy.ts`, `functions/scripts/check-predeploy.ts`, `functions/.env.scp360-37a74`
- Create: `functions/test/unit/exports.test.ts`, `functions/test/unit/compareLegacy.test.ts`
- Create: `docs/superpowers/notes/2026-12-0x-publicacao-plano2.md` (comandos exatos da Task 21, orçamento RapidAPI desta página, e o procedimento de reverter)

**Interfaces:**
- Produces:
  - `DEPLOY_DATA_FUNCTIONS = ["footballFixturesSync", "footballPostMatchSync", "footballLiveTicker", "footballStandingsSync", "footballSeasonSync", "footballWeeklySync", "footballPrematchSync", "videosSync", "newsSync", "tweetsSync", "apiSportsSync", "freeSourcesSync"] as const`, `DEPLOY_CUTOVER_FUNCTIONS = ["legacyPredictionSettlement"]`, `DEPLOY_ENGINE_FUNCTIONS = ["submitPrediction", "voteMvp", "settleScheduler"]` e `LEGACY_FUNCTIONS = ["gamesSheduler", "liveMatchUpdater", "summarySheduler", "statisticsSheduler", "newsSheduler", "twitterScheduler", "videosSheduler", "PlayersSheduler", "lineupsheduler", "standingsSheduler", "predictionsSettlementScheduler", "games", "backfill"]`, em `scripts/deployLists.ts`, e `deployArg(names): string` = `functions:v2027:a,functions:v2027:b`.
  - `diffLegacy(a: Record<string, DocumentData>, b: Record<string, DocumentData>, ignore: string[]): { missing: string[]; extra: string[]; changed: { id: string; field: string; a: unknown; b: unknown }[] }` e o script `npx tsx scripts/compare-legacy.ts --project scp360-37a74 --since <ISO>` (só leitura) que compara `_shadow_<col>` com `<col>` para os documentos atualizados desde `--since`, ignorando `_ingest`, e as diferenças esperadas (`isActive`, `endTime`, e jogos de competições que a função antiga não pedia).
  - `scripts/check-predeploy.ts --project scp360-37a74` (só leitura): (a) todos os `rankings` têm `season` string `^\d{4}-\d{4}$` e id `== userId_season`; (b) nenhum `predictions` nem `manofmatch` com campo `source`; (c) lista as functions publicadas (via `firebase functions:list --json`) e falha se houver alguma fora de `LEGACY_FUNCTIONS` e das `v2027` (ex. um `cleanup` antigo); imprime contagens e sai com código 1 se algo falhar.
  - `functions/.env.scp360-37a74` com `LEGACY_COLLECTION_PREFIX=_shadow_` (fase sombra).

- [ ] **Step 1: Escrever os testes.**
  - `exports.test.ts`: importar `src/index.ts` com os segredos simulados; o conjunto dos exports é exatamente `DEPLOY_DATA_FUNCTIONS ∪ DEPLOY_CUTOVER_FUNCTIONS ∪ DEPLOY_ENGINE_FUNCTIONS`; nenhum nome coincide com `LEGACY_FUNCTIONS`; `deployArg(["a","b"]) === "functions:v2027:a,functions:v2027:b"`.
  - `compareLegacy.test.ts`: documentos iguais → sem diferenças; `_ingest` ignorado; `scorehome` `"1"` vs `1` → `changed` (o tipo conta); id só de um lado → `missing`/`extra`.
- [ ] **Step 2:** `npm test -- exports compareLegacy`. Esperado: falha.
- [ ] **Step 3:** Implementar os scripts e escrever o documento de publicação com os comandos da Task 21 já gerados por `deployArg`.
- [ ] **Step 4:** `npm run lint && npm test && npm run test:emulator`. Esperado: tudo passa. `grep -rnE "AIza|msh[0-9a-z]{10,}|Bearer [A-Za-z0-9%]{20,}" functions/src functions/test functions/scripts docs` não devolve nada.
- [ ] **Step 5:** Commit `chore: deploy lists, legacy comparison and pre-deploy checks`.

### Task 21: Publicação (paragens com o Martim)

Ordem obrigatória. Cada **PARAGEM** espera o OK explícito do Martim. O documento da Task 20 tem os comandos completos; aqui ficam os essenciais. Os nomes antigos estão em `us-central1` (codebase por omissão); os novos em `europe-west1` (codebase `v2027`).

**Files:**
- Modify: `functions/.env.scp360-37a74` (prefixo `_shadow_` → vazio no corte)
- Modify: `functions/test/fixtures/**` (fixtures reais gravadas)
- Modify: `docs/superpowers/plans/2026-11-17-v2027-roadmap.md` (estado do Plano 2)

- [ ] **Step 1 (local):** `npm run lint && npm test && npm run test:emulator`. Esperado: tudo passa.
- [ ] **Step 2 (PARAGEM: credenciais do Martim, só leitura):** `npx tsx scripts/check-predeploy.ts --project scp360-37a74`. Esperado: saída 0, sem `rankings` fora do formato, sem `predictions`/`manofmatch` com `source`, e só as 13 functions antigas conhecidas. Confirmar no painel da RapidAPI que o plano da API-Football é Pro ou superior (orçamento ≈800/dia em dia de jogo) e que existem subscrições de andebol, voleibol e basquetebol.
- [ ] **Step 3 (PARAGEM: segredos, valores escritos pelo Martim no terminal dele):** `firebase functions:secrets:set RAPIDAPI_KEY --project scp360-37a74`, o mesmo para `VSPORTS_KEY` e `TWITTER_BEARER_TOKEN`. Valores atuais (sem rotação). Nada vai para o repositório.
- [ ] **Step 4 (PARAGEM: o Martim corre com a chave no ambiente):** `RAPIDAPI_KEY=… VSPORTS_KEY=… npx tsx scripts/record-fixtures.ts --fixture <id de um jogo recente terminado>`; copiar as respostas reais para as fixtures, correr os testes e corrigir os mapeamentos se a forma real diferir. Commit `test: real recorded api fixtures`.
- [ ] **Step 5 (PARAGEM: índices):** `firebase firestore:indexes --project scp360-37a74 > /tmp/prod-indexes.json`, juntar os índices de produção ao `firestore.indexes.json` (para o deploy não propor apagá-los), e `firebase deploy --only firestore:indexes --project scp360-37a74`. Se o CLI perguntar se apaga índices, responder **não**.
- [ ] **Step 6 (PARAGEM: modo sombra):** com `LEGACY_COLLECTION_PREFIX=_shadow_`, `firebase deploy --only <deployArg(DEPLOY_DATA_FUNCTIONS)> --project scp360-37a74`. Verificar na consola que as 13 antigas continuam ativas e que as 12 novas correm sem erros; `ingestHealth/*` com `lastOkAt` recente.
- [ ] **Step 7 (verificação):** depois de pelo menos um `footballFixturesSync`, um `newsSync`, um `footballStandingsSync` e, se possível, um jogo do Sporting, `npx tsx scripts/compare-legacy.ts --project scp360-37a74 --since <hora do Step 6>`. Esperado: zero diferenças fora das documentadas. Conferir no painel RapidAPI o consumo real do dia face ao orçamento.
- [ ] **Step 8 (PARAGEM: corte dos writers):** mudar `LEGACY_COLLECTION_PREFIX` para vazio; `firebase deploy --only <deployArg([...DEPLOY_DATA_FUNCTIONS, ...DEPLOY_CUTOVER_FUNCTIONS])> --project scp360-37a74`; logo a seguir, apagar as antigas por nome: `firebase functions:delete gamesSheduler liveMatchUpdater summarySheduler statisticsSheduler newsSheduler twitterScheduler videosSheduler PlayersSheduler lineupsheduler standingsSheduler predictionsSettlementScheduler games backfill --region us-central1 --project scp360-37a74` (confirmar a lista no prompt; sem `--force`). Verificar: `firebase functions:list` só mostra as `v2027`; nos logs das antigas não há invocações depois da hora do corte; `games/{próximo jogo}._ingest === "v2027"`; apagar as coleções `_shadow_*`.
- [ ] **Step 9 (PARAGEM: preencher o modelo novo):** `RAPIDAPI_KEY=… npx tsx scripts/backfill-season.ts --project scp360-37a74 --new-model-only` (época atual, `fixtures?ids` em lotes de 20).
- [ ] **Step 10 (PARAGEM: regras):** repetir o Step 2; `firebase deploy --only firestore:rules --project scp360-37a74`. Logo a seguir, num telemóvel com a V2 de produção: entrar com email; sair e entrar por PIN; trocar de conta (multi-conta) e voltar; GameBox: criar, editar e apagar; fazer um prognóstico e votar no MVP num jogo; ver o ranking; abrir as notícias e os tweets; abrir o detalhe de um jogo recente (sumário, estatísticas, formações, jogadores, vídeos) e a classificação. Ver nos logs que nenhuma escrita é negada (`PERMISSION_DENIED`) e que nenhuma das antigas voltou a correr. Se algo falhar: consola Firebase → Firestore → Regras → versão anterior.
- [ ] **Step 11 (PARAGEM: motor do Plano 1):** `firebase deploy --only functions:v2027:submitPrediction,functions:v2027:voteMvp,functions:v2027:settleScheduler --project scp360-37a74`. Verificar que a `settleScheduler` corre cada 10 minutos e devolve 0 sem jogos por liquidar.
- [ ] **Step 12 (PARAGEM: alertas e config):** criar a métrica de logs `ingest_alert` (filtro `jsonPayload.message="INGEST_ALERT"` ou `textPayload:"INGEST_ALERT"`) e uma política de alerta por email para o endereço que o Martim indicar (`gcloud logging metrics create` + `gcloud alpha monitoring policies create`, comandos no documento da Task 20). `npx tsx scripts/seed-config.ts --project scp360-37a74`.
- [ ] **Step 13:** atualizar o roteiro (Plano 2 concluído, data) e commit `docs: plan 2 deployed`. Push do branch `v2027` só com o OK do Martim.

---

## Calendário indicativo

| Dias | Tasks |
|---|---|
| 24/11 | 1, 2 |
| 25/11 | 3, 4 |
| 26/11 | 5, 6 |
| 27/11 | 7, 8 |
| 28/11 | 9, 10, 11 |
| 30/11 a 1/12 | 12, 13 |
| 1/12 | 14, 15 |
| 2/12 | 16, 17 |
| 3/12 | 18, 19, 20 |
| 4/12 | 21 (paragens, com o Martim) |

As Tasks 13 a 17 só dependem das Tasks 1, 2, 3 e 6 e podem trocar de ordem. A 12 depende das 7 e 9. A 21 depende de todas.
