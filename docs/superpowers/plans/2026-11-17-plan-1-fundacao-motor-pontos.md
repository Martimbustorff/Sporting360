# Plano 1: Fundação e motor de pontos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pôr o backend no repositório do Martim, endurecer as regras do Firestore sem partir a app atual, e ter o motor de prognósticos, MVP, pontos e ranking a correr só no servidor e testado.

**Architecture:** Pasta `functions/` (TypeScript, Firebase Functions v2, Node 22) no repositório `Martimbustorff/Sporting360`. A lógica pura (períodos, janelas, scoring, MVP oficial) fica separada do acesso ao Firestore e é testada com Jest. As callables, a liquidação e as regras são testadas no Firebase Emulator. As coleções atuais (`games`, `players`) são lidas através de um adaptador, para o Plano 2 poder mudar o modelo sem tocar no motor.

**Tech Stack:** Node 22, TypeScript 5, firebase-functions 7.x, firebase-admin 13.x, firebase-tools 15.x (emulator), Jest + ts-jest, @firebase/rules-unit-testing 6.x, date-fns + date-fns-tz.

**Spec:** `docs/superpowers/specs/2026-11-17-scp360-v2027-design.md` (secções 6, 7, 8 e 9)

## Global Constraints

- Projeto Firebase: `scp360-37a74`. Firestore em `eur3`. Não se cria outro projeto.
- Os pontos são escritos **só** pelo servidor (Admin SDK). A app nunca escreve em `pointEvents` nem em `leaderboards`.
- Participação: +1 por prognóstico, +1 por voto MVP. Exato +3. Vencedor ou empate certo sem exato: +1. MVP certo: +2. Máximo de 4 por prognóstico e 3 pelo MVP.
- Resultado que conta: final com prolongamento, sem penáltis. Decidido nos penáltis = empate.
- Prognóstico fecha à hora oficial de início. MVP abre ao minuto 80 e fecha 20 minutos depois do apito final. Liquidação do MVP 2 horas depois do apito final.
- MVP oficial: jogador do Sporting que jogou com o maior rating da API-Football; empate = todos certos.
- Períodos em hora de Lisboa (`Europe/Lisbon`): semana de segunda a domingo (ISO), mês civil, época de 1 de julho a 30 de junho, no formato `2026-2027`.
- Os pontos contam na **data do jogo** (kickoff), não na data da liquidação.
- O ranking nunca expõe o email; usa `displayName`.
- Nada deste plano pode partir a app atual em produção (V2, Expo 54) antes do corte do Plano 5.
- Todos os utilizadores começam com **0 pontos** na app nova; não há migração da coleção `rankings` antiga.
- A chave RapidAPI nunca entra no repositório; vai para o Secret Manager como `RAPIDAPI_KEY`.

## Review Focus

1. **Jogo adiado ou com hora alterada depois de haver prognósticos** → o prognóstico continua válido e a janela segue a nova hora; nada é liquidado antes de o jogo acabar. (Teste na Task 5.)
2. **Liquidação corrida duas vezes** (retry da Cloud Function) → os pontos não duplicam. (Teste na Task 8.)
3. **Jogo decidido nos penáltis** → conta como empate: quem previu 1-1 e o jogo acabou 1-1 a.p. ganha o exato. (Teste na Task 4.)
4. **Utilizador sem `displayName`** → aparece no ranking como "Sportinguista #" + os 4 últimos caracteres do uid, nunca com o email. (Teste na Task 8.)
5. **Rating da API em falta (null) para alguns jogadores ou para todos** → os null são ignorados; se ninguém tiver rating, não há MVP oficial e o voto vale só a participação. (Teste na Task 6.)

---

## Estrutura de ficheiros

```
firebase.json                      emuladores, functions, rules, indexes
.firebaserc                        projeto por omissão scp360-37a74
firestore.rules                    regras fase 1 (transição)
firestore.indexes.json
legacy/v2-functions/               cópia de referência das functions atuais (sem segredos)
functions/
  package.json, tsconfig.json, jest.config.js
  src/index.ts                     exports das functions
  src/time/periods.ts              chaves de semana, mês e época
  src/game/types.ts                tipos partilhados
  src/game/result.ts               resultado que conta e 1X2
  src/game/scoring.ts              pontos de prognóstico e MVP
  src/game/mvp.ts                  MVP oficial e candidatos
  src/game/windows.ts              janelas de prognóstico e MVP
  src/data/gamesRepo.ts            adaptador para `games` e `players` atuais
  src/data/profiles.ts             nome público
  src/points/ledger.ts             escreve pointEvents e leaderboards (idempotente)
  src/callables/submitPrediction.ts
  src/callables/voteMvp.ts
  src/scheduled/settle.ts          liquidação de jogos terminados
  test/unit/*.test.ts              Jest puro
  test/emulator/*.test.ts          Jest contra o emulator
```

---

### Task 1: Estrutura do repositório e projeto `functions/`

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.indexes.json`
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/jest.config.js`, `functions/src/index.ts`
- Create: `functions/test/unit/smoke.test.ts`
- Modify: `.gitignore` (acrescentar `functions/lib/`, `functions/node_modules/`, `*.log`, `.firebase/`)

**Interfaces:**
- Produces: `npm test` (unit), `npm run test:emulator` (corre `firebase emulators:exec --only firestore,auth,functions "jest -c jest.emulator.config.js"`), `npm run build` (tsc para `lib/`).

- [ ] **Step 1:** Criar o branch `archive/v1-app` a partir de `main` e enviá-lo, para guardar a app antiga intacta: `git branch archive/v1-app origin/main && git push -u origin archive/v1-app`.
- [ ] **Step 2:** Criar `firebase.json` com functions (`source: functions`, runtime `nodejs22`, `predeploy: npm --prefix functions run build`), firestore (`rules: firestore.rules`, `indexes: firestore.indexes.json`) e emuladores auth 9099, firestore 8080, functions 5001. Criar `.firebaserc` com `{"projects":{"default":"scp360-37a74"}}`.
- [ ] **Step 3:** Criar `functions/package.json` com as dependências da Tech Stack, `engines.node: "22"` e os scripts `build`, `test`, `test:emulator`, `lint` (tsc --noEmit). O tsconfig deve ter `strict: true`.
- [ ] **Step 4:** Escrever `test/unit/smoke.test.ts` com `expect(1 + 1).toBe(2)` e correr `cd functions && npm i && npm test`. Esperado: 1 passed.
- [ ] **Step 5:** Commit `chore: functions workspace and firebase config`.

### Task 2: Cópia de referência das Cloud Functions atuais

**Files:**
- Create: `legacy/v2-functions/**` (o código publicado das 11 functions)
- Create: `legacy/v2-functions/README.md`

**Interfaces:**
- Produces: referência só de leitura para o Plano 2 (endpoints da API-Football usados, mapeamento para as coleções atuais, formato das coleções `players` e `games`).

- [ ] **Step 1 (Martim ou sessão com acesso ao GCP):** Descarregar o código de uma das functions (todas partilham o mesmo código): Consola GCP → Cloud Run → serviço `gamessheduler` → Origem → **Transferir**. Em alternativa: `gcloud functions describe gamesSheduler --region us-central1 --project scp360-37a74 --format='value(buildConfig.source.storageSource)'` e `gsutil cp` do objeto indicado.
- [ ] **Step 2:** Descompactar para `legacy/v2-functions/` só a pasta `src/` e o `package.json` (sem `lib/` nem `node_modules/`).
- [ ] **Step 3:** Substituir o valor por omissão da chave RapidAPI em `src/midleware/config.ts` por `"<REDACTED: rodar a chave>"`. Verificar: `grep -rn "msh" legacy/` não devolve nada.
- [ ] **Step 4:** Escrever o README com: origem, data da cópia, lista das 11 functions com o cron (`liveMatchUpdater` cada minuto; `videosSheduler` e `predictionsSettlementScheduler` cada 5 minutos; `newsSheduler` cada 15 minutos; `gamesSheduler`, `statisticsSheduler` e `standingsSheduler` cada 2 horas; as restantes diárias) e o aviso "não publicar a partir desta pasta".
- [ ] **Step 5:** Commit `chore: archive deployed v2 cloud functions (secrets redacted)`.

### Task 3: Regras do Firestore, fase 1 (transição)

Objetivo: fechar o que dá para fechar **sem partir a app V2**. A V2 lê `users` sem sessão (login por PIN), escreve `users/{uid}`, `gamebox` (campo `userid`), `predictions/{gameId_uid}`, `manofmatch/{gameId_uid}` e incrementa `rankings/{uid_season}` em 1 numa transação.

**Files:**
- Create: `firestore.rules`
- Test: `functions/test/emulator/rules.phase1.test.ts`

**Interfaces:**
- Consumes: Task 1 (`npm run test:emulator`).

- [ ] **Step 1: Escrever os testes que falham.** Com `@firebase/rules-unit-testing` (`initializeTestEnvironment` com o `firestore.rules`), um `it` por linha:
  - leitura anónima de `games/x`, `news/x`, `players/x`, `standings/x`: permitida;
  - escrita autenticada em `games/x`, `news/x`, `players/x`, `standings/x`, `videos/x`, `pointEvents/x`, `leaderboards/a/entries/b`: negada;
  - `delete` de `users/alice` por `bob`: negado; por `alice`: permitido;
  - `update` de `users/alice` por `bob`: negado; por `alice`: permitido;
  - leitura anónima de `users/alice`: **permitida** (fase 1; fecha no Plano 5);
  - `gamebox/g1` com `userid: 'alice'`: criar, atualizar e apagar por `alice` permitido; por `bob` negado;
  - `predictions/m1_alice`: criar por `alice` com `userId: 'alice'` permitido; criar com `userId: 'bob'` negado; atualizar ou apagar por `alice` negado;
  - `manofmatch/m1_alice`: as mesmas três regras que `predictions`;
  - `rankings/alice_2026-2027`: criar por `alice` com `points: 1` permitido; atualizar de `points: 5` para `6` permitido; para `9` negado; por `bob` negado; apagar negado;
  - qualquer coleção não listada (por exemplo `foo/x`): leitura e escrita negadas.
- [ ] **Step 2:** `cd functions && npm run test:emulator -- rules.phase1`. Esperado: falha (sem regras).
- [ ] **Step 3:** Escrever `firestore.rules` (`rules_version = '2'`). O id dos documentos de `rankings` é `uid_season`; validar com `docId.split('_')[0] == request.auth.uid` e `request.resource.data.userId == request.auth.uid`. O incremento valida `request.resource.data.points == resource.data.points + 1` (no create, `== 1`).
- [ ] **Step 4:** Repetir o Step 2. Esperado: todos passam.
- [ ] **Step 5:** Commit `feat(rules): phase-1 transition rules with emulator tests`.
- [ ] **Step 6 (só com o OK explícito do Martim):** `firebase deploy --only firestore:rules --project scp360-37a74`. Logo a seguir, num telemóvel com a app V2 atual: entrar com email, entrar por PIN, abrir a Home, a GameBox, fazer um prognóstico e votar no MVP num jogo de teste. Se algo falhar, reverter na consola Firebase → Firestore → Regras → versão anterior.

### Task 4: Períodos, resultado e scoring (lógica pura)

**Files:**
- Create: `functions/src/game/types.ts`, `functions/src/time/periods.ts`, `functions/src/game/result.ts`, `functions/src/game/scoring.ts`
- Test: `functions/test/unit/periods.test.ts`, `result.test.ts`, `scoring.test.ts`

**Interfaces:**
- Produces:
  - `type GameStatus = 'NS' | 'LIVE' | 'HT' | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC'`
  - `interface GameState { gameId: string; kickoff: Date; status: GameStatus; elapsed: number | null; goalsHome: number | null; goalsAway: number | null; finishedAt: Date | null; sportingSide: 'home' | 'away' }`
  - `periodKeys(at: Date): { week: string; month: string; season: string }`, com o formato `week: '2026-W47'`, `month: '2026-11'`, `season: '2026-2027'`, calculado em `Europe/Lisbon`
  - `countedScore(g: GameState): { home: number; away: number } | null`, que devolve null se o estado não for `FT`, `AET` ou `PEN`
  - `outcome(home: number, away: number): 'H' | 'D' | 'A'`
  - `POINTS = { participation: 1, exact: 3, outcome: 1, mvpCorrect: 2 } as const`
  - `predictionBonus(pred: { home: number; away: number }, final: { home: number; away: number }): 0 | 1 | 3` (só o bónus; a participação é atribuída à parte)
  - `mvpBonus(votedPlayerId: string, officialIds: string[]): 0 | 2`

- [ ] **Step 1: Escrever os testes.**
  - `periodKeys(new Date('2026-11-16T23:30:00Z'))` → week `2026-W47`, month `2026-11`, season `2026-2027` (segunda-feira em Lisboa).
  - `periodKeys(new Date('2026-06-30T22:59:00Z'))` → season `2025-2026`; `periodKeys(new Date('2026-06-30T23:00:00Z'))` → season `2026-2027` (Lisboa em UTC+1 no verão).
  - `periodKeys(new Date('2027-01-01T00:30:00Z'))` → week `2026-W53` e month `2027-01`. Confirmar em ISO: 1/1/2027 é sexta-feira e pertence à semana 53 de 2026.
  - `countedScore` com `FT` 2-1 → `{2,1}`; com `AET` 2-2 → `{2,2}`; com `PEN` (golos 1-1) → `{1,1}`; com `LIVE` → null; com `PST` → null.
  - `predictionBonus({2,1},{2,1}) === 3`; `({1,0},{2,1}) === 1`; `({1,1},{0,0}) === 1`; `({0,1},{2,1}) === 0`.
  - `mvpBonus('p7', ['p7','p9']) === 2`; `mvpBonus('p7', []) === 0`.
- [ ] **Step 2:** `npm test`. Esperado: falha.
- [ ] **Step 3:** Implementar. Para os períodos, usar `toZonedTime` (date-fns-tz) e `getISOWeek` e `getISOWeekYear` (date-fns). A época começa no mês 7 (julho) da hora de Lisboa.
- [ ] **Step 4:** `npm test`. Esperado: tudo passa.
- [ ] **Step 5:** Commit `feat(game): periods, counted result and scoring rules`.

### Task 5: Janelas de prognóstico e MVP

**Files:**
- Create: `functions/src/game/windows.ts`
- Test: `functions/test/unit/windows.test.ts`

**Interfaces:**
- Consumes: `GameState` (Task 4)
- Produces:
  - `predictionOpen(g: GameState, now: Date): boolean`, verdadeiro sse `g.status === 'NS'` e `now < g.kickoff`
  - `mvpWindow(g: GameState, now: Date): { state: 'before' | 'open' | 'closed'; closesAt: Date | null }`. Fica `open` quando `status` é `LIVE` e `elapsed >= 80`, ou quando o jogo já acabou (`FT`, `AET`, `PEN`) e `now < finishedAt + 20 min`. Fica `closed` depois disso. Fica `before` em todos os outros casos. `closesAt = finishedAt + 20 min` quando existe.
  - `MVP_CLOSE_AFTER_MS = 20 * 60_000`, `MVP_SETTLE_AFTER_MS = 2 * 60 * 60_000`

- [ ] **Step 1: Escrever os testes.**
  - Kickoff às 20:00, `now` 19:59 → aberto; `now` 20:00 → fechado.
  - **Review Focus 1:** jogo `PST` com o kickoff mudado para o dia seguinte → `predictionOpen` é falso enquanto o estado é `PST`. Quando volta a `NS` com a nova hora, fica verdadeiro antes dessa hora.
  - `LIVE` com `elapsed` 79 → `before`; com `elapsed` 80 → `open`, com `closesAt` null.
  - `FT`, `finishedAt` 21:52, `now` 22:11 → `open`, `closesAt` 22:12; `now` 22:12 → `closed`.
  - `HT` → `before`.
- [ ] **Step 2:** `npm test`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(game): prediction and mvp voting windows`.

### Task 6: MVP oficial e candidatos

**Files:**
- Create: `functions/src/game/mvp.ts`
- Test: `functions/test/unit/mvp.test.ts`

**Interfaces:**
- Produces:
  - `interface PlayerLine { playerId: string; name: string; teamIsSporting: boolean; minutes: number | null; rating: number | null }`
  - `mvpCandidates(lines: PlayerLine[]): PlayerLine[]`: jogadores do Sporting com `minutes > 0`, ordenados por nome
  - `officialMvpIds(lines: PlayerLine[]): string[]`: os candidatos com o rating máximo; vazio se nenhum tiver rating

- [ ] **Step 1: Escrever os testes.**
  - Os jogadores do adversário e os do Sporting com `minutes` 0 ou null ficam de fora dos candidatos.
  - Ratings 7.2, 8.05 e 6.9 → `['<id de 8.05>']`.
  - Empate em 7.5 → os dois ids.
  - **Review Focus 5:** com alguns ratings null, os null são ignorados; com todos null → `[]`.
- [ ] **Step 2:** `npm test`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(game): official mvp and candidates`.

### Task 7: Adaptador das coleções atuais e nome público

**Files:**
- Create: `functions/src/data/gamesRepo.ts`, `functions/src/data/profiles.ts`
- Test: `functions/test/emulator/gamesRepo.test.ts`, `functions/test/unit/profiles.test.ts`

**Interfaces:**
- Consumes: `GameState` e `PlayerLine` (Tasks 4 e 6)
- Produces:
  - `getGameState(db: Firestore, gameId: string): Promise<GameState | null>`. Hoje `gameId` é o id da API-Football, guardado no campo `api` dos documentos de `games`. Mapeia `timestamp` → `kickoff`, `scorehome` e `scoreaway` → golos, `elapsedTime` → `elapsed`, e o estado. O Plano 2 substitui só esta função.
  - `listFinishedUnsettled(db: Firestore, now: Date): Promise<GameState[]>`: jogos `FT`, `AET` ou `PEN` com `finishedAt <= now - 2h` e sem `settledAt` em `settlements/{gameId}`.
  - `getPlayerLines(db: Firestore, gameId: string): Promise<PlayerLine[]>`, a partir de `players` (filtro `GameId`).
  - `publicName(user: { displayName?: string | null; name?: string | null }, uid: string): string`

- [ ] **Step 1:** Inspecionar, só a ler, um documento de `games` e um de `players` de um jogo terminado (consola Firebase ou `legacy/v2-functions/src/models/*.ts`). Anotar no topo de `gamesRepo.ts`, em comentário, os nomes reais dos campos de estado, de `finishedAt`, de rating, de minutos e de equipa. Se `games` não guardar o estado nem a hora de fim, derivar: `elapsed >= 90` mais o estado da API, guardado pela `liveMatchUpdater`. Se nem isso existir, o Plano 2 acrescenta esses campos; até lá a função devolve `status: 'NS'`.
- [ ] **Step 2: Escrever os testes.**
  - No emulator: criar `games/x` com os campos reais da Step 1 e verificar que `getGameState` devolve o `GameState` esperado; o mesmo para `getPlayerLines`.
  - Unit: `publicName({displayName:'Leão 77'}, 'u1')` → `'Leão 77'`; `publicName({name:'MARTIM BUSTORFF'}, 'u1')` → `'Martim Bustorff'`; **Review Focus 4:** `publicName({}, 'abcd1234')` → `'Sportinguista #1234'`; um `name` que contenha `@` é tratado como inexistente.
- [ ] **Step 3:** Correr. Esperado: falha.
- [ ] **Step 4:** Implementar. A capitalização é Title Case com locale `pt-PT`.
- [ ] **Step 5:** Correr unit e emulator. Esperado: passa.
- [ ] **Step 6:** Commit `feat(data): adapter for current games/players and public names`.

### Task 8: Livro de pontos e leaderboards (idempotente)

**Files:**
- Create: `functions/src/points/ledger.ts`
- Test: `functions/test/emulator/ledger.test.ts`

**Interfaces:**
- Consumes: `periodKeys` (Task 4), `publicName` (Task 7)
- Produces:
  - `type PointType = 'prediction_participation' | 'prediction_exact' | 'prediction_outcome' | 'mvp_participation' | 'mvp_correct'`
  - `awardPoints(db: Firestore, e: { uid: string; gameId: string | null; type: PointType; points: number; gameDate: Date; periods?: ('week' | 'month' | 'season')[] }): Promise<boolean>`
    - O id do documento é determinístico: `${uid}_${gameId ?? 'none'}_${type}`.
    - Numa transação: se `pointEvents/{id}` já existe, devolve `false` e não faz nada. Se não existe, cria-o e incrementa `leaderboards/{kind}_{key}/entries/{uid}` (`{ uid, displayName, points }`) para cada período em `periods` (por omissão os três). Devolve `true`.
    - `displayName` vem de `publicName(users/{uid})`.

- [ ] **Step 1: Escrever os testes (emulator).**
  - Uma atribuição de 3 pontos a `alice` num jogo de 16/11/2026 → `leaderboards/week_2026-W47/entries/alice.points == 3`, o mesmo em `month_2026-11` e `season_2026-2027`.
  - **Review Focus 2:** a mesma chamada repetida devolve `false` e os totais ficam em 3.
  - Uma chamada com `periods: ['season']` só altera `season_2026-2027`.
  - Um utilizador sem nome → a entrada tem `displayName: 'Sportinguista #xxxx'`, e nenhum documento de `leaderboards` contém `@`.
- [ ] **Step 2:** `npm run test:emulator -- ledger`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(points): idempotent ledger and period leaderboards`.

### Task 9: Callables `submitPrediction` e `voteMvp`

**Files:**
- Create: `functions/src/callables/submitPrediction.ts`, `functions/src/callables/voteMvp.ts`
- Modify: `functions/src/index.ts` (exportar as duas, região `europe-west1`)
- Test: `functions/test/emulator/callables.test.ts`

**Interfaces:**
- Consumes: `getGameState`, `getPlayerLines`, `predictionOpen`, `mvpWindow`, `mvpCandidates`, `awardPoints`, `POINTS`
- Produces (contrato para a app no Plano 4):
  - `submitPrediction({ gameId: string, home: number, away: number }) → { ok: true }`, que escreve `predictions/{gameId}_{uid}` com `{ gameId, userId, home, away, createdAt, source: 'v2027' }` e atribui `prediction_participation`
  - `voteMvp({ gameId: string, playerId: string }) → { ok: true }`, que escreve `mvpVotes/{gameId}_{uid}` com `{ gameId, userId, playerId, createdAt, source: 'v2027' }` e atribui `mvp_participation`
  - Erros `HttpsError`: `unauthenticated`; `invalid-argument` (golos fora de 0 a 20 ou não inteiros; jogador fora dos candidatos); `failed-precondition` com a mensagem `PREDICTION_CLOSED`, `MVP_NOT_OPEN` ou `MVP_CLOSED`; `already-exists`.

- [ ] **Step 1: Escrever os testes (emulator, com o functions-test ou chamadas HTTP ao emulator autenticadas).**
  - Sem sessão → `unauthenticated`.
  - Antes do kickoff → ok, o documento existe e `pointEvents/alice_m1_prediction_participation` vale 1.
  - Segunda submissão → `already-exists`, e os pontos continuam em 1.
  - Depois do kickoff → `PREDICTION_CLOSED`.
  - Golos 21 ou 1.5 → `invalid-argument`.
  - MVP ao minuto 79 → `MVP_NOT_OPEN`; ao minuto 80 com um candidato válido → ok mais 1 ponto; um jogador que não jogou → `invalid-argument`; depois de `finishedAt + 20 min` → `MVP_CLOSED`.
- [ ] **Step 2:** Correr. Esperado: falha.
- [ ] **Step 3:** Implementar. A escrita do voto ou do prognóstico e o `awardPoints` correm na mesma transação, ou o `awardPoints` corre a seguir mas com o id determinístico, para não duplicar.
- [ ] **Step 4:** Correr. Esperado: passa.
- [ ] **Step 5:** Commit `feat(callables): submitPrediction and voteMvp`.

### Task 10: Liquidação agendada

**Files:**
- Create: `functions/src/scheduled/settle.ts`
- Modify: `functions/src/index.ts` (`onSchedule('every 10 minutes', …)`, região `europe-west1`, timezone `Europe/Lisbon`)
- Test: `functions/test/emulator/settle.test.ts`

**Interfaces:**
- Consumes: `listFinishedUnsettled`, `countedScore`, `predictionBonus`, `officialMvpIds`, `getPlayerLines`, `mvpBonus`, `awardPoints`
- Produces:
  - `settleGame(db: Firestore, gameId: string): Promise<{ predictions: number; votes: number; officialMvp: string[] }>`
    - Atribui `prediction_exact` (3) ou `prediction_outcome` (1) a cada prognóstico, e `mvp_correct` (2) a cada voto certo.
    - Considera **só** documentos com `source == 'v2027'`. Os prognósticos e votos da app antiga são ignorados: todos os utilizadores começam a zero na app nova (decisão do Martim).
    - Escreve `settlements/{gameId}` com `{ settledAt, finalHome, finalAway, officialMvp }`; a app usa-o para mostrar "a apurar" ou o MVP oficial.
  - `settleDue(db: Firestore, now: Date): Promise<number>`

- [ ] **Step 1: Escrever os testes (emulator).**
  - Jogo `FT` 2-1 terminado há 3 horas, com prognósticos 2-1, 1-0 e 0-0 → bónus 3, 1 e 0. Os totais da época, com a participação, ficam em 4, 2 e 1.
  - **Review Focus 3:** jogo `PEN` com golos 1-1 e prognóstico 1-1 → bónus 3.
  - Jogo terminado há 1 hora e 59 minutos → não é liquidado.
  - `settleDue` corrido duas vezes → os totais não mudam à segunda e `settlements/{id}` existe.
  - Votos MVP: o oficial é o rating 8.05 → quem votou nele fica com 3 pontos no total, os outros com 1.
  - Um prognóstico antigo, sem `source`, no mesmo jogo → é ignorado e não recebe bónus.
- [ ] **Step 2:** Correr. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr. Esperado: passa.
- [ ] **Step 5:** Commit `feat(scheduled): settle finished games`.

### Task 11: Publicação do motor (sem efeito na app atual)

**Files:**
- Modify: `functions/src/index.ts` (já exporta tudo)

- [ ] **Step 1:** `npm run lint && npm test && npm run test:emulator`. Esperado: tudo passa.
- [ ] **Step 2 (só com o OK explícito do Martim):** Criar o segredo `RAPIDAPI_KEY` com a chave **nova** (rodada no painel da RapidAPI): `firebase functions:secrets:set RAPIDAPI_KEY`.
- [ ] **Step 3 (só com o OK explícito do Martim):** `firebase deploy --only functions:submitPrediction,functions:voteMvp,functions:settle --project scp360-37a74`. **Nunca** usar `firebase deploy --only functions` sem nomes: apagaria as 11 functions atuais, que não estão neste código.
- [ ] **Step 4:** Verificar na consola que as 11 functions antigas continuam ativas e que a `settle` corre a cada 10 minutos sem erros (sem jogos por liquidar, devolve 0).
- [ ] **Step 5:** Commit e push do branch `v2027`.
