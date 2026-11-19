# Plano 8: Empréstimo de GameBox por link

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono empresta uma GameBox para um jogo por um link que só abre na app S360, fica preso à conta de quem o abre primeiro, bloqueia capturas e expira no fim do jogo.

**Architecture:** O servidor guarda cada empréstimo em `loans/{loanId}` (o `loanId` aleatório é o token do link) e o número da GameBox num subdocumento `loans/{id}/secret/number`, legível só pelo destinatário preso enquanto o empréstimo está ativo. Três callables (criar, abrir, cancelar), uma tarefa agendada que recalcula a validade e apaga números, e um gatilho que cancela empréstimos quando a GameBox é apagada. A validade recalcula-se numa tarefa a cada 10 minutos (em vez de ligar ao fecho de prognósticos), porque também tem de seguir jogos remarcados; as regras verificam `expiresAt` na leitura. Sem app, `/e/{id}` reencaminha para a loja; no Android a Play Store devolve o id à app pelo install referrer. A app ganha a ação no detalhe da GameBox, a rota `/e/{id}` e o ecrã do empréstimo com o layout do cartão de prognóstico.

**Tech Stack:** Firebase Functions v2 (europe-west1, codebase v2027), Firestore rules e emulador, Expo SDK 58, Expo Router, RNFirebase, zod, jest-expo, expo-screen-capture.

**Spec:** `docs/superpowers/specs/2026-11-19-emprestimo-gamebox-design.md` (aprovado pelo Martim a 19/11, 20:16).

## Global Constraints

- Tudo entra na versão 7.0.0 (decisão do Martim, 19/11 20:14). Sem builds nem deploy sem o OK explícito do Martim; nunca push.
- Não partir a V2: nada novo nos documentos `gamebox`; as regras novas vão para `firestore.rules` (fase 2) e `firestore.final.rules`.
- O cliente nunca escreve em `loans` nem em `loans/{id}/secret/*`.
- O número da GameBox só é legível pelo destinatário preso, com o empréstimo ativo (`cancelledAt == null` e `expiresAt > request.time`). O dono lê o empréstimo sem o número.
- Validade: início marcado + 4 h; com FT, AET ou PEN: fim + 2 h; adiado sem nova data: hora original + 2 h; segue a hora remarcada enquanto o jogo não começa.
- Só se empresta para o próximo jogo em casa do recinto da GameBox (decisão do Martim, 19/11 20:38: o QR é sempre o mesmo). Um empréstimo ativo no máximo por GameBox; um cancelado pode ser substituído.
- Nomes mostrados: só o nome público (`publicProfiles/{uid}.displayName`), nunca nome completo nem email.
- Sem push (regra do Martim: push só para prognóstico e MVP). Sem pedidos novos à API desportiva.
- Link: `https://s360-prognostico-download.web.app/e/{loanId}` (host de `mobile/share.config.json`).
- Ecrã do empréstimo: `usePreventScreenCapture`, brilho no máximo e ecrã sempre ligado (o mesmo `ticketMode` do modo bilhete).
- Cartão com o layout do cartão de prognóstico (frame 30), extraído e partilhado, não copiado.
- Todos os ecrãs e estados novos têm frame no Figma antes do código.
- V7.1: tokens apenas (`npm run check:tokens`), `Touchable` com estilos em array, alvos de 44 pt, 320 pt sem cortes, PT-PT, sem travessões, sem uid, email ou nomes nos logs.
- Commits com o trailer da sessão (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01PDeJmrF15KjPgyTiQA5q2G`).

## Review Focus

1. Link aberto por uma segunda conta depois de preso: vê "Este empréstimo já foi aberto noutra conta." e nunca o QR (teste no Task 3 e no Task 6).
2. Empréstimo cancelado ou expirado com o ecrã do destinatário aberto: o QR desaparece sem reabrir (o listener do segredo falha por regras e o ecrã passa a "já não está ativo") (teste no Task 6).
3. Destinatário sem sessão, ou acabado de instalar no Android: entra ou cria conta e cai no empréstimo, não na Home; o referrer da Play Store só se usa uma vez (testes no Task 6 e no Task 7).
4. GameBox sem próximo jogo em casa no seu recinto (ou calendário por carregar): a folha mostra um vazio claro e não deixa criar; o servidor recusa jogos que não sejam o próximo (testes no Task 3 e no Task 5).
5. Dono no modo bilhete com a GameBox emprestada para o jogo da faixa: mostra "Emprestada para este jogo", sem QR; noutro jogo mostra o QR normal (teste no Task 5).

---

### Task 1: Frames do empréstimo no Figma

**Files:** nenhum no repositório; Figma `R3IhhyNxNZuVINgUtJjZE3`, página 4912:5041; atualizar `.superpowers/design-v71/06-cobertura-figma.md`.

**Interfaces:**
- Produces: frames com nome "45L ..." (dono) e "50 ..." (destinatário) e os node ids no relatório, usados pelos Tasks 5 a 7.

- [ ] **Step 1:** Carregar `figma:figma-use` e `figma:figma-generate-design`; reutilizar os componentes do quadro 4918:5041 (Button, Header, List row, Foto do jogador, Crest, ModalSheet escuro do frame 30) e as variáveis e estilos V7.1.
- [ ] **Step 2:** Desenhar, ao lado do 45: 45La detalhe com "Emprestar para um jogo"; 45Lb folha de confirmação com o próximo jogo em casa (sem lista nem escolha), vazio "Sem jogos em casa marcados para esta GameBox."; 45Lc detalhe com empréstimo ativo ("Emprestada para {casa} - {fora}", "Ainda não aberto" / "Aberto por {nome} às {HH:MM}", botão "Cancelar empréstimo"); 12L modo bilhete "Emprestada para este jogo".
- [ ] **Step 3:** Desenhar o destinatário: 50 ecrã do empréstimo (cartão do frame 30 com equipas, competição, data e hora, recinto, porta/sector/fila/lugar, QR, "Emprestada por {nome}"); 50b já aberto noutra conta; 50c já não está ativo; 44L linha "Emprestada por {nome}" na lista de GameBox.
- [ ] **Step 4:** Captura de cada frame, uma correção visual no máximo; atualizar o mapa de cobertura; escrever os node ids no relatório.

### Task 2: Modelo e regras dos empréstimos

**Files:**
- Create: `functions/src/loans/model.ts`
- Modify: `firestore.rules`, `firestore.final.rules`, `firestore.indexes.json`
- Test: `functions/test/unit/loansModel.test.ts`, `functions/test/emulator/rules.phase2.test.ts`, `functions/test/emulator/rules.final.test.ts`

**Interfaces:**
- Produces:
  - `type LoanDoc = { ownerUid: string; ownerName: string; gameboxId: string; matchId: string; sport: string; match: LoanMatch; seat: LoanSeat; createdAt: Timestamp; expiresAt: Timestamp; recipientUid: string | null; recipientName: string | null; openedAt: Timestamp | null; cancelledAt: Timestamp | null }`
  - `type LoanMatch = { homeName: string; awayName: string; homeLogo: string | null; awayLogo: string | null; competition: string; kickoff: Timestamp; venue: 'stadium' | 'pavilion' }`
  - `type LoanSeat = { gate: string | null; sector: string | null; row: string | null; seat: string | null }`
  - Segredo: `loans/{id}/secret/number` = `{ number: string }`.
  - `computeExpiresAt(m: { kickoff: Date; status: string; finishedAt: Date | null; postponedWithoutDate: boolean }): Date`
  - `isLoanActive(l: Pick<LoanDoc, 'cancelledAt' | 'expiresAt'>, now: Date): boolean`
  - `newLoanId(): string` (16 bytes aleatórios em base64url, 22 caracteres).

- [ ] **Step 1: Testes do modelo:** `computeExpiresAt` dá kickoff + 4 h para NS e estados em curso; finishedAt + 2 h para FT, AET e PEN; kickoff + 2 h para adiado sem data; `isLoanActive` falso com `cancelledAt` ou com `expiresAt <= now`; `newLoanId` com 22 caracteres `[A-Za-z0-9_-]` e dois ids diferentes.
- [ ] **Step 2: Testes das regras (as duas versões):** o cliente não cria, altera nem apaga `loans/*` nem `loans/*/secret/*`; o dono lê `loans/{id}`; o destinatário preso lê `loans/{id}` e `secret/number` com o empréstimo ativo; o destinatário não lê o segredo com `cancelledAt` posto ou `expiresAt` no passado; outra conta e sem sessão não leem nem o empréstimo nem o segredo; o dono não lê o segredo; consulta `where ownerUid == eu` permitida; `where recipientUid == eu` permitida.
- [ ] **Step 3:** Correr `cd functions && npm test -- loansModel` e o emulador das regras; esperar FALHA.
- [ ] **Step 4:** Implementar `model.ts`; acrescentar `match /loans/{id}` e `match /loans/{id}/secret/{doc}` às duas regras (segredo: `get(/databases/$(database)/documents/loans/$(id))` com `recipientUid == request.auth.uid`, `cancelledAt == null`, `expiresAt > request.time`); índices compostos `loans (ownerUid ASC, createdAt DESC)` e `loans (recipientUid ASC, expiresAt DESC)`.
- [ ] **Step 5:** Correr os testes unitários e os dois ficheiros de regras do emulador; esperar PASSA.
- [ ] **Step 6: Commit** `feat(emprestimo): modelo, validade e regras dos empréstimos de GameBox`.

### Task 3: Callables criar, abrir e cancelar

**Files:**
- Create: `functions/src/callables/loans.ts`
- Modify: `functions/src/index.ts`, `functions/scripts/deployLists.ts`
- Test: `functions/test/emulator/loans.test.ts`

**Interfaces:**
- Consumes: Task 2 (`LoanDoc`, `computeExpiresAt`, `isLoanActive`, `newLoanId`).
- Produces (callables, região europe-west1, como `voteMvp`):
  - `createLoan({ gameboxId: string, matchId: string, number: string }) -> { loanId: string, url: string }`
  - `claimLoan({ loanId: string }) -> { status: 'claimed' | 'owner' }`
  - `cancelLoan({ loanId: string }) -> { ok: true }`
  - Códigos de erro `HttpsError`: `unauthenticated`, `invalid-argument`, `not-found` (empréstimo ou GameBox), `permission-denied` (GameBox de outro dono), `already-exists` (empréstimo ativo para a GameBox e o jogo), `failed-precondition` com `details.reason` em `'claimed-by-other' | 'inactive' | 'not-home' | 'not-next' | 'finished'`.

- [ ] **Step 1: Testes no emulador:**
  - `createLoan` sem sessão: `unauthenticated`; GameBox de outro `userid`: `permission-denied`; jogo inexistente: `not-found`; jogo terminado: `failed-precondition` `finished`; jogo fora de casa (equipa 228 não é a da casa): `not-home`; jogo em casa que não é o próximo não terminado do recinto da GameBox (Estádio: futebol; Pavilhão: as outras modalidades): `not-next`; número vazio ou fora do formato da app: `invalid-argument`.
  - `createLoan` válido: cria `loans/{id}` com `ownerName` do `publicProfiles`, `match` e `seat` congelados (Estádio para futebol, Pavilhão para as outras modalidades, campos vazios a `null`), `expiresAt` de `computeExpiresAt`, e `secret/number`; devolve `url` `https://s360-prognostico-download.web.app/e/{loanId}`.
  - Segundo `createLoan` para a mesma GameBox com um ativo: `already-exists`; depois de `cancelLoan`: cria outro.
  - `claimLoan` pela primeira conta: prende `recipientUid`, `recipientName`, `openedAt`; segunda chamada da mesma conta: `claimed` sem mudar `openedAt`; outra conta: `failed-precondition` `claimed-by-other`; o dono: `{ status: 'owner' }` sem prender; cancelado ou expirado: `inactive`.
  - `cancelLoan` por outra conta: `permission-denied`; pelo dono: `cancelledAt` posto e `secret/number` apagado.
  - Nenhum log com uid, email ou nome (spy no `logger`).
- [ ] **Step 2:** Correr `cd functions && npm run test:emulator -- loans`; esperar FALHA.
- [ ] **Step 3:** O formato válido do número é a mesma regra que `mobile/src/lib/gamebox.ts` aplica antes de cifrar, copiada para o servidor com teste de paridade no estilo de `mobile/__tests__/lib/serverParity.test.ts`. Implementar as três callables em `loans.ts` com transações Firestore (verificação de "um ativo por GameBox" dentro da transação, por consulta `gameboxId == x`); exportar em `index.ts`; acrescentar a `DEPLOY_ENGINE_FUNCTIONS`.
- [ ] **Step 4:** Correr o teste do emulador e `npm test` (inclui `exports.test.ts`); esperar PASSA.
- [ ] **Step 5: Commit** `feat(emprestimo): callables criar, abrir e cancelar empréstimo`.

### Task 4: Ciclo de vida no servidor

**Files:**
- Create: `functions/src/loans/lifecycle.ts`
- Modify: `functions/src/callables/deleteAccount.ts`, `functions/src/index.ts`, `functions/scripts/deployLists.ts`
- Test: `functions/test/emulator/loansLifecycle.test.ts`, `functions/test/emulator/profileAccount.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `loansMaintenance` (agendada a cada 10 minutos): para cada empréstimo ativo, relê o jogo e atualiza `expiresAt` com `computeExpiresAt`; apaga `secret/number` dos que deixaram de estar ativos.
  - `onGameboxDeleted` (gatilho `onDocumentDeleted('gamebox/{id}')`): cancela os empréstimos ativos dessa GameBox e apaga os números.
  - `cancelLoansForUser(db, uid): Promise<number>`: cancela empréstimos em que o uid é dono ou destinatário; usado pelo `deleteAccount`.

- [ ] **Step 1: Testes:** jogo remarcado antes de começar: `expiresAt` segue a nova hora + 4 h; jogo FT com `finishedAt`: fim + 2 h; expirado: segredo apagado e documento mantido; GameBox apagada: empréstimo cancelado e segredo apagado; `deleteAccount` do dono e do destinatário: empréstimos cancelados e segredos apagados; idempotência (duas execuções seguidas sem alterações a mais).
- [ ] **Step 2:** Correr no emulador; esperar FALHA.
- [ ] **Step 3:** Implementar; registar a saúde da tarefa com `runJob` (fonte `loans_maintenance`); listas de deploy atualizadas.
- [ ] **Step 4:** Correr os testes e `npm test`, `npm run lint`, `npm run build`; esperar PASSA.
- [ ] **Step 5: Commit** `feat(emprestimo): validade recalculada, números apagados e cancelamento ao apagar GameBox ou conta`.

### Task 5: App do dono

**Files:**
- Create: `mobile/src/services/loans.ts`, `mobile/src/data/loans.ts`, `mobile/src/components/LoanConfirmSheet.tsx`
- Modify: `mobile/src/data/schemas.ts`, `mobile/app/(app)/gamebox/[id].tsx`, `mobile/app/(app)/gamebox/bilhete.tsx`
- Test: `mobile/__tests__/app/gameboxLoan.test.tsx`, `mobile/__tests__/app/gameboxBilhete.test.tsx`, `mobile/__tests__/services/loans.test.ts`

**Interfaces:**
- Consumes: callables do Task 3; frames 45La, 45Lb, 45Lc e 12L do Task 1.
- Produces:
  - `LoanSchema` (zod, campos do `LoanDoc` com `.catch` como os outros esquemas) e `type Loan`.
  - `createLoan(gameboxId, matchId, number): Promise<{ loanId: string; url: string }>`, `claimLoan(loanId): Promise<'claimed' | 'owner'>`, `cancelLoan(loanId): Promise<void>`, com erros mapeados para `LoanError` (`'claimed-by-other' | 'inactive' | 'not-home' | 'not-next' | 'finished' | 'exists' | 'offline' | 'unknown'`).
  - `useOwnerLoans(gameboxId: string)`: empréstimos ativos dessa GameBox (consulta `ownerUid == eu`, filtrada por `gameboxId` e `isLoanActive` com relógio de 30 s).
  - `useRecipientLoans()`: empréstimos ativos com `recipientUid == eu`.
  - `loanShareText(loan): string` = `Empresto-te a minha GameBox para o {casa} - {fora}. Abre na app S360: {url}`.

- [ ] **Step 1: Testes:**
  - O detalhe mostra "Emprestar para um jogo"; a folha mostra só o próximo jogo em casa não terminado do recinto da GameBox (Estádio: futebol; Pavilhão: as outras), sem lista nem escolha; sem jogo mostra "Sem jogos em casa marcados para esta GameBox." e não há botão de criar.
  - Criar chama `createLoan` com o número decifrado e abre `Share.share` com `loanShareText`; erro `exists` mostra "Já tens um empréstimo ativo para este jogo."
  - Com empréstimo ativo: "Emprestada para {casa} - {fora}", "Ainda não aberto" ou "Aberto por {nome} às {HH:MM}", e "Cancelar empréstimo" (confirmação em ModalSheet) chama `cancelLoan`.
  - Modo bilhete: GameBox emprestada para o jogo da faixa mostra "Emprestada para este jogo" sem QR; noutro jogo mostra o QR.
- [ ] **Step 2:** Correr `cd mobile && npx jest gameboxLoan gameboxBilhete loans`; esperar FALHA.
- [ ] **Step 3:** Implementar a partir dos frames (carregar `figma:figma-design-to-code` antes de `get_design_context`); reutilizar `upcomingHome` e `ticketVenue` em vez de copiar a lógica.
- [ ] **Step 4:** Correr os testes, `npx tsc --noEmit`, `npm run check:tokens`; esperar PASSA.
- [ ] **Step 5: Commit** `feat(emprestimo): emprestar, partilhar e cancelar no detalhe da GameBox`.

### Task 6: App de quem recebe

**Files:**
- Create: `mobile/app/(app)/emprestimo/[id].tsx`, `mobile/src/components/MatchCard.tsx`, `mobile/src/lib/pendingLink.ts`
- Modify: `mobile/src/components/ShareCard.tsx`, `mobile/app/(app)/_layout.tsx`, `mobile/app/(app)/gamebox/index.tsx`, `mobile/package.json`
- Test: `mobile/__tests__/app/emprestimo.test.tsx`, `mobile/__tests__/lib/pendingLink.test.ts`, `mobile/__tests__/components/ShareCard.test.tsx`

**Interfaces:**
- Consumes: Task 5 (`claimLoan`, `LoanSchema`, `useRecipientLoans`); frames 50, 50b, 50c, 44L.
- Produces:
  - `MatchCard({ home, away, competition, kickoff, venue, children })`: o layout comum do frame 30, usado pelo `ShareCard` e pelo empréstimo.
  - `setPendingLink(href: string): void`, `takePendingLink(): string | null` (só aceita caminhos que começam por `/e/` ou `/j`).
  - Rota `/emprestimo/[id]` (o link `/e/{id}` entra pelo Task 7).

- [ ] **Step 1: Testes:**
  - Abrir com sessão chama `claimLoan` uma vez; com `claimed` mostra o cartão (equipas, competição, data e hora, recinto, porta/sector/fila/lugar só os preenchidos, QR do segredo, "Emprestada por {nome}"); o número da GameBox nunca aparece em texto nem em `accessibilityLabel`, só a imagem do QR (decisão do Martim, 19/11 21:03).
  - `claimed-by-other`: "Este empréstimo já foi aberto noutra conta." sem QR; `inactive`: "Este empréstimo já não está ativo." sem QR; `owner`: redireciona para `/gamebox/{gameboxId}`.
  - O listener do segredo a falhar por permissão (cancelado ou expirado com o ecrã aberto) troca para "Este empréstimo já não está ativo." sem reabrir.
  - `usePreventScreenCapture` e o `ticketMode` estão ativos enquanto o ecrã está montado e libertam-se ao sair.
  - Sem sessão: o guarda guarda o link pendente e, depois de entrar, abre `/emprestimo/{id}`; caminhos fora de `/e/` e `/j` são ignorados.
  - A lista de GameBox mostra "Emprestada por {nome}" para os empréstimos recebidos ativos e abre o empréstimo.
  - `ShareCard` continua igual com o `MatchCard` extraído (os testes atuais passam sem mudanças de texto).
- [ ] **Step 2:** `npx expo install expo-screen-capture`; correr `npx jest emprestimo pendingLink ShareCard`; esperar FALHA.
- [ ] **Step 3:** Implementar a partir dos frames; extrair `MatchCard` do `ShareCard`.
- [ ] **Step 4:** Correr os testes, `npx tsc --noEmit`, `npm run check:tokens`; esperar PASSA.
- [ ] **Step 5: Commit** `feat(emprestimo): ecrã do empréstimo com bloqueio de capturas e link pendente depois de entrar`.

### Task 7: Links `/e/{id}`, reencaminhamento para as lojas e referrer do Android

**Files:**
- Create: `mobile/app/e/[id].tsx`, `functions/src/http/loanRedirect.ts`, `mobile/src/lib/installReferrer.ts`
- Modify: `mobile/app.config.ts`, `hosting/public/.well-known/apple-app-site-association`, `firebase.json` (rewrite de `/e/**` para a função `loanRedirect`), `functions/src/index.ts`, `functions/scripts/deployLists.ts`, `mobile/app/_layout.tsx` (ou o ponto de arranque que já trata links), `mobile/package.json`
- Test: o teste de configuração da app existente, `mobile/__tests__/app/linkEmprestimo.test.tsx`, `mobile/__tests__/lib/installReferrer.test.ts`, `functions/test/unit/loanRedirect.test.ts`

**Interfaces:**
- Consumes: rota do Task 6; `setPendingLink` do Task 6.
- Produces:
  - `loanRedirect` (HTTP, europe-west1): para `/e/{id}` com id de 22 caracteres base64url responde 302 para a App Store se o User-Agent for iPhone/iPad, para a Play Store com `&referrer=loan%3D{id}` se for Android, e para a App Store nos outros casos; id inválido: 302 para a loja sem referrer. Sem leitura à Firestore, sem logs com o id. Os URLs das lojas são os que `/j` já usa.
  - `readLoanReferrerOnce(): Promise<string | null>`: só Android; lê `getInstallReferrerAsync()`, extrai `loan` (22 caracteres base64url), guarda que já foi lido e nas aberturas seguintes devolve `null`; erros da API devolvem `null`.

- [ ] **Step 1: Testes:** intent filter Android com `pathPrefix: '/e/'` além de `/j`; AASA com `"/e/*"` além de `"/j*"`; `/e/{id}` na app com id válido redireciona para `/emprestimo/{id}` e com id inválido para `/`; `loanRedirect` com User-Agent de iPhone, Android e outro, e com id inválido; `readLoanReferrerOnce` com referrer válido (devolve o id e na segunda chamada `null`), sem `loan`, com lixo, com erro da API e em iOS (`null`); no arranque, um id do referrer passa por `setPendingLink('/e/{id}')` e abre o empréstimo depois de entrar.
- [ ] **Step 2:** `npx expo install expo-application`; correr os testes; esperar FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr os testes das duas pastas; esperar PASSA.
- [ ] **Step 5: Commit** `feat(emprestimo): link /e, reencaminhamento para as lojas e referrer da Play Store`.

### Task 8: Verificação contra o Figma e notas

**Files:** `docs/superpowers/notes/2026-11-19-v71-verificacao.md`

- [ ] **Step 1:** Para cada frame do Task 1, comparar o código com `get_screenshot` e registar frame, ecrã, diferença e decisão numa secção "## Empréstimo".
- [ ] **Step 2:** Corrigir diferenças pequenas não intencionais; o resto fica "pendente Martim".
- [ ] **Step 3:** Correr toda a bateria: `cd functions && npm test && npm run lint && npm run build && npm run test:emulator`; `cd mobile && npx jest && npx tsc --noEmit && npm run check:tokens`. Esperar tudo verde.
- [ ] **Step 4: Commit** `docs: verificação Figma do empréstimo de GameBox`.

## Depois do plano (paragens do Martim)

- Deploy do servidor (regras fase 2 com `loans`, índices, `createLoan`, `claimLoan`, `cancelLoan`, `loansMaintenance`, `onGameboxDeleted`, `deleteAccount`) e do hosting (rewrite `/e` para `loanRedirect`, AASA): só com OK.
- Builds de produção 7.0.0 com tudo dentro: só com OK. O link `/e`, o bloqueio de capturas e o brilho verificam-se nesses builds.
- No lançamento (passo L5), publicar `firestore.final.rules`, que fecha a leitura pública das GameBox: o empréstimo depende disso.
