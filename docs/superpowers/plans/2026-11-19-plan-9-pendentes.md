# Plano 9: Fechar todos os pendentes antes da build

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Não fica nada por fazer antes da build 7.0.0 (Martim, 19/11 22:17): todos os "pendente Martim" das notas de verificação e todos os itens estacionados dos planos 7 e 8 ficam resolvidos no código e no Figma.

**Architecture:** Sem funcionalidades novas além do canal de TV e do aviso ao dono. O canal de TV entra como campo `tv` do jogo, resolvido no servidor por uma regra de direitos da época e por um documento de exceções editável; não há fonte pública gratuita com o número do canal (pesquisa de 19/11: a API-Football não tem TV, a TheSportsDB quase não cobre a Sport TV em Portugal, a Liga e a Sport TV não têm API aberta). O resto são correções pequenas, alinhadas pelo Figma, que é a referência.

**Tech Stack:** Firebase Functions v2 (europe-west1, codebase v2027), Firestore rules e emulador, Expo SDK 58, Expo Router, NativeWind, RNFirebase, zod, jest-expo, Reanimated, MMKV.

**Spec:** `docs/superpowers/notes/2026-11-19-v71-verificacao.md` (secção "Pendentes Martim"), `docs/superpowers/specs/2026-11-19-emprestimo-gamebox-design.md` e os ledgers `.superpowers/sdd/2026-11-19-plan-7-v71-design/progress.md` e `.superpowers/sdd/2026-11-19-plan-8-emprestimo-gamebox/progress.md`.

## Global Constraints

- Sem builds, sem deploy e sem push. Só código, testes e Figma.
- Não partir a V2: nada novo nos documentos `gamebox`; regras novas nas duas versões (`firestore.rules` e `firestore.final.rules`), iguais.
- O cliente nunca escreve em `loans`. O número da GameBox nunca aparece em texto a quem recebe.
- Sem uid, email, nomes, número de GameBox nem id de empréstimo em logs, analytics ou Crashlytics.
- Push só para prognóstico e MVP. Sem pedidos novos à API desportiva.
- O Figma é a referência (ficheiro `R3IhhyNxNZuVINgUtJjZE3`, página 4912:5041): onde o código e o frame divergem sem decisão registada, muda o código; estado novo sem frame ganha frame.
- V7.1: tokens apenas (`npm run check:tokens`), `Touchable` com estilos em array, alvos de 44 pt, 320 pt sem cortes, PT-PT, sem travessões.
- Copy nova deste plano, exata: "Fonte: API-Football"; "Números do jogo"; "Posse de bola"; "Remates"; "Golos esperados (xG)"; "Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado."; canais "SPORT TV", "BTV", "TVI / V+".
- Commits com o trailer `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01PDeJmrF15KjPgyTiQA5q2G`.

## Review Focus

1. Classificação ao vivo quando a tabela oficial já inclui o jogo em curso: a equipa não soma duas vezes (Task 3).
2. Jogo sem canal conhecido (taças, Europa, outras modalidades, época seguinte): o chip não aparece, nunca um canal errado (Tasks 2 e 3).
3. Empréstimo cujo documento já foi apagado pela limpeza: quem recebeu vê "Este empréstimo já não está ativo.", não um erro (Tasks 2 e 3).
4. Ecrãs com esqueleto em vez de roda: o esqueleto sai quando há dados, erro ou vazio, e nunca fica preso (Task 4).
5. Folhas e estados vazios partilhados (48b, 21b, 35f, 36f, 47): a correção de espaçamento não desalinha os outros ecrãs (Task 4).

---

### Task 1: Frames em falta no Figma

**Files:** nenhum no repositório além de `.superpowers/design-v71/06-cobertura-figma.md`.

**Interfaces:**
- Produces: node ids dos frames novos no relatório, usados pelos Tasks 3 a 5.

- [ ] **Step 1:** Carregar `figma:figma-use` e `figma:figma-generate-design`; reutilizar componentes, variáveis e estilos V7.1 do quadro 4918:5041. Ler no código o que se desenha (`mobile/app/(app)/gamebox/bilhete.tsx` para os pontos de página; `mobile/src/components/Skeleton.tsx` para o esqueleto).
- [ ] **Step 2:** `12s GameBox · Modo bilhete · várias GameBox`: cópia do 12 (4936:7161) com os pontos de página por baixo do cartão, iguais aos do código (tamanho, cor, espaçamento), 3 pontos com o primeiro ativo.
- [ ] **Step 3:** Frames "a carregar" com o esqueleto do frame 47 (4952:9006) dentro do cabeçalho real de cada ecrã: `35c Agenda`, `36c Competição`, `22c Perfil`, `38c Equipa`, `39c Jogador`, `40c Marcadores`, `41c Comunidade` (usar o número do frame de cada ecrã na página; se o número for outro, usar o da página e dizê-lo no relatório).
- [ ] **Step 4:** `45Lr Empréstimo · quem recebeu apagou a conta`: detalhe da GameBox (45La) com um aviso por cima do botão "Emprestar para o próximo jogo": texto "Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado." e um X para fechar (44 pt), no estilo do aviso "Sem ligação" do frame 47.
- [ ] **Step 5:** No frame 06 (4924:6268), trocar as descrições dos lances por texto que os dados dão: no golo do Sporting, "Assistência de Pedro Gonçalves"; no golo do FC Porto, sem segunda linha (não há assistência nos dados). O resto do frame fica.
- [ ] **Step 6:** Nos frames 01 e 35, o chip do canal passa a "SPORT TV" (sem número).
- [ ] **Step 7:** Captura de cada frame novo ou alterado, uma correção visual no máximo; atualizar o mapa de cobertura; node ids no relatório.

### Task 2: Servidor

**Files:**
- Create: `functions/src/football/tvChannel.ts`
- Modify: `functions/src/loans/model.ts`, `functions/src/loans/lifecycle.ts`, `functions/src/callables/loans.ts`, o módulo que escreve os documentos de jogo de futebol (localizar onde `matches` recebe `competition` e `kickoff`), `functions/src/index.ts` se preciso
- Test: `functions/test/unit/tvChannel.test.ts`, `functions/test/emulator/loansLifecycle.test.ts`, `functions/test/emulator/loans.test.ts`, o teste do escritor de jogos, `mobile/__tests__/lib/serverParity.test.ts`

**Interfaces:**
- Produces:
  - `LoanDoc.cancelReason: 'owner' | 'gamebox-edited' | 'gamebox-deleted' | 'recipient-left' | 'owner-left' | null` (nulo enquanto ativo e nos documentos antigos).
  - `resolveTvChannel(m: { leagueId: number; season: number; homeName: string; awayName: string }, overrides: Record<string, string>, matchId: string): string | null`
  - Campo `tv: string | null` nos documentos de jogo de futebol.
  - Documento de exceções `config/tvChannels` = `{ overrides: { [matchId]: string } }`, lido pelo servidor (leitura pública negada ao cliente se o resto de `config` o for; seguir o que já existe).

- [ ] **Step 1: Testes do canal de TV:** Liga Portugal (liga 94), época 2026: Sporting em casa dá "SPORT TV"; fora no Benfica dá "BTV"; fora no Moreirense dá "TVI / V+"; fora noutro dá "SPORT TV"; outra liga ou outra época dá `null`; exceção com texto ganha à regra; exceção com texto vazio dá `null`; nomes comparados sem acentos nem maiúsculas ("SL Benfica", "Benfica").
- [ ] **Step 2: Testes dos empréstimos:** cada caminho de cancelamento grava o seu `cancelReason` (dono, edição, GameBox apagada, conta do destinatário apagada, conta do dono apagada); `loansMaintenance` apaga o documento do empréstimo e o segredo 7 dias depois de `expiresAt` ou de `cancelledAt` (o que vier primeiro) e não toca nos mais recentes; os erros de `onGameboxUpdated` e de `onGameboxDeleted` saem para o registo só com função e código (como `safely()`), e a função volta a lançar para a nova tentativa; `claimLoan` de um empréstimo já apagado dá `not-found`.
- [ ] **Step 3: Teste de paridade:** a frase-passe de `functions/src/loans/gameboxNumber.ts` é igual à de `mobile/src/lib/gameboxCrypto.ts` (ler os dois ficheiros no teste, como os outros testes de `serverParity`; o valor nunca aparece na mensagem de falha).
- [ ] **Step 4:** Correr os testes; esperar FALHA.
- [ ] **Step 5:** Implementar. O escritor de jogos lê `config/tvChannels` no máximo uma vez por execução e grava `tv` sem pedidos novos à API.
- [ ] **Step 6:** `cd functions && npm test && npm run lint && npm run build` e o emulador (`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u GLOBAL_AGENT_HTTPS_PROXY -u JAVA_TOOL_OPTIONS npm run test:emulator`); esperar PASSA.
- [ ] **Step 7: Commit** `feat(pendentes): canal de TV, motivo do cancelamento e limpeza dos empréstimos`.

### Task 3: App, dados

**Files:**
- Modify: `mobile/src/data/schemas.ts`, `mobile/src/lib/liveStandings.ts`, `mobile/src/components/NextMatchCard.tsx`, `mobile/src/components/GameHeader.tsx`, `mobile/src/components/match/StatsTab.tsx`, `mobile/app/(app)/agenda.tsx`, `mobile/app/(app)/perfil/index.tsx`, `mobile/src/components/GameboxCard.tsx`, `mobile/src/components/HomeGameboxSheet.tsx`, `mobile/app/(app)/gamebox/[id].tsx`, `mobile/src/data/loans.ts`, `mobile/src/services/loans.ts`, `mobile/app/(app)/emprestimo/[id].tsx`
- Test: os testes existentes de cada ficheiro, mais casos novos

**Interfaces:**
- Consumes: `tv` e `cancelReason` do Task 2; frame `45Lr` do Task 1.
- Produces: `MatchSchema.tv` e `MatchSchema.statusRaw` (os dois `nullish`); `formatGameboxNumber(n: string): string` (grupos de 4, só para mostrar); `useOwnerLoanNotice(gameboxId): { loanId: string } | null`.

- [ ] **Step 1: Testes:**
  - Chip do canal: aparece em `NextMatchCard` e `GameHeader` quando `tv` tem texto e não aparece com `null`, vazio ou ausente.
  - `StatsTab` usa `statusRaw` do esquema, sem `as`.
  - Classificação ao vivo: se `played` oficial de uma equipa já é maior do que os jogos terminados dessa equipa na lista de jogos (sem contar o jogo em curso), a projeção não soma esse jogo a essa equipa; se for igual, soma como hoje.
  - Histórico do perfil: o título é "{casa} {x}-{y} {fora}" com os nomes curtos do jogo; enquanto o jogo não chega, ou se faltar, fica "{data} · Final {x}-{y}".
  - Calendário: "Fonte: API-Football" por baixo da lista de futebol; as outras fontes continuam como estão.
  - Número da GameBox no ecrã em grupos de 4 ("0012 3456 7890") nos frames 43 e 44; o texto copiado e o QR continuam sem espaços.
  - Emprestar: o botão já não depende do separador aberto; usa o próximo jogo em casa mais próximo entre os recintos com lugar preenchido e, se nenhum tiver lugar, entre os dois.
  - Aviso ao dono: com um empréstimo dessa GameBox cancelado com `recipient-left` e `expiresAt` no futuro, o detalhe mostra "Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado." com X; fechar guarda o id em MMKV e o aviso não volta.
  - `claimLoan` com `not-found` mostra "Este empréstimo já não está ativo."
- [ ] **Step 2:** `cd mobile && npx jest` nos ficheiros tocados; esperar FALHA.
- [ ] **Step 3:** Implementar a partir dos frames (carregar `figma:figma-design-to-code` antes de `get_design_context`).
- [ ] **Step 4:** `npx jest && npx tsc --noEmit && npm run check:tokens`; esperar PASSA.
- [ ] **Step 5: Commit** `feat(pendentes): canal de TV, tabela ao vivo sem dupla contagem, histórico com equipas e aviso ao dono`.

### Task 4: App, visual

**Files:**
- Modify: `mobile/src/components/ModalSheet.tsx`, `mobile/src/components/EmptyState.tsx`, `mobile/src/components/Skeleton.tsx`, `mobile/src/components/match/SummaryTab.tsx`, os ecrãs com roda de carregamento ao nível do ecrã (`agenda.tsx`, `competicao/[key].tsx`, `perfil/index.tsx`, `equipa/index.tsx`, `equipa/marcadores.tsx`, `equipa/jogador/[id].tsx`, `comunidade.tsx`), `mobile/app/(app)/gamebox/bilhete.tsx`, `mobile/src/components/Countdown.tsx`, `mobile/src/theme/tokens.ts`
- Test: os testes existentes de cada ficheiro, mais casos novos

**Interfaces:**
- Consumes: frames do Task 1 (12s, 35c, 36c, 22c e os outros "c"); frames 06, 45Lb, 48b, 21b, 50b, 50c, 47.

- [ ] **Step 1: Testes:**
  - `ModalSheet`: espaço de 14 entre elementos e título a 28 pt do topo, como nos frames 45Lb, 48b e 21b (confirmar os três antes de mexer; se algum divergir, vale o componente do quadro 4918:5041).
  - `EmptyState`: o espaçamento dos frames 50b e 50c (8 em cima, 24 até ao botão) sem mexer nos frames 35f, 36f e 47; se os frames pedirem dois espaçamentos, uma propriedade `compact`.
  - Ecrãs: a roda ao nível do ecrã passa a `SkeletonRows`; o esqueleto dá lugar aos dados, ao erro ou ao vazio. As rodas dentro de botões ficam.
  - Sumário ao vivo: bloco "Números do jogo" no topo com "Posse de bola", "Remates" e "Golos esperados (xG)", só as linhas com dados dos dois lados, e nada se não houver nenhuma; nos lances, uma segunda linha só com o que os dados dão (assistência, penálti, autogolo, quem entra e quem sai).
  - Modo bilhete: sem cartão a piscar quando não há jogo na faixa; brilho e ecrã ligado só depois de o QR estar no ecrã e nunca por trás do `BiometricGate`; faixa com o nome curto do clube.
  - `Countdown`: o trinco de "a correr" volta ao início quando `to` muda.
  - Jogo terminado com erro nos lances: o contexto do jogo não aparece por baixo do `EmptyState`.
- [ ] **Step 2:** `npx jest` nos ficheiros tocados; esperar FALHA.
- [ ] **Step 3:** Implementar a partir dos frames. Limpar o que ficou anotado: comentário "SEM FIGMA" por cima de `shareCardWidth` em `tokens.ts`, JSDoc antigo por cima de `Prediction` em `SummaryTab.tsx`, margem de silêncio do QR do cartão de partilha a 8 pt, rótulo do confronto direto sem cortar a 320 pt.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit && npm run check:tokens`; esperar PASSA.
- [ ] **Step 5: Commit** `feat(pendentes): esqueletos, números do jogo no sumário ao vivo e espaçamentos pelo Figma`.

### Task 5: ESLint, verificação contra o Figma e notas

**Files:**
- Create: `mobile/eslint.config.js`
- Modify: `mobile/package.json`, `docs/superpowers/notes/2026-11-19-v71-verificacao.md`

- [ ] **Step 1:** Configuração plana do ESLint para a app com `eslint-config-expo` (`npx expo lint` cria-a); `npm run lint` corre e termina sem erros. Corrigir erros reais; regras só de estilo que obrigariam a reescrever ficheiros inteiros ficam desligadas com um comentário de uma linha a dizer porquê.
- [ ] **Step 2:** Comparar com `get_screenshot` cada frame novo ou alterado deste plano com o código e registar numa secção "## Pendentes fechados (plano 9)".
- [ ] **Step 3:** Na secção "Pendentes Martim", marcar cada um dos 11 como fechado, com o commit.
- [ ] **Step 4:** Bateria completa: `cd functions && npm test && npm run lint && npm run build` e o emulador; `cd mobile && npx jest && npx tsc --noEmit && npm run check:tokens && npm run lint`. Tudo verde.
- [ ] **Step 5: Commit** `chore(pendentes): ESLint a correr e notas de verificação fechadas`.

## Depois do plano

- O que só se vê em dispositivo (fontes DIN, contagem a 320 pt, cabeçalho a recolher, brilho, bloqueio de capturas, link `/e`, referrer, zoom do Estádio, ícone do Face ID, permissão `WRITE_SETTINGS`) fica para a build.
- O Martim preenche `config/tvChannels` quando quiser o número do canal ("SPORT TV1") ou um jogo fora da Liga.
