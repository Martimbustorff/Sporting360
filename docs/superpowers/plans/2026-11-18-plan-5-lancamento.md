# Plano 5: Lançamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o código que falta para a Entrega 1 (museu, classificação, percentagens do MVP, notícias sem texto, domínio de partilha, regras finais, guarda do build, reset do ranking, pendentes e fichas das lojas) e conduzir, com o Martim, a publicação do backend, os builds, a submissão às lojas até 12/12 e o corte.

**Architecture:** Tasks 1 a 11 são código normal com testes, no branch `v2027`, sem publicar nada. A Task 12 é o guia de lançamento: paragens ordenadas, cada uma com o comando exato e a verificação, que só correm com o OK explícito do Martim. As regras do Firestore passam a ter duas versões no repositório: `firestore.rules` (fase 2, publicada com a Task 21 do Plano 2, a V2 continua a funcionar) e `firestore.final.rules` (copiada por cima no dia do lançamento). O domínio do link partilhado passa a viver num só ficheiro, `mobile/share.config.json`, lido pelo `app.config.ts` e pelo `shareLink.ts`.

**Tech Stack:** Expo SDK 58 (RN 0.88), Expo Router, React Native Firebase 27, zod 4, jest-expo e `@testing-library/react-native`; Cloud Functions Node 22 (firebase-functions 7, firebase-admin 13), `@firebase/rules-unit-testing`, emuladores; EAS Build e Submit; Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-11-17-scp360-v2027-design.md` (secções 2, 3, 5.16, 6, 7 "Regras do Firestore (estado final)", 8 e 9). Ler também: roteiro `docs/superpowers/plans/2026-11-17-v2027-roadmap.md` (linha 5); Plano 2 `docs/superpowers/plans/2026-11-18-plan-2-dados-desportivos.md` (Task 21) e o guia `docs/superpowers/notes/2026-12-01-publicacao-plano2.md`; Plano 4 `docs/superpowers/plans/2026-11-18-plan-4-ecras.md` ("Notas para o Plano 5", "Perguntas para o Martim", "Smoke em dispositivo (Martim)") e `docs/superpowers/notes/2026-11-18-plano4-rulings.md`; `mobile/README.md` ("Paragens do Martim").

## Global Constraints

- Textos da app, dos documentos e das fichas das lojas em pt-PT, sem travessões nem meias-riscas (`\u2014`, `\u2013`); identificadores de código em inglês.
- Cores, fontes e espaçamentos só de `mobile/src/theme/tokens.ts`; `npm run check:tokens` passa no fim de cada task da app.
- Verificação de cada task da app: `cd mobile && npm test && npm run typecheck && npm run check:tokens`. Das functions: `cd functions && npm run lint && npm test && npm run test:emulator`.
- Projeto Firebase `scp360-37a74`; functions novas no codebase `v2027`, região `europe-west1`; antigas no codebase por omissão, `us-central1`.
- Nunca `firebase deploy` sem `--only`; functions sempre por nome qualificado (`functions:v2027:<nome>`); `firebase functions:delete` só com nomes de functions, nunca com um codebase; nunca `--force`.
- A V2 da loja (6.1.2) continua a funcionar até ao passo L5 (regras finais) da Task 12. A V2 não lê `config/app` nem tem ecrã de atualização: a versão mínima não a bloqueia.
- Segredos, chaves, `.p8`, JSON de contas de serviço e passwords de teste nunca entram no repositório, no plano, em logs nem na conversa; quem os escreve é o Martim, no terminal ou na consola dele.
- Passos **PARAGEM** só correm com o OK explícito do Martim na conversa. Builds EAS só com OK explícito; o mínimo é 2 builds de produção (iOS e Android) e, só se não houver já um dev client com a configuração nativa final, 2 de desenvolvimento.
- Identidade: bundle e package `com.scp360`, equipa Apple `5U6HWPNTZ3`, `ascAppId` `6450608023`, versão `7.0.0`, Play target API 36 ou superior.
- Os pontos só são escritos pelo servidor; o email nunca aparece fora da conta do próprio. O ranking arranca vazio no lançamento (spec, secção 8.4).
- Submissão às lojas até 12/12/2026, lançamento antes do Natal.

## Review Focus

1. **Rajada de votos MVP ao minuto 80** (centenas de votos no mesmo jogo em poucos minutos, todos no mesmo `mvpTallies/{gameId}`) → nenhum voto se perde nem conta duas vezes; a callable pode demorar mais mas responde. Teste na Task 3 (50 votos em paralelo dão `total` 50).
2. **Callable repetida depois de o voto ficar gravado** (rede cai na resposta, o utilizador toca outra vez) → `already-exists` e a contagem não muda. Teste na Task 3.
3. **Utilizador da V2 que ainda não atualizou, entre a publicação das regras fase 2 e o lançamento** (login por PIN sem sessão, GameBox, palpite com +1 no `rankings`) → tudo continua a funcionar. Teste na Task 7 (matriz das operações da V2 contra `firestore.rules`).
4. **Build de produção pedido com pendentes por decidir** (marca "[A DEFINIR PELO MARTIM" nos Termos) → falha antes de subir para a EAS, com a lista do que falta. Teste na Task 8.
5. **Notícia com URL que não é https ou vazio** → o cartão não abre nada e não rebenta; com https abre o artigo original no browser da app. Teste na Task 5.

---

## Estrutura de ficheiros

```
functions/
  src/callables/voteMvp.ts              contagem em mvpTallies na mesma transação do voto
  src/game/mvp.ts                       mvpCandidates sem duplicados
  src/news/newsSync.ts                  content só com writeLegacyContent
  src/config/secrets.ts                 parâmetro NEWS_LEGACY_CONTENT
  src/index.ts                          liga o parâmetro ao newsSync; apiSportsSync sem alerta duplicado
  .env.scp360-37a74                     + NEWS_LEGACY_CONTENT=true
  scripts/strip-news-content.ts         apaga o campo content (no lançamento)
  scripts/reset-engine.ts               ranking a zero (no lançamento)
  scripts/check-predeploy.ts            ENGINE_COLLECTIONS + mvpTallies
firestore.rules                         fase 2
firestore.final.rules                   estado final (lançamento)
mobile/
  share.config.json                     domínio do link partilhado
  app.config.ts                         associatedDomains, intentFilters e guarda de produção
  scripts/launchGate.js                 pendentes que bloqueiam o build de produção
  eas.json, package.json, .gitignore    node, submit android, hook eas-build-pre-install
  src/content/clubLinks.ts, termos.ts   sem museu, sem STADIUM_TODOS
  src/content/termsHtml.ts              Termos em HTML para o Hosting
  src/theme/tokens.ts                   standingsTeam
  src/components/StandingsTable.tsx
  src/data/schemas.ts, sports.ts        MvpTally, useMvpTally
  src/lib/mvpPercent.ts                 percentagens
  src/components/match/MvpTab.tsx, PredictionTab.tsx
  src/lib/shareLink.ts, gameWindows.ts, myGame.ts
  src/services/analytics.ts, src/providers/SessionProvider.tsx
  app/(app)/estadio.tsx, noticias.tsx, perfil/notificacoes.tsx
hosting/public/privacidade/index.html, hosting/public/apagar-conta/index.html
store/listing.pt-PT.json, store/privacidade-lojas.md, store/capturas.md
```

---

### Task 1: Mapa do estádio sem o Museu

**Files:**
- Modify: `mobile/src/content/clubLinks.ts`, `mobile/src/content/termos.ts` (tira a reexportação de `STADIUM_TODOS` e a menção no comentário), `mobile/app/(app)/estadio.tsx` (tira o ícone `museu`)
- Delete: `mobile/assets/icons/museum.svg` se mais nenhum ficheiro o usar (`grep -rn museum mobile/app mobile/src`)
- Test: `mobile/__tests__/app/links.test.tsx`

**Interfaces:**
- Produces: `StadiumLink = { id: 'loja' | 'bilheteira'; label: string; url: string }`; `STADIUM_LINKS` com Loja Verde e Bilheteira, nesta ordem. `STADIUM_TODOS` deixa de existir (a Task 8 confirma que a guarda não o encontra).

- [ ] **Step 1: Atualizar o teste.** Em `links.test.tsx`, trocar o caso do museu por: `STADIUM_LINKS.map(l => l.id)` igual a `['loja', 'bilheteira']`; `/estadio` não tem `queryByLabelText('Museu Sporting')`; e `require('@/content/clubLinks')` não tem a chave `STADIUM_TODOS`.
- [ ] **Step 2:** `cd mobile && npm test -- links`. Esperado: FAIL (o export ainda existe).
- [ ] **Step 3:** Retirar a entrada, o tipo `'museu'`, o `url: null` e `STADIUM_TODOS` (Martim: "retira o museu").
- [ ] **Step 4:** `npm test && npm run typecheck && npm run check:tokens`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(mobile): stadium screen without the museum row`.

### Task 2: Classificação com o nome do clube mais pequeno

**Files:**
- Modify: `mobile/src/theme/tokens.ts`, `mobile/src/theme/typography.tsx` (variante nova), `mobile/src/components/StandingsTable.tsx:84`
- Test: `mobile/__tests__/components/CompetitionStandings.test.tsx`, `mobile/__tests__/theme/tokens.test.ts`

**Interfaces:**
- Produces: token de tipo `standingsTeam: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.white }` e `BodyVariant` `'standingsTeam'`. Só a `StandingsTable` o usa; `tableTeam` (12) fica para as `TeamRows`.

- [ ] **Step 1: Escrever o teste.** Com uma linha "Sporting Clube de Portugal B": o texto do nome tem `numberOfLines` 1, `ellipsizeMode` `'tail'` e `fontSize` 10 (estilo achatado); `getByTestId('standings-crest-<id>')` existe em cada linha; os pontos (`standings-points-<id>`) continuam visíveis. Teste de tokens: `type.standingsTeam.fontSize === 10`.
- [ ] **Step 2:** `npm test -- CompetitionStandings tokens`. Esperado: FAIL.
- [ ] **Step 3:** Acrescentar o token e a variante e usá-la na linha da tabela. Comentário no topo do componente: "nome em SemiBold 10 (pedido do Martim, 18/11; Figma 500:29419 tem 12)".
- [ ] **Step 4:** `npm test && npm run typecheck && npm run check:tokens`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(mobile): smaller club name in standings so long names fit`.

### Task 3: Contagem dos votos MVP no servidor (`mvpTallies`)

**Files:**
- Modify: `functions/src/callables/voteMvp.ts`, `firestore.rules` (só o bloco `mvpTallies`)
- Test: `functions/test/emulator/callables.test.ts`, `functions/test/emulator/rules.phase1.test.ts` (o caso novo; a Task 7 renomeia o ficheiro)

**Interfaces:**
- Produces: documento `mvpTallies/{gameId}` = `{ gameId: string, counts: { [playerId: string]: number }, total: number, updatedAt: Timestamp }`. Escrito só por `handleVoteMvp`, na mesma transação que cria `mvpVotes/{gameId}_{uid}`, com `tx.set(ref, { gameId, counts: { [playerId]: FieldValue.increment(1) }, total: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true })`. A transação não lê o `mvpTallies` (sem contenção de leitura). Regra: `match /mvpTallies/{id} { allow read: if true; }`, escrita negada.
- Decisões: os votos são definitivos (um por utilizador e jogo), por isso não há troca de voto a descontar. O `deleteAccount` apaga os `mvpVotes` do utilizador mas não desconta a contagem: é anónima e conta o voto dado. Não há votos de produção antes deste deploy, por isso não há backfill.

- [ ] **Step 1: Escrever os testes (emulador).**
  - `vote creates mvpTallies with counts and total`: alice vota em `p10` → `counts.p10 === 1`, `total === 1`, `gameId` certo.
  - `second voter adds to the same tally`: bob vota em `p7` → `counts.p7 === 1`, `counts.p10 === 1`, `total === 2`.
  - `repeated call after saved vote does not count twice` (Review Focus 2): alice chama outra vez com `p7` → `already-exists`; a contagem fica igual e o `mvpVotes` de alice mantém `p10`.
  - `rejected vote does not touch the tally`: janela `before`, `closed` ou jogador inválido → erro e o documento não existe.
  - `50 parallel votes give total 50` (Review Focus 1): 50 uids com `Promise.all` em `handleVoteMvp` → `total === 50` e a soma de `counts` 50.
  - Regras: anónimo lê `mvpTallies/g1`; autenticado não escreve nem apaga.
- [ ] **Step 2:** `cd functions && npm run test:emulator -- callables rules`. Esperado: FAIL.
- [ ] **Step 3:** Implementar no ramo de criação da transação e acrescentar a regra.
- [ ] **Step 4:** `npm run lint && npm test && npm run test:emulator`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(functions): mvp vote tallies written with the vote`.

### Task 4: Percentagens na tab MVP

**Files:**
- Create: `mobile/src/lib/mvpPercent.ts`
- Modify: `mobile/src/data/schemas.ts`, `mobile/src/data/sports.ts`, `mobile/src/components/match/MvpTab.tsx`, `mobile/src/data/fixtures.ts` (tally do jogo `LIVE` 82)
- Test: `mobile/__tests__/lib/mvpPercent.test.ts`, `mobile/__tests__/components/match/MvpTab.test.tsx`, `mobile/__tests__/data/sportsSchemas.test.ts`

**Interfaces:**
- Consumes: `mvpTallies/{gameId}` (Task 3), `mvpCandidates`, `mvpWindow`, `useMyMvpVote`.
- Produces:
  - `MvpTallySchema = z.object({ gameId: z.string(), counts: z.record(z.string(), z.number().int().nonnegative()), total: z.number().int().nonnegative() })`, tipo `MvpTally`.
  - `useMvpTally(gameId: string | null): Loadable<MvpTally>` (documento inexistente = `missing`).
  - `mvpPercentages(tally: MvpTally, playerIds: string[]): Record<string, number>`: inteiros pelo método do maior resto, base `tally.total`, soma 100 quando `total > 0`; empates no resto pela ordem de `playerIds`; jogador sem votos 0; `total === 0` devolve `{}`.
  - Tab: as percentagens aparecem ao lado de cada candidato **depois de o utilizador votar ou quando a votação fecha** (estados `closed`, "a apurar" e com `officialMvp`), com "{total} votos" por baixo da lista. Com a votação aberta e sem voto do próprio não aparecem: ver as percentagens antes de votar puxa o voto para o mais votado e o voto é definitivo. A referência `818:21193` mostra a lista de quem já votou, com a percentagem por jogador. `PST`/`CANC` sem percentagens. `total === 0` ou tally `missing` → sem percentagens e sem texto extra; erro de leitura → lista sem percentagens (sem mensagem; o voto é o principal).

- [ ] **Step 1: Escrever os testes.**
  - `mvpPercentages({counts:{a:1,b:1,c:1}, total:3}, ['a','b','c'])` → `{a:34, b:33, c:33}`; `{a:2,b:1}` total 3 → `{a:67,b:33}`; total 0 → `{}`; candidato sem votos → 0.
  - `MvpTab`: aberta sem voto → nenhum texto com "%"; aberta com voto do próprio e tally `{p10:3,p7:1}` → "75%" e "25%" e "4 votos"; `closed` sem voto → percentagens visíveis; `PST` → nenhuma; tally `missing` → nenhuma e sem erro.
  - Schema: aceita o documento da Task 3; rejeita `total` negativo.
- [ ] **Step 2:** `npm test -- mvpPercent MvpTab sportsSchemas`. Esperado: FAIL.
- [ ] **Step 3:** Implementar (SEM FIGMA; ver `get_screenshot` de `818:21193` para a posição da percentagem; cores e tipos só de tokens).
- [ ] **Step 4:** `npm test && npm run typecheck && npm run check:tokens`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(mobile): mvp vote percentages after voting or close`.

### Task 5: Notícias sem `content` no modelo novo e abrir o original

**Files:**
- Modify: `functions/src/news/newsSync.ts`, `functions/src/config/secrets.ts`, `functions/src/index.ts`, `functions/.env.scp360-37a74`, `docs/superpowers/notes/2026-12-01-publicacao-plano2.md` (secções 0, 6 e 9: o `.env` passa a ter 3 linhas)
- Create: `functions/scripts/strip-news-content.ts`
- Modify: `mobile/app/(app)/noticias.tsx` (usa `openLink`)
- Test: `functions/test/emulator/newsSync.test.ts`, `functions/test/emulator/predeployTools.test.ts` (o script), `mobile/__tests__/app/noticias.test.tsx`

**Interfaces:**
- Produces:
  - `NewsDeps` ganha `writeLegacyContent: boolean`. Com `true` grava `content` como hoje (a V2 mostra-o como corpo em `NewsDetail`, e `news` é a mesma coleção para as duas apps). Com `false` grava só `id, title, image, summary, source, url, created_at, sport, publishedAt`.
  - `NEWS_LEGACY_CONTENT = defineBoolean("NEWS_LEGACY_CONTENT", { default: true })` em `secrets.ts`; `.env.scp360-37a74` passa a ter `NEWS_LEGACY_CONTENT=true` (sem a linha o CLI pergunta no deploy, ver guia secção 0). Passa a `false` no passo L6 da Task 12.
  - `stripNewsContent(db: Firestore, o: { dryRun: boolean }): Promise<{ scanned: number; stripped: number }>` (lotes de 400 com `FieldValue.delete()`); CLI `npx tsx scripts/strip-news-content.ts --project <id> [--dry-run]`.
  - App: `openArticle` sai; o toque chama `openLink(url)` (só https, falha reportada). A app nova não tem tweets nem outros posts (verificado: `grep -rn tweet mobile/src mobile/app` vazio), por isso não há mais nada a reencaminhar.

- [ ] **Step 1: Escrever os testes.**
  - `newsSync`: com `writeLegacyContent: false` o documento não tem `content` e tem os 9 campos; com `true` tem `content` (comportamento atual).
  - `stripNewsContent`: 3 notícias com `content` e 1 sem → `dryRun` devolve `{ scanned: 4, stripped: 3 }` e não muda nada; sem `dryRun` nenhum documento fica com `content` e os outros campos ficam iguais.
  - `noticias` (Review Focus 5): toque num cartão com `https://...` chama `openBrowserAsync` com esse URL; com `http://...` ou `''` não chama e não rebenta.
- [ ] **Step 2:** `cd functions && npm run test:emulator -- newsSync predeployTools`; `cd ../mobile && npm test -- noticias`. Esperado: FAIL.
- [ ] **Step 3:** Implementar; no `index.ts`, `writeLegacyContent: NEWS_LEGACY_CONTENT.value()`.
- [ ] **Step 4:** Verificação completa das duas pastas. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: news without article text after cutover, app opens the original page`.

### Task 6: Domínio do link de partilha numa só configuração

**Files:**
- Create: `mobile/share.config.json`, `mobile/app.config.ts`
- Modify: `mobile/app.json` (sai `ios.associatedDomains` e `android.intentFilters`), `mobile/src/lib/shareLink.ts`, `mobile/app/(app)/j.tsx` (comentário)
- Rename: `mobile/__tests__/config/appJson.test.ts` → `mobile/__tests__/config/appConfig.test.ts`
- Test: `mobile/__tests__/config/appConfig.test.ts`, `mobile/__tests__/lib/shareLink.test.ts`

**Interfaces:**
- Produces:
  - `share.config.json` = `{ "host": "scp360-37a74.web.app", "extraHosts": [] }`. `host` é o domínio principal (cartão, QR, mensagem). `extraHosts` são domínios que também abrem a app (ex.: o `web.app` quando o principal for um domínio próprio).
  - `app.config.ts`: `export default ({ config }: ConfigContext): ExpoConfig` que parte do `app.json` e acrescenta `ios.associatedDomains = allHosts.map(h => 'applinks:' + h)` e um `intentFilter` `VIEW`, `autoVerify: true`, `BROWSABLE`/`DEFAULT`, com um `data` `{ scheme: 'https', host, pathPrefix: '/j' }` por host; `allHosts = [host, ...extraHosts]` sem repetidos.
  - `shareLink.ts`: `SHARE_HOST = 'https://' + share.host`; `SHARE_SHORT_TEXT = share.host + '/j'`; `shareLink` igual.
  - Mudar de domínio = editar `share.config.json` (e, se o domínio antigo já foi partilhado, pô-lo em `extraHosts`) e fazer um build nativo novo. O Hosting não muda: AASA e `assetlinks.json` não dependem do domínio, e um domínio próprio ligado ao mesmo site serve os mesmos ficheiros.

- [ ] **Step 1: Escrever os testes.** Os casos atuais de `appJson.test.ts` passam a correr sobre o resultado de `app.config.ts` (com `config` = `app.json`.expo); com `{ host: 'scp360-37a74.web.app', extraHosts: [] }` → `associatedDomains` `['applinks:scp360-37a74.web.app']` e o `intentFilter` atual; com `jest.doMock` de `share.config.json` para `{ host: 's360-download.app', extraHosts: ['scp360-37a74.web.app'] }` → dois `applinks:` e dois `data`, e `shareLink('1001')` `https://s360-download.app/j?src=share&game=1001`; `app.json` já não contém `web.app` (leitura do ficheiro).
- [ ] **Step 2:** `npm test -- appConfig shareLink`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Confirmar `npx expo config --type public | grep -A3 associatedDomains`.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run check:tokens && npx expo-doctor`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(mobile): share link host in a single config file`.

### Task 7: Regras do Firestore: fase 2 já e regras finais para o lançamento

**Files:**
- Modify: `firestore.rules` (fase 2)
- Create: `firestore.final.rules`
- Rename: `functions/test/emulator/rules.phase1.test.ts` → `functions/test/emulator/rules.phase2.test.ts`
- Create: `functions/test/emulator/rules.final.test.ts`, `functions/test/helpers/rulesOps.ts`

**Interfaces:**
- Decisão de faseamento (leituras da V2 em `/home/claude/v2src/SCP360_V2-master/src`):
  - **Fecha já (fase 2):** `matchPredictions` e `mvpVotes` só para o dono (`allow read: if signedIn() && resource.data.userId == request.auth.uid`). A V2 não lê estas coleções; a app nova só lê os do próprio (`useMyPredictions` com `where('userId','==',uid)`, `useMyMvpVote` por id). `mvpTallies` leitura pública (Task 3).
  - **Só no lançamento (final):** `users` só o dono lê (a V2 lê `users/{id}` no login por PIN sem sessão Firebase, `PasscodeLoginScreen.tsx:56`); `gamebox` só o dono lê (a V2 faz `where('userid','==',user.uuid)` com a sessão que houver, `home.tsx:174`); `predictions`, `manofmatch` e `rankings` sem acesso da app (arquivo; a V2 escreve-os com +1 em `predictions.ts:54` e `manOfTheMatch.ts:43`). As coleções antigas de dados (`games`, `news`, ...) mantêm leitura pública.
  - Consequência para o Martim: entre o lançamento e a atualização de cada utilizador, a V2 perde o login por PIN, a lista de GameBox e os palpites (não há forma de lhe mostrar um ecrã de atualização).
- Produces: `rulesOps.ts` com `V2_OPS` e `NEW_APP_OPS`, listas de `{ name: string; run: (env: RulesTestEnvironment) => Promise<unknown> }` (operações reais das duas apps, com dados semeados).

- [ ] **Step 1: Escrever os testes.**
  - `rules.phase2.test.ts`: os casos atuais, com `matchPredictions`/`mvpVotes` a mudar para: dono lê o seu; outro utilizador e anónimo não; query `where('userId','==','alice')` como alice passa. `describe.each(V2_OPS)` (Review Focus 3: PIN lê `users/alice` sem sessão; query de `gamebox` por `userid`; criar, editar e apagar GameBox; criar `predictions` e `manofmatch`; +1 em `rankings`; ler `games`, `news`, `tweets`) passa toda. `describe.each(NEW_APP_OPS)` passa toda.
  - `rules.final.test.ts` (lê `firestore.final.rules`): `NEW_APP_OPS` passa toda (próprio `users` lê e atualiza sem `displayName`; query de `gamebox` própria e criar; `matchPredictions` e `mvpVotes` próprios; `publicProfiles`, `config/app`, `mvpTallies`, `matches` e `news` sem sessão); anónimo não lê `users/alice`; bob não lê `users/alice` nem a `gamebox` de alice; `predictions`, `manofmatch` e `rankings` negados para leitura e escrita; `displayName` continua só do servidor.
- [ ] **Step 2:** `cd functions && npm run test:emulator -- rules`. Esperado: FAIL.
- [ ] **Step 3:** Implementar as duas versões. Cabeçalho de cada ficheiro: fase, data e "publicar só no passo L5 da Task 12 do Plano 5" no final; atualizar o comentário dos riscos aceites da fase 1.
- [ ] **Step 4:** `npm run lint && npm test && npm run test:emulator`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: phase 2 firestore rules and final rules for launch`.

### Task 8: Guarda e perfis do build de produção

**Files:**
- Create: `mobile/scripts/launchGate.js`
- Modify: `mobile/app.config.ts` (Task 6), `mobile/package.json` (script `eas-build-pre-install`), `mobile/eas.json`, `mobile/.gitignore`
- Modify (passo de conteúdo): `mobile/src/content/termos.ts`, `mobile/__tests__/content/termos.test.ts`
- Test: `mobile/__tests__/scripts/launchGate.test.ts`, `mobile/__tests__/config/appConfig.test.ts`, `mobile/__tests__/config/easJson.test.ts`

**Interfaces:**
- Produces:
  - `launchGateProblems(root: string): string[]` (CommonJS): percorre `src/content/**/*.ts` e devolve uma linha por ocorrência de `[A DEFINIR PELO MARTIM` (com ficheiro e texto) e uma linha se algum ficheiro declarar `STADIUM_TODOS`. CLI: `node scripts/launchGate.js` sai 1 com a lista quando `EAS_BUILD_PROFILE === 'production'` e há problemas, senão 0.
  - `app.config.ts`: com `process.env.EAS_BUILD_PROFILE === 'production'` e problemas, `throw new Error('Build de produção bloqueado: ' + problemas.join('; '))` (falha no `eas build` antes de subir). O hook `"eas-build-pre-install": "node scripts/launchGate.js"` repete a verificação no servidor da EAS.
  - `eas.json`: `node` `"22.18.0"` em todos os perfis (alinha com `engines` `>=22.18`); `submit.production.android = { "serviceAccountKeyPath": "./google-play-service-account.json", "track": "internal" }`; `.gitignore` com `google-play-service-account.json` e `*.p8`.

- [ ] **Step 1: Escrever os testes.** Pasta temporária com `src/content/a.ts` contendo `'[A DEFINIR PELO MARTIM: prazos]'` → 1 problema com `a.ts`; com `export const STADIUM_TODOS` → 1 problema; sem nada → `[]`. `app.config` com `EAS_BUILD_PROFILE=production` e `launchGateProblems` simulado com 1 problema lança "Build de produção bloqueado"; com `development` não lança (Review Focus 4). `easJson.test.ts`: `node` igual em todos os perfis e ≥ 22.18; `submit.production.android.track === 'internal'`.
- [ ] **Step 2:** `npm test -- launchGate appConfig easJson`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Verificar sem build: `EAS_BUILD_PROFILE=production npx expo config --type public` falha com a marca dos prazos (o repositório ainda a tem); `EAS_BUILD_PROFILE=development npx expo config --type public` passa.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run check:tokens`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(mobile): production build blocked while launch todos remain`.
- [ ] **Step 6 (PARAGEM, conteúdo do Martim):** com o texto dos prazos de conservação aprovado pelo Martim (proposta nas Perguntas, ponto 2) e a confirmação do "interesse legítimo" para os relatórios de erros: substituir a marca em `termos.ts`, `TERMS_TODOS = []`, atualizar `termos.test.ts` (sem marcas; texto contém os prazos). `EAS_BUILD_PROFILE=production npx expo config --type public` passa. Commit `docs(mobile): retention periods in privacy policy`.

### Task 9: Ranking a zero no lançamento

**Files:**
- Create: `functions/scripts/reset-engine.ts`
- Modify: `functions/scripts/check-predeploy.ts:79` (`ENGINE_COLLECTIONS` ganha `"mvpTallies"`)
- Test: `functions/test/emulator/predeployTools.test.ts`, `functions/test/unit/checkPredeploy.test.ts`

**Interfaces:**
- Consumes: `ENGINE_COLLECTIONS`.
- Produces: `resetEngine(db: Firestore, o: { dryRun: boolean; now: Date }): Promise<{ counts: Record<string, number>; deleted: boolean }>`. Recusa (lança `RESET_BLOCKED_LIVE_GAME`) se houver um `matches` de futebol do Sporting (`sport == 'football'`, `sportingSide != null`) com `kickoff` entre `now - 6 h` e `now + 6 h` ou com `status` `LIVE`/`HT`. Sem `dryRun` faz `db.recursiveDelete(db.collection(c))` para cada coleção de `ENGINE_COLLECTIONS` (inclui `leaderboards/*/entries`). Não toca em `users`, `publicProfiles`, `matches`, `config` nem nas coleções da V2. CLI: `npx tsx scripts/reset-engine.ts --project <id> [--dry-run]`; sem `--dry-run` pede que se escreva o id do projeto para confirmar.

- [ ] **Step 1: Escrever os testes (emulador).** Semear 1 documento em cada coleção do motor (e 1 `entries`), mais `users/a`, `publicProfiles/a`, `predictions/x`: `dryRun` devolve as contagens e não apaga; sem `dryRun` as 6 coleções ficam vazias e as outras intactas; um jogo do Sporting `LIVE` faz falhar com `RESET_BLOCKED_LIVE_GAME`. Unitário: `ENGINE_COLLECTIONS` contém `mvpTallies`.
- [ ] **Step 2:** `npm run test:emulator -- predeployTools && npm test -- checkPredeploy`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run lint && npm test && npm run test:emulator`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(functions): reset engine collections for launch`.

### Task 10: Pendentes menores dos Planos 2 e 4

**Files:**
- Modify: `mobile/src/lib/myGame.ts`, `mobile/src/components/match/PredictionTab.tsx`, `mobile/src/lib/gameWindows.ts`, `functions/src/game/mvp.ts`, `mobile/app/(app)/perfil/notificacoes.tsx`, `mobile/src/services/analytics.ts`, `mobile/src/providers/SessionProvider.tsx`, `mobile/package.json`, `functions/src/index.ts`, `functions/test/emulator/predeployTools.test.ts`, `docs/superpowers/plans/2026-11-18-plan-2-dados-desportivos.md:103`, `docs/superpowers/plans/2026-11-17-v2027-roadmap.md`
- Test: `mobile/__tests__/lib/myGame.test.ts`, `mobile/__tests__/components/match/PredictionTab.test.tsx`, `mobile/__tests__/lib/gameWindows.test.ts`, `mobile/__tests__/lib/serverParity.test.ts`, `functions/test/unit/mvp.test.ts`, `mobile/__tests__/services/analytics.test.ts`, `mobile/__tests__/app/perfil.test.tsx` (ecrã `perfil/notificacoes`), `functions/test/emulator/apiSportsSync.test.ts`

**Interfaces:**
- Produces (uma linha por pendente; a reutilização do `openLink` nas notícias está na Task 5):
  - **Pontos por jogo:** `myGameStats(...).history[].points` soma só os eventos `prediction_*` desse jogo (como `predictionPoints` na `PredictionTab`); o MVP fica de fora da linha do prognóstico.
  - **Relógio da PredictionTab:** `usePredictionClock` limpa o `setInterval` quando `now >= kickoff` (o formulário já fechou) e não o cria se o jogo já começou.
  - **Candidatos MVP sem duplicados:** `mvpCandidates` (app e servidor) mantém a primeira linha de cada `playerId`; vetor novo no teste de paridade.
  - **Texto sem ligação:** `notificacoes` usa "Sem ligação. A tua escolha fica guardada e é enviada quando houver ligação." (uma frase, sem repetir "neste telemóvel").
  - **Crashlytics com consentimento:** sai o `setCrashlyticsUserId` do `SessionProvider`; `analytics.ts` põe o uid no Crashlytics nos mesmos pontos em que o põe no Analytics (só com `consent === 'granted'`) e `''` quando o tira. Os relatórios de erro continuam sem uid.
  - **Versões fixas:** módulos nativos com `^` passam à versão exata instalada (`react-native-share`, `react-native-qrcode-svg`, `react-native-mmkv`, `react-native-web`, `nativewind`, `react-dom`), lidas de `package-lock.json`.
  - **Alerta duplicado do apiSportsSync:** o `runJob("apisports", ...)` do `index.ts` deixa de passar `failed` (cada modalidade já regista a sua saúde e o seu alerta); devolve só `count`.
  - **Teste instável do compare-legacy:** em "documentos iguais nos dois lados", `since` passa a ser `(await db.doc("games/900").set(...)).writeTime.toDate()` mais 1 ms, sem `setTimeout(5)`.
  - **Linhas do orçamento:** Plano 2 linha 103, "máximo diário < 1.000" passa a "≈1.450 num dia com 2 jogos"; linha 5 do roteiro com o estado do Plano 5.

- [ ] **Step 1: Escrever os testes.** `myGame`: jogo com `prediction_participation` 1, `prediction_exact` 3 e `mvp_participation` 1 → `points` 4. `PredictionTab` com `jest.useFakeTimers`: depois do `kickoff`, `jest.getTimerCount()` é 0. `mvpCandidates` com a mesma linha duas vezes → 1 candidato (app e servidor). `analytics`: com consentimento negado o Crashlytics nunca recebe o uid; ao aceitar recebe-o; ao retirar recebe `''`. `perfil`/`notificacoes`: o texto novo. `apiSportsSync`: 1 modalidade a falhar gera um só `INGEST_ALERT`.
- [ ] **Step 2:** Correr os testes acima. Esperado: FAIL.
- [ ] **Step 3:** Implementar cada linha; `npm install` depois de fixar versões (sem mudar o lock além dos especificadores).
- [ ] **Step 4:** Verificação completa das duas pastas e `npx expo-doctor`. Esperado: PASS.
- [ ] **Step 5:** Commit `fix: plan 2 and plan 4 parked minors`.

### Task 11: Fichas das lojas, privacidade e página de apagar conta

**Files:**
- Create: `store/listing.pt-PT.json`, `store/privacidade-lojas.md`, `store/capturas.md`, `mobile/src/content/termsHtml.ts`, `hosting/public/privacidade/index.html`, `hosting/public/apagar-conta/index.html`
- Test: `mobile/__tests__/store/listing.test.ts`, `mobile/__tests__/hosting/legalPages.test.ts`

**Interfaces:**
- Consumes: `TERMS` (Task 8, passo 6, para o texto final).
- Produces:
  - `listing.pt-PT.json`: `appStore { name, subtitle, promotionalText, description, keywords, whatsNew, supportUrl, privacyPolicyUrl }` e `googlePlay { title, shortDescription, fullDescription, releaseNotes, privacyPolicyUrl, accountDeletionUrl }`. Nome "S360" (o atual); subtítulo "Agenda, prognósticos e MVP"; a descrição diz no primeiro parágrafo que é uma app de adeptos não oficial, sem ligação ao Sporting Clube de Portugal (regra 5.2 da Apple); lista as funções da Entrega 1 do spec; sem promessas de push. URLs: `https://{host}/privacidade` e `https://{host}/apagar-conta`, com `{host}` de `share.config.json`.
  - `privacidade-lojas.md`: respostas para a App Privacy da Apple e para a Segurança dos dados da Play, derivadas dos Termos: Informações de contacto (nome, email; ligados ao utilizador; funcionalidade da app); Identificadores (ID do utilizador; ligado; funcionalidade, e análise só com consentimento); Conteúdo do utilizador (prognósticos, votos, número de GameBox; ligado; funcionalidade); Dados de utilização (interação; ligado; análise, opcional); Diagnóstico (falhas; não ligado; funcionalidade); sem rastreio, sem publicidade, sem venda; dados cifrados em trânsito; apagar conta na app e na página web.
  - `capturas.md`: lista de ecrãs (Home, Agenda, Detalhe ao vivo, Prognóstico com cartão, MVP com percentagens, Ranking, Notícias, Perfil) com os tamanhos: iPhone 6,9" (1320 × 2868) e 6,5" (1284 × 2778); Play: telemóvel 1080 × 1920 (mínimo 2, até 8) e gráfico de destaque 1024 × 500.
  - `termsToHtml(sections: TermsSection[]): string` (HTML pt-PT com `<h2>` por título e `<p>` por parágrafo, texto escapado, cores do tema como CSS inline). `privacidade/index.html` é exatamente `termsToHtml(TERMS)`; o teste reescreve o ficheiro quando `UPDATE_LEGAL=1`.
  - `apagar-conta/index.html`: como apagar na app (Definições, Apagar conta), o que se apaga (lista do `deleteAccount`) e o pedido por email para `app.scp360@gmail.com` para quem já não tem a app.

- [ ] **Step 1: Escrever os testes.** Limites: App Store `name` e `subtitle` ≤ 30, `promotionalText` ≤ 170, `keywords` ≤ 100 bytes e sem espaço depois das vírgulas, `description` ≤ 4000; Play `title` ≤ 30, `shortDescription` ≤ 80, `fullDescription` ≤ 4000. Nenhum texto em `store/` nem nas duas páginas tem `\u2014` ou `\u2013`; a descrição contém "não oficial". `privacidade/index.html` igual a `termsToHtml(TERMS)` e sem "[A DEFINIR"; `apagar-conta` contém "app.scp360@gmail.com".
- [ ] **Step 2:** `npm test -- listing legalPages`. Esperado: FAIL.
- [ ] **Step 3:** Escrever os textos e gerar a página com `UPDATE_LEGAL=1 npm test -- legalPages`.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run check:tokens`. Esperado: PASS.
- [ ] **Step 5:** Commit `docs: store listings, privacy answers and legal pages`.

### Task 12: Lançamento (paragens com o Martim)

Ordem obrigatória. Cada **PARAGEM** espera o OK explícito do Martim. "Guia §N" é a secção N de `docs/superpowers/notes/2026-12-01-publicacao-plano2.md`, que tem os comandos completos e a reversão (§17). Antes de cada paragem que mexe em produção: verificação completa das duas pastas verde. A §4 (integrar `v2027-app`) já está feita: o `v2027` contém o Plano 3 e o Plano 4.

**Preparação (começar já, em paralelo com as Tasks 1 a 11)**

- [ ] **P1 (PARAGEM): chave de upload da Play.** Se o Martim tiver a keystore de upload da V2 (conta EAS do programador antigo), importá-la com `cd mobile && eas credentials -p android`. Senão: `eas credentials -p android` → exportar o certificado de upload (`.pem`) da keystore da EAS; Play Console → Testar e lançar → Integridade da app → Assinatura da app → "Pedir reposição da chave de upload", anexar o `.pem`. A Google demora uns dias a aprovar: o build Android de produção só sobe depois. Verificar: email de aprovação e a data a partir da qual a chave nova vale.
- [ ] **P2 (PARAGEM): domínio.** Decidir (Pergunta 1) antes de qualquer build:
  - **Domínio próprio** (ex.: `s360-download.app`): comprar num registador; Firebase consola → Hosting → Adicionar domínio personalizado → `s360-download.app`; pôr no DNS os registos TXT e A que a consola mostrar; esperar "Ligado" e o certificado SSL (até 24 h). Verificar: `curl -sI https://s360-download.app/.well-known/apple-app-site-association` dá `200` e `application/json` (depois de P8).
  - **Grátis, segundo site:** `firebase hosting:sites:create s360-download --project scp360-37a74` (só se o nome estiver livre); no `firebase.json`, `hosting` passa a lista com dois objetos iguais ao atual, um com `"site": "scp360-37a74"` e outro com `"site": "s360-download"`; commit. Verificar o mesmo `curl` em `https://s360-download.web.app`.
  - Em ambos: `mobile/share.config.json` → `{ "host": "<novo>", "extraHosts": ["scp360-37a74.web.app"] }`, `npm test`, commit. Fica o `web.app` em `extraHosts` (o emblema e testes já o usam).
  - **Manter** `scp360-37a74.web.app`: nada a fazer. Mudar mais tarde obriga a um build nativo novo.
- [ ] **P3 (PARAGEM): conta de serviço da Play para o `eas submit`.** Google Cloud do projeto da Play → conta de serviço com chave JSON; Play Console → Utilizadores e autorizações → convidar o email da conta de serviço com permissão de lançamentos. Guardar como `mobile/google-play-service-account.json` (ignorado pelo git). Verificar: `git status` não o mostra.
- [ ] **P4 (PARAGEM): decisões pendentes do Plano 3** (`mobile/README.md`): Poppins Light, texto do Google `needsExistingLogin`, nomes longos. Fechadas antes do build de produção.

**Backend em produção (Task 21 do Plano 2, com as Tasks 3, 5, 7 e 9 já integradas)**

- [ ] **P5 (PARAGEM):** Guia §1 (verificações iniciais), §2 (segredos, valores escritos pelo Martim), §3 (fixtures reais e ids da API-Sports). Verificar como no guia.
- [ ] **P6 (PARAGEM):** Guia §5 (índices; responder **não** a apagar).
- [ ] **P7 (PARAGEM):** Guia §8 (alerta por email).
- [ ] **P8 (PARAGEM): Hosting a partir do repositório.** O `firebase.json` já tem `hosting` com `hosting/public` (emblema `/brand`, `.well-known`, `/j`, `/privacidade`, `/apagar-conta`), por isso a pasta temporária do guia §7 deixa de ser precisa. Antes: confirmar que um dos SHA-256 de `hosting/public/.well-known/assetlinks.json` é o "Certificado da chave de assinatura da app" da Play Console (Integridade da app); senão acrescentá-lo e fazer commit. Depois o passo 1 do guia §7 (o site não pode ter conteúdo que não seja nosso) e `firebase deploy --only hosting --project scp360-37a74`. Verificar: `curl -sI https://scp360-37a74.web.app/brand/sporting-cp-2026.png` (`200`, `image/png`), `/.well-known/apple-app-site-association` (`application/json`), `/privacidade` e `/apagar-conta` (`200`).
- [ ] **P9 (PARAGEM): modo sombra.** Guia §6, com o `.env` de 3 linhas (`LEGACY_COLLECTION_PREFIX=_shadow_`, `VSPORTS_SEASON_ID=`, `NEWS_LEGACY_CONTENT=true`). Este deploy já leva o `homeId` dos jogos do quadro (`bracket.ts`), pendente do Plano 4. Verificar: o teste de isolamento do guia e, depois do primeiro `footballStandingsSync`, `legs[].homeId` num `competitions/*/data/bracket`. Comparação do guia §6 depois de N horas.
- [ ] **P10 (PARAGEM): corte dos writers.** Guia §9 completo, com o `.env` `LEGACY_COLLECTION_PREFIX=` e `NEWS_LEGACY_CONTENT=true` (a V2 ainda mostra o `content`). Inclui apagar as 13 antigas, entre elas as HTTP `games` e `backfill` (decisão do Plano 2). Verificar como no guia, incluindo o teste rápido na V2.
- [ ] **P11 (PARAGEM):** Guia §10 (preencher o modelo novo).
- [ ] **P12 (PARAGEM): regras fase 2.** Guia §11 com o `firestore.rules` da Task 7 e §12 (teste da V2 em produção). Verificar também na consola, Regras, que `firestore.final.rules` **não** foi publicado (o deploy só lê `firestore.rules`).
- [ ] **P13 (PARAGEM):** Guia §13 (motor e callables, o `voteMvp` já escreve `mvpTallies`), §14 (`config/app`) e §15 (Apple, fluxo com código OAuth).

**Builds e lojas**

- [ ] **P14 (PARAGEM): preparação dos builds.**
  - Apple Developer → Identifiers → `com.scp360`: capacidades "Sign In with Apple" e "Associated Domains" ligadas.
  - Firebase consola → Definições → app Android `com.scp360`: SHA-1 e SHA-256 da chave de assinatura da Play e da chave de upload da EAS presentes (login Google nos builds da Play).
  - Versão Android: Play Console → Pacote de apps → último `versionCode` da V2 (V2 local tem `17001`, mas vale o da Play). `cd mobile && eas build:version:get -p android`; se for menor ou igual, `eas build:version:set -p android` com o valor da Play mais 1. iOS: a versão `7.0.0` é maior do que `6.1.2`, o número de build da EAS serve.
  - `EAS_BUILD_PROFILE=production npx expo config --type public` passa (Task 8, passo 6, feito).
- [ ] **P15 (PARAGEM, build): dev client para o smoke, só se for preciso.** Se o Martim já tiver um dev client do Plano 4 com a configuração nativa atual (domínio de P2 incluído), não há build: o JS novo carrega pelo Metro. Senão: `cd mobile && eas build --profile development --platform all` (2 builds).
- [ ] **P16 (PARAGEM): smoke em dispositivo, iOS e Android.** As listas "Paragens do Martim" do `mobile/README.md` (parte do dispositivo) e "Smoke em dispositivo (Martim)" do Plano 4, mais: estádio sem o Museu; classificação da Liga com nomes compridos numa linha, com emblemas; MVP mostra percentagens depois de votar e não antes; notícia abre a página original; cartão de partilha com o domínio de P2 e o link abre a app. Anotar o resultado no fim deste plano. Corrigir antes de P17.
- [ ] **P17 (PARAGEM, build): produção.** `cd mobile && eas build --profile production --platform all --auto-submit` (2 builds: iOS vai para o TestFlight, Android para o teste interno da Play). Na primeira submissão iOS a EAS pede a sessão Apple para criar a chave da API do App Store Connect. Verificar: os dois builds aparecem no TestFlight e no teste interno. Sem EAS Update, cada correção a partir daqui é um build novo de produção: só com erro que impeça a submissão.
- [ ] **P18 (PARAGEM): verificação no TestFlight e no teste interno** (backend de produção): entrar com a conta real e com Apple; agenda e detalhe com dados reais; um prognóstico e um voto num jogo real (estes dados apagam-se no L2); partilha; apagar uma conta de teste.
- [ ] **P19 (PARAGEM): submissão até 12/12.**
  - App Store Connect: versão 7.0.0; textos de `store/listing.pt-PT.json`; capturas de `store/capturas.md`; App Privacy de `store/privacidade-lojas.md`; URL de privacidade; questionário de idade; informação para a revisão com uma conta de teste (email e password escritos pelo Martim no App Store Connect, nunca no repositório) e a nota "App de adeptos não oficial; prognóstico até ao apito inicial; MVP do minuto 80 até 20 minutos depois do fim"; escolher o build; **"Lançar manualmente esta versão"**; enviar para revisão.
  - Play Console: ficha principal, Segurança dos dados, URL de privacidade, URL de apagar conta, público-alvo e classificação de conteúdo; **Publicação gerida ligada**; Produção → criar versão a partir do build do teste interno → enviar para revisão.

**Lançamento (depois das duas aprovações)**

- [ ] **L1 (PARAGEM): janela.** Nenhum jogo de futebol do Sporting nas 6 h antes nem depois. `cd functions && npx tsx scripts/check-predeploy.ts --project scp360-37a74` sem falhas.
- [ ] **L2 (PARAGEM): ranking a zero.** `npx tsx scripts/reset-engine.ts --project scp360-37a74 --dry-run` (ver as contagens dos testes do P18), depois sem `--dry-run` e confirmar o id. Verificar: `check-predeploy` mostra o motor `v2027` com 0 em todas as coleções.
- [ ] **L3 (PARAGEM): publicar.** App Store Connect → "Lançar esta versão"; Play Console → Publicação gerida → "Publicar alterações". Verificar: a ficha pública mostra a 7.0.0 nas duas lojas (pode levar horas).
- [ ] **L4 (PARAGEM): versão mínima.** Consola Firestore → `config/app` → `minVersion.ios` e `minVersion.android` = `"7.0.0"`. Só afeta a app nova (a V2 não lê este documento); serve de base para as versões seguintes. Verificar: a app da loja abre sem o ecrã de atualização.
- [ ] **L5 (PARAGEM): regras finais.** No momento decidido na Pergunta 6:
  ```bash
  cp firestore.final.rules firestore.rules
  git rm functions/test/emulator/rules.phase2.test.ts   # a fase 2 acabou; o rules.final continua a correr
  cd functions && npm run test:emulator -- rules && cd ..
  git add firestore.rules && git commit -m "chore: final firestore rules at launch"
  firebase deploy --only firestore:rules --project scp360-37a74
  ```
  Verificar com a app da loja: entrar, GameBox, prognóstico, voto, ranking, perfil, Definições, Conta; nos logs nenhum `PERMISSION_DENIED` da app nova. Voltar atrás: consola, Regras, versão anterior.
- [ ] **L6 (PARAGEM): notícias sem `content`.** `.env.scp360-37a74` com `NEWS_LEGACY_CONTENT=false`, commit, `firebase deploy --only functions:v2027:newsSync --project scp360-37a74`; depois `npx tsx scripts/strip-news-content.ts --project scp360-37a74 --dry-run` e sem `--dry-run`. Verificar: uma notícia nova e uma antiga sem `content`.
- [ ] **L7 (PARAGEM, D+7, opcional):** App Check: consola → App Check → métricas do Firestore; se os pedidos verificados da app nova estiverem perto de 100%, "Aplicar". Apagar a `legacyPredictionSettlement` quando já não houver palpites da V2 por liquidar: `firebase functions:delete legacyPredictionSettlement --region europe-west1 --project scp360-37a74`. Apagar a cópia `pre-corte-*` do balde no prazo dos Termos.

---

## Builds previstos

| Build | Quando | Quantos |
|---|---|---|
| Desenvolvimento (`development`, `all`) | P15, só sem dev client com a configuração nativa final | 0 ou 2 |
| Produção (`production`, `all`, `--auto-submit`) | P17 | 2 |

Uma mudança de domínio depois de P15 ou P17 obriga a repetir esse build: decidir P2 primeiro.

## Perguntas para o Martim

1. **Domínio do link:** comprar `s360-download.app` (ou outro), usar o grátis `s360-download.web.app` (segundo site, se o nome estiver livre) ou manter `scp360-37a74.web.app`? Tem de ficar decidido antes do primeiro build.
2. **Prazos de conservação** (Termos, bloqueia o build). Proposta: conta e perfil enquanto a conta existir e apagados com "Apagar conta"; prognósticos, votos e pontos idem; relatórios de falhas 90 dias (Crashlytics); dados de análise 2 meses (Google Analytics, por omissão); cópias de segurança 30 dias. Aprovar ou corrigir.
3. **Relatórios de falhas:** confirmar "interesse legítimo" como base legal.
4. **Chave de upload da Play:** tens a keystore de upload da V2, ou pedimos a reposição (P1)?
5. **Último `versionCode` da V2** na Play Console.
6. **Regras finais:** no dia do lançamento (cumpre a política de privacidade desde o primeiro dia; quem ainda tem a V2 perde o login por PIN, a GameBox e os palpites até atualizar, sem aviso) ou uns dias depois? Opcional: publicar na V2 uma "notícia" fixa "Atualiza a S360 na loja".
7. **Conta de teste para a revisão da Apple:** criar uma conta de email e password só para isso (o Martim escreve-a no App Store Connect).
8. **Percentagens do MVP:** só depois de votar ou quando a votação fecha (proposta) está bem?
9. **Fichas das lojas:** aprovar nome, subtítulo e textos de `store/`; quem faz as capturas (no telemóvel do Martim ou em simulador)?
10. **Dev client:** já tens um dev client do Plano 4 instalado com a configuração nativa atual (poupa 2 builds)?
11. **Chaves antigas:** rodar no corte as chaves que estavam no código antigo (pergunta do guia §2)?
12. **App Store:** token de fornecedor (parâmetro `pt`) para medir instalações vindas da partilha (opcional).
