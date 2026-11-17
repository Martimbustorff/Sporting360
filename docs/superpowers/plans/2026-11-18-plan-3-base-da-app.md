# Plano 3: Base da app

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a app nova em `mobile/` (Expo, Expo Router, NativeWind com os tokens `s360`, fontes, componentes base fiéis ao Figma), com autenticação email/Google/Apple, desbloqueio biométrico, nomes públicos, apagar conta e atualização obrigatória, pronta a receber os ecrãs do Plano 4.

**Architecture:** App nova de raiz na pasta `mobile/` do repositório (rotas em `mobile/app/`, código em `mobile/src/`), ao lado de `functions/` e `legacy/`, que não se mexem fora do que este plano diz. A lógica pura (versões, bloqueio biométrico, nomes públicos, erros de auth, formatação de jornadas) fica em `mobile/src/lib/` e é testada com Jest. O Firebase fica atrás de `mobile/src/services/` para os testes o substituírem por mocks. Os componentes base recebem props de apresentação (view-models), não documentos do Firestore, para não dependerem do modelo `games` do Plano 2. Três callables novas (`updateProfile`, `deleteAccount`, `linkProviderByEmail`) entram em `functions/` com os padrões do Plano 1 (codebase `v2027`, `europe-west1`, handler puro mais `onCall`, testes no emulator). A app antiga na raiz só é retirada na última tarefa.

**Tech Stack:** Expo SDK 58 (lançado a 15/10/2026, RN 0.88) ou o SDK estável mais recente à data da implementação; TypeScript strict; Expo Router; NativeWind (versão fixada pelo exemplo oficial `with-nativewind` desse SDK); React Native Firebase (app, auth, firestore, functions, crashlytics, analytics, app-check); `@react-native-google-signin/google-signin`; `expo-apple-authentication`; `expo-local-authentication`; `expo-secure-store`; `expo-application`; `expo-crypto`; `expo-font`; `expo-splash-screen`; `react-native-mmkv` (só para limpar dados da V2); `zod`; jest-expo + `@testing-library/react-native`. Backend: o stack do Plano 1 mais `jose` (verificação do token Apple) e `google-auth-library` (token Google).

**Spec:** `docs/superpowers/specs/2026-11-17-scp360-v2027-design.md` (secções 2, 3, 5.1, 5.2, 5.11 a 5.16, 7, 8 e 9). Roteiro: `docs/superpowers/plans/2026-11-17-v2027-roadmap.md` (Plano 3, 24/11 a 1/12). Contratos do backend: `docs/superpowers/plans/2026-11-17-plan-1-fundacao-motor-pontos.md`, `functions/src/callables/*.ts`, `firestore.rules`.

## Global Constraints

- iOS `bundleIdentifier: com.scp360`, Android `package: com.scp360`. Projeto Firebase `scp360-37a74`; reutilizar `google-services.json` e `GoogleService-Info.plist` da raiz (são os mesmos da V2).
- Versão da app `7.0.0` (a V2 em produção é `6.1.2`; a nova tem de ser maior para ser uma atualização).
- Builds EAS só na conta Expo **do Martim**, num projeto EAS **novo** (não usar o `projectId` nem o `owner: wonderyb` da V2).
- Cores, fontes, espaçamentos e raios só a partir de `mobile/src/theme/tokens.ts` ou das classes `s360-*`. Nenhum hex, `rgb(` ou nome de fonte fora de `mobile/src/theme/`.
- Fontes: títulos em maiúsculas com `DinCondensedBold`; texto com `Poppins`, `PoppinsMedium`, `PoppinsSemiBold`. Por omissão `DinCondensedBold` aponta para D-DIN Condensed Bold (OFL); trocar pela DIN licenciada muda um só ficheiro (`mobile/src/theme/fontAssets.ts`).
- Valores visuais vêm do Figma `R3IhhyNxNZuVINgUtJjZE3` (páginas "Last Version S360" e "Calendário") via Figma MCP: carregar o skill `figma:figma-design-to-code`, `create_session`, depois `get_design_context` com o nó indicado em cada componente. Não inventar valores; se o Figma não tiver o elemento, compor com os tokens e marcar `// SEM FIGMA:` no topo do ficheiro.
- Textos da app em pt-PT. Erros de autenticação nunca revelam se um email existe.
- O email nunca aparece fora do perfil privado do próprio. Nome público: `displayName` validado; sem nome, `Sportinguista #` + 4 últimos caracteres do uid.
- Login Apple só em iOS (regra 4.8 da Apple). Ligação Apple segundo a secção 9 do spec.
- O PIN da V2 desaparece. A biometria é só uma barreira local sobre a sessão Firebase; não guarda passwords nem credenciais.
- Atualização obrigatória: lê `config/app`. Se o documento não existir, não se conseguir ler ou tiver valores inválidos, **não bloqueia**.
- Callables: região `europe-west1`, codebase `v2027`, nunca `firebase deploy --only functions` sem nomes. Este plano **não publica** nada (regras, functions ou builds de loja).
- O Plano 3 não depende de dados do Plano 2: tudo se testa com mocks e com o emulator mais fixtures.
- Não fazer commit de tokens de debug do App Check, `.env` ou chaves.

## Review Focus

1. **Utilizador que atualiza da V2** (sessão Firebase guardada, sem `publicProfiles`, `users` só com `name` e `email`, ou nem isso) → abre a app nova já com sessão, ganha o nome público pelo `updateProfile({})` e nunca vê o email como nome. Sem sessão, cai no Welcome sem erro. (Testes nas Tasks 9 e 12.)
2. **`config/app` ausente, malformado ou sem rede** → a app não bloqueia ninguém. (Teste na Task 17.)
3. **Biometria desativada no sistema depois de ligada na app** (sem Face ID/impressão inscrita) → a app não fica presa no ecrã de bloqueio: desliga a opção e entra. (Teste na Task 15.)
4. **Login Apple com "ocultar o meu email"** ou com email igual a uma conta existente → no primeiro caso mostra a mensagem do spec e não cria conta duplicada sem aviso; no segundo liga as contas. (Testes nas Tasks 11 e 14.)
5. **Nome público com `@`, só espaços, emojis ou 60 caracteres**, ou escrito diretamente em `users/{uid}` → recusado pela callable e pelas regras; o ranking nunca mostra um email. (Testes nas Tasks 9 e 16.)

---

## Estrutura de ficheiros

```
mobile/
  app.json, eas.json, package.json, tsconfig.json, babel.config.js, metro.config.js
  tailwind.config.js, global.css, nativewind-env.d.ts, jest.config.js, jest.setup.ts
  google-services.json, GoogleService-Info.plist     cópias dos da raiz
  assets/fonts/                                       D-DIN Condensed Bold, Poppins 400/500/600, OFL.txt
  assets/images/                                      logo S360, splash, ícone
  app/                                                rotas Expo Router
    _layout.tsx                                       fontes, providers e gates
    (auth)/_layout.tsx, welcome.tsx, entrar.tsx, criar-conta.tsx, recuperar-password.tsx, termos.tsx
    (app)/_layout.tsx, index.tsx                      home provisória (o Plano 4 substitui)
    (app)/perfil/nome.tsx, (app)/apagar-conta.tsx, (app)/ligar-apple.tsx
    dev/galeria.tsx                                   galeria de componentes (só __DEV__)
  src/theme/        tokens.ts, fontAssets.ts, typography.tsx
  src/lib/          version.ts, biometricPolicy.ts, publicName.ts, displayName.ts, authErrors.ts, formatRound.ts
  src/services/     firebase.ts, auth.ts, social.ts, profile.ts, account.ts, biometrics.ts, legacyCleanup.ts
  src/data/         hooks.ts, schemas.ts, fixtures.ts
  src/providers/    SessionProvider.tsx, UpdateGate.tsx, BiometricGate.tsx
  src/components/   Screen, Header, PrimaryButton, TextField, Tabs, GameHeader, CompetitionBadge,
                    EventRow, SectionBar, MenuRow, Sheet, NewsCard, RankingRow (um ficheiro cada)
  src/content/      termos.ts
  scripts/          seed-emulator.mjs, check-tokens.mjs
  __tests__/        espelha src/ e app/
functions/src/callables/   updateProfile.ts, deleteAccount.ts, linkProviderByEmail.ts, validation.ts
functions/test/emulator/   profileAccount.test.ts, linkProvider.test.ts, rules.phase1.test.ts (acrescentar)
firestore.rules, firestore.indexes.json                acrescentos pontuais
```

## Mapa do Figma (ficheiro `R3IhhyNxNZuVINgUtJjZE3`)

| Elemento | Nós |
|---|---|
| Header | `564:6950` (com fundo, "Nova Conta"), `500:28788` (Calendário) |
| Botão principal / secundário | `564:7259` ("Entrar"), `564:7261` ("Criar uma conta") |
| Campo de texto | `564:6907` (vazio, com olho), `564:6938` (preenchido, com etiqueta) |
| Tabs | `500:28814` (2 tabs de largura igual), `500:28976` (tabs com scroll do jogo) |
| Cabeçalho do jogo | `500:28956` (futuro), `655:31868` (ao vivo com resultado e "Live - 23’") |
| Badge de competição | `500:29054` (grande, "J16"), `500:28830` (pequeno), `500:28917` ("Liga Europa") |
| Linha de evento | `655:31908` (cartão, lado direito), `655:31916` (substituição, lado esquerdo) |
| Barra de secção | `655:31905` ("1ª Parte" e "0-0"), `655:31960` (linha de informação) |
| Linha de menu | `564:7096` (AGENDA, seta direita), `564:6990` (link externo, seta diagonal) |
| Folha (sheet) | `564:6981` (recolhida), `564:7119` (GameBox aberta) |
| Linha de ranking | sem frame; base: linha da classificação `500:29416` e círculo de posição `500:29423` |
| Cartão de notícia | sem frame; compor com tokens (ver Pergunta 1) |
| Ecrãs de auth | Welcome `564:7178`, Entrar `564:6896`, Criar conta `564:6926`, Recuperar `564:6956`, Termos `564:7164`, Splash `564:7339` |
| Bloqueio biométrico | basear no layout da secção "PIN Code" `310:9622`, sem teclado |

---

### Task 1: Projeto `mobile/` com Expo Router e Jest

**Files:**
- Create: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/babel.config.js`, `mobile/metro.config.js`, `mobile/jest.config.js`, `mobile/jest.setup.ts`, `mobile/app/_layout.tsx`, `mobile/app/(app)/index.tsx`
- Create: `mobile/.gitignore` (`node_modules/`, `.expo/`, `ios/`, `android/`, `*.log`, `.env*`)
- Test: `mobile/__tests__/app/smoke.test.tsx`

**Interfaces:**
- Produces: scripts `npm test` (jest-expo), `npm run typecheck` (`tsc --noEmit`), `npm run start` (`expo start --dev-client`).

- [ ] **Step 1:** Antes de criar, carregar os skills `expo:expo-overview` e `expo:expo-project-structure` e confirmar a versão estável do SDK (`npx create-expo-app@latest --help`, changelog em expo.dev). Usar SDK 58 ou o mais recente estável. Node 22.13+ (exigido pelo SDK 58).
- [ ] **Step 2:** `npx create-expo-app@latest mobile --template default` e reduzir ao mínimo: Expo Router, TypeScript com `"strict": true` e `"noUncheckedIndexedAccess": true`, alias `@/*` para `src/*`. Em `app.json`: `name: "S360"`, `slug: "s360"`, `scheme: "s360"`, `version: "7.0.0"`, `orientation: "portrait"`, `userInterfaceStyle: "dark"`, `ios.bundleIdentifier` e `android.package` `com.scp360`, `ios.supportsTablet: false`, `experiments.typedRoutes: true`. Sem `extra.eas.projectId` (vem na Task 18).
- [ ] **Step 3:** Escrever `smoke.test.tsx`: renderiza `app/(app)/index.tsx` com `@testing-library/react-native` e espera o texto `S360`.
- [ ] **Step 4:** `cd mobile && npm test`. Esperado: falha (ecrã por criar).
- [ ] **Step 5:** Criar `(app)/index.tsx` com um `Text` "S360" e `_layout.tsx` com um `Stack` sem header.
- [ ] **Step 6:** `npm test && npm run typecheck`. Esperado: 1 passed, sem erros de tipos. Confirmar com `git status` que nada fora de `mobile/` mudou.
- [ ] **Step 7:** Commit `chore(mobile): expo router app skeleton with jest`.

### Task 2: Tema, NativeWind e fontes

**Files:**
- Create: `mobile/src/theme/tokens.ts` (cópia de `src/theme/tokens.ts` da raiz, mais `fontSize` se o Figma o exigir), `mobile/src/theme/fontAssets.ts`, `mobile/src/theme/typography.tsx`, `mobile/tailwind.config.js`, `mobile/global.css`, `mobile/nativewind-env.d.ts`, `mobile/scripts/check-tokens.mjs`
- Create: `mobile/assets/fonts/D-DINCondensed-Bold.otf`, `Poppins-Regular.ttf`, `Poppins-Medium.ttf`, `Poppins-SemiBold.ttf`, `OFL.txt`
- Modify: `mobile/app/_layout.tsx` (carregar fontes e segurar o splash)
- Test: `mobile/__tests__/theme/tokens.test.ts`, `mobile/__tests__/theme/typography.test.tsx`

**Interfaces:**
- Produces:
  - `FONT_ASSETS: Record<'DinCondensedBold' | 'Poppins' | 'PoppinsMedium' | 'PoppinsSemiBold', number>` (o `require` de cada ficheiro). Único sítio a mudar para usar a DIN licenciada.
  - `<Display variant="screenTitle" | "heroTitle" | "menuItem" | "minute" | "sectionScore" | "scoreBox">` e `<Body variant="body" | "strip" | "sectionLabel" | "tab" | "badge">`, que aplicam `type` de `tokens.ts` (o `Display` força maiúsculas).
  - Classes Tailwind `bg-s360-bg`, `text-s360-primary`, etc. (as mesmas chaves de `colors` em `tailwind.config.js`, sem as cores legadas) e `font-display`, `font-body`, `font-bodyMedium`, `font-bodySemiBold`.
  - `npm run check:tokens`: falha se encontrar `#[0-9a-fA-F]{3,8}\b`, `rgba?\(` ou nomes de fonte em `mobile/app/**` ou `mobile/src/**` fora de `mobile/src/theme/`.

- [ ] **Step 1:** Seguir o exemplo `with-nativewind` do SDK escolhido (skill `expo:expo-examples`) para instalar NativeWind e as versões exatas de Tailwind. Se for NativeWind 5 (Tailwind 4), as cores vão para `@theme` em `global.css`; senão para `tailwind.config.js`. Em ambos os casos os valores são os de `tokens.ts`.
- [ ] **Step 2:** Descarregar D-DIN Condensed Bold (Datto, OFL) e Poppins 400/500/600 (Google Fonts, OFL) para `assets/fonts/` com o `OFL.txt`.
- [ ] **Step 3: Escrever os testes.**
  - `tokens.test.ts`: cada cor de `tokens.colors` usada no Tailwind tem o mesmo valor na config do Tailwind (lida com `require` ou do CSS); `Object.keys(FONT_ASSETS)` é exatamente `['DinCondensedBold','Poppins','PoppinsMedium','PoppinsSemiBold']`, que são os valores de `fonts` em `tokens.ts`.
  - `typography.test.tsx`: `<Display variant="menuItem">Agenda</Display>` tem `style` com `fontFamily: 'DinCondensedBold'`, `fontSize: 20` e `textTransform: 'uppercase'`; `<Body variant="tab">` tem `fontFamily: 'PoppinsMedium'`.
- [ ] **Step 4:** `npm test -- theme`. Esperado: falha.
- [ ] **Step 5:** Implementar. Em `_layout.tsx`, `useFonts(FONT_ASSETS)` com `SplashScreen.preventAutoHideAsync()` e esconder quando carregam. O splash nativo (`expo-splash-screen` em `app.json`) usa fundo `#001B13` (valor de `colors.bg`, único hex permitido fora do tema por ser config nativa) e o logo do nó `564:7339`.
- [ ] **Step 6:** `npm test -- theme && npm run check:tokens`. Esperado: passa.
- [ ] **Step 7:** Commit `feat(mobile): s360 theme, nativewind and fonts`.

### Task 3: Camada Firebase (RNFB, emulator, App Check)

**Files:**
- Create: `mobile/src/services/firebase.ts`, `mobile/__mocks__/@react-native-firebase/*.ts` (app, auth, firestore, functions, crashlytics, analytics, app-check)
- Modify: `mobile/app.json` (plugins `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/crashlytics`, `@react-native-firebase/app-check`, `expo-build-properties` com `ios.useFrameworks: "static"` se a doc do RNFB para o SDK o exigir; `ios.googleServicesFile`, `android.googleServicesFile`)
- Copy: `google-services.json`, `GoogleService-Info.plist` da raiz para `mobile/`
- Test: `mobile/__tests__/services/firebase.test.ts`

**Interfaces:**
- Produces:
  - `emulatorHost(platform: 'ios' | 'android', override?: string): string`: `override` se existir, senão `'10.0.2.2'` em Android e `'127.0.0.1'` em iOS.
  - `initFirebase(): void`: idempotente. Se `process.env.EXPO_PUBLIC_USE_EMULATOR === '1'`, liga auth (9099), firestore (8080) e functions (5001) ao `emulatorHost(Platform.OS, process.env.EXPO_PUBLIC_EMULATOR_HOST)`. Ativa o App Check com o provider debug em `__DEV__`, `appAttestWithDeviceCheckFallback` em iOS e `playIntegrity` em Android (sem enforcement). Crashlytics só recolhe fora de `__DEV__`.
  - `db()`, `fns()` (sempre `firebase.app().functions('europe-west1')`), `authInstance()`.
  - `setAnalyticsUser(uid: string | null): Promise<void>`: só o uid, nunca email ou nome.

- [ ] **Step 1: Escrever os testes.** `emulatorHost('android')` → `'10.0.2.2'`; `emulatorHost('ios')` → `'127.0.0.1'`; `emulatorHost('android','192.168.1.20')` → `'192.168.1.20'`. Com `EXPO_PUBLIC_USE_EMULATOR='1'`, `initFirebase()` chama `useEmulator` de auth com `http://10.0.2.2:9099` (Platform mockado para android) e de firestore com porta 8080; chamada duas vezes, liga só uma vez. `fns()` foi pedido com `'europe-west1'`. `setAnalyticsUser('abc')` chama `setUserId('abc')` e nenhum `setUserProperty` com `@`.
- [ ] **Step 2:** `npm test -- firebase`. Esperado: falha.
- [ ] **Step 3:** Instalar os pacotes RNFB compatíveis com o SDK (`npx expo install`), escrever os mocks manuais (só o que os testes e as Tasks seguintes usam) e implementar.
- [ ] **Step 4:** `npm test -- firebase && npm run typecheck`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): firebase services with emulator switch and app check`.

### Task 4: Hooks de dados tipados e fixtures

**Files:**
- Create: `mobile/src/data/schemas.ts`, `mobile/src/data/hooks.ts`, `mobile/src/data/fixtures.ts`, `mobile/scripts/seed-emulator.mjs`
- Test: `mobile/__tests__/data/hooks.test.tsx`, `mobile/__tests__/data/schemas.test.ts`

**Interfaces:**
- Consumes: `db()` (Task 3)
- Produces:
  - `type Loadable<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'missing' } | { status: 'error'; error: Error }`
  - `useDocument<T>(path: string | null, schema: z.ZodType<T>): Loadable<T>`: `onSnapshot`; `path` null → `loading` sem subscrever; documento inexistente → `missing`; falha do `schema` → `error` (e `crashlytics().recordError`).
  - `useCollection<T>(query: FirebaseFirestoreTypes.Query | null, schema: z.ZodType<T>): Loadable<Array<T & { id: string }>>`: documentos inválidos são descartados um a um, não falham a lista.
  - Schemas: `AppConfigSchema = { minVersion: { ios: string; android: string }; storeUrls?: { ios?: string; android?: string } }` (passthrough para os campos do Plano 2), `PublicProfileSchema = { displayName: string; avatarId: string | null }`, `UserDocSchema` (privado: `name?`, `email?`, `displayName?`, `partnerNumber?`, `gameboxNumber?` e restantes campos da V2 como opcionais, passthrough).
  - `useAppConfig()`, `usePublicProfile(uid: string | null)`, `useMyUser(uid: string | null)`.
  - `seed-emulator.mjs`: recusa correr sem `FIRESTORE_EMULATOR_HOST`; escreve `config/app` com `minVersion` `7.0.0`/`7.0.0`, um `users`/`publicProfiles` de teste e as fixtures de `fixtures.ts`.

- [ ] **Step 1: Escrever os testes** (firestore mockado com um `onSnapshot` controlável):
  - documento válido → `loading` e depois `ready` com os dados;
  - documento inexistente → `missing`;
  - `config/app` sem `minVersion` → `error`, sem exceção no render;
  - `useCollection` com 3 documentos, um inválido → 2 itens, cada um com `id`;
  - desmontar o componente chama o `unsubscribe`;
  - `path` null → nunca chama `onSnapshot`.
- [ ] **Step 2:** `npm test -- data`. Esperado: falha.
- [ ] **Step 3:** Implementar. `seed-emulator.mjs` usa `firebase-admin` (devDependency de `mobile/`) com `projectId: 'scp360-37a74'` e só fala com o emulator.
- [ ] **Step 4:** `npm test -- data`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): typed firestore hooks, schemas and emulator fixtures`.

### Task 5: Componentes base A: Screen, Header, PrimaryButton, TextField, Tabs

**Files:**
- Create: `mobile/src/components/{Screen,Header,PrimaryButton,TextField,Tabs}.tsx`
- Test: `mobile/__tests__/components/{Header,PrimaryButton,TextField,Tabs}.test.tsx`

**Interfaces:**
- Produces:
  - `Screen({ children, scroll?: boolean, padded?: 'match' | 'wide' | 'none' })`: fundo `s360-bg`, safe area, `spacing.screenX` ou `spacing.screenXWide`.
  - `Header({ title: string; onBack?: () => void; right?: ReactNode })`: altura `layout.headerHeight`, fundo `bgHeader` com blur `layout.headerBlur` (`expo-blur`), título `screenTitle`. Botão voltar com `accessibilityLabel="Voltar"`.
  - `PrimaryButton({ label: string; onPress: () => void; variant?: 'primary' | 'secondary'; loading?: boolean; disabled?: boolean })`: altura `layout.buttonHeight`, raio `radius.sheet`. `loading` mostra indicador e ignora toques.
  - `TextField({ label: string; value: string; onChangeText: (v: string) => void; secure?: boolean; error?: string; keyboardType?; autoComplete?; textContentType? })`: variante vazia (`564:6907`) e preenchida com etiqueta (`564:6938`); `secure` mostra o botão do olho com `accessibilityLabel` "Mostrar password"/"Esconder password".
  - `Tabs<K extends string>({ items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; mode: 'equal' | 'scroll' })`: tab ativa com sublinhado `primary`, inativas `textDisabled` sobre `divider`.

- [ ] **Step 1:** Para cada componente: `get_design_context` no nó do mapa do Figma e anotar no topo do ficheiro, em comentário, o nó usado.
- [ ] **Step 2: Escrever os testes.**
  - `Header`: mostra o título em maiúsculas; sem `onBack` não há botão "Voltar"; com `onBack`, carregar chama-o.
  - `PrimaryButton`: carregar chama `onPress`; com `loading` ou `disabled`, carregar não chama e `accessibilityState.disabled` é true.
  - `TextField`: `secure` esconde o texto (`secureTextEntry` true) e o olho alterna; `error` aparece como texto e `accessibilityHint`.
  - `Tabs`: carregar "Resultados" chama `onChange('results')`; a tab ativa tem `accessibilityState.selected` true.
  - Um snapshot (`toJSON()`) por componente no estado por omissão.
- [ ] **Step 3:** `npm test -- components`. Esperado: falha.
- [ ] **Step 4:** Implementar com classes `s360-*` e `typography.tsx`.
- [ ] **Step 5:** `npm test -- components && npm run check:tokens`. Esperado: passa.
- [ ] **Step 6:** Commit `feat(mobile): base components header, button, text field, tabs`.

### Task 6: Componentes base B: CompetitionBadge, GameHeader, EventRow, SectionBar

**Files:**
- Create: `mobile/src/lib/formatRound.ts`, `mobile/src/components/{CompetitionBadge,GameHeader,EventRow,SectionBar}.tsx`
- Test: `mobile/__tests__/lib/formatRound.test.ts`, `mobile/__tests__/components/{CompetitionBadge,GameHeader,EventRow}.test.tsx`

**Interfaces:**
- Produces:
  - `formatRound(raw: string | null | undefined): string`: traduz e é idempotente. Tabela exata:

    | Entrada | Saída |
    |---|---|
    | `Regular Season - 11`, `J11`, `11` | `J11` |
    | `League Stage - 3`, `League Phase - 3` | `Fase de liga · J3` |
    | `Group Stage - 2`, `Group A - 2` | `Fase de grupos · J2` |
    | `Round of 32` | `16 avos de final` |
    | `Round of 16`, `8th Finals` | `Oitavos de final` |
    | `Quarter-finals` | `Quartos de final` |
    | `Semi-finals` | `Meias-finais` |
    | `Final` | `Final` |
    | `1st Round`, `2nd Round`, `3rd Round`, `4th Round` | `1.ª eliminatória` ... `4.ª eliminatória` |
    | `Play-offs`, `Knockout Round Play-offs`, `Qualifying Round` | `Play-off`, `Play-off`, `Pré-eliminatória` |
    | vazio ou null | `''` |
    | qualquer outra | o texto original, sem prefixo `J` acrescentado |

    O Plano 2 pode gravar o texto já traduzido; por isso a função aceita as saídas como entradas.
  - `CompetitionBadge({ label: string; size: 'lg' | 'sm' })`: aplica `formatRound(label)`.
  - `type TeamVM = { name: string; crestUrl: string | null }`
  - `type GameHeaderVM = { competitionName: string; round: string; home: TeamVM; away: TeamVM; state: 'scheduled' | 'live' | 'finished'; kickoff: Date; tv?: string | null; minute?: number | null; score?: { home: number; away: number } | null }`
  - `GameHeader({ game: GameHeaderVM; tabs?: ReactNode })`: faixa de estado (`Próximo`, `Live - 23’`, `Terminado`), emblemas `layout.crestSize`, badge, data em pt-PT (`Domingo, 13` ou `14 Set` e hora `20:30`, fuso `Europe/Lisbon`), caixas de resultado (`type.scoreBox`) quando há `score`.
  - `type EventVM = { minute: string; side: 'home' | 'away'; kind: 'goal' | 'yellow' | 'red' | 'sub' | 'var'; primary: string; secondary?: string }`
  - `EventRow({ event: EventVM })`: lado esquerdo para `home`, direito para `away`, ícone `layout.eventIcon`, cores `cardYellow`/`cardRed`.
  - `SectionBar({ label: string; right?: string })` e `InfoRow({ label: string; value: string })` (no mesmo ficheiro `SectionBar.tsx`).

- [ ] **Step 1:** `get_design_context` nos nós do mapa (badge, cabeçalho futuro e ao vivo, eventos, barra de secção).
- [ ] **Step 2: Escrever os testes.**
  - `formatRound`: uma asserção por linha da tabela; `formatRound(formatRound('Round of 16')) === 'Oitavos de final'`; `formatRound('Round of 32')` nunca contém `Round`.
  - `GameHeader` agendado: mostra `PRÓXIMO`, `J16`, os dois nomes e `20:30` para `kickoff` `2026-09-14T19:30:00Z`; não mostra resultado.
  - `GameHeader` ao vivo com `minute: 23` e `score 3-0`: mostra `Live - 23’`, `3` e `0`.
  - `EventRow` de `home` tem o minuto antes do nome; de `away` depois; `kind: 'red'` tem `accessibilityLabel` "Cartão vermelho".
- [ ] **Step 3:** `npm test -- formatRound components`. Esperado: falha.
- [ ] **Step 4:** Implementar (datas com `Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon' })`; se o motor JS do SDK não suportar o fuso, usar `date-fns-tz`).
- [ ] **Step 5:** `npm test && npm run check:tokens`. Esperado: passa.
- [ ] **Step 6:** Commit `feat(mobile): game header, competition badge, event rows`.

### Task 7: Componentes base C: MenuRow, Sheet, NewsCard, RankingRow

**Files:**
- Create: `mobile/src/components/{MenuRow,Sheet,NewsCard,RankingRow}.tsx`, `mobile/src/lib/relativeTime.ts`
- Test: `mobile/__tests__/components/{MenuRow,Sheet,NewsCard,RankingRow}.test.tsx`, `mobile/__tests__/lib/relativeTime.test.ts`

**Interfaces:**
- Produces:
  - `MenuRow({ icon: ReactNode; label: string; onPress: () => void; external?: boolean })`: seta direita ou diagonal (`external`), separador `divider`.
  - `Sheet({ title: string; collapsedHeight: number; expandedHeight: number; open: boolean; onOpenChange: (o: boolean) => void; children })`: folha fixa no fundo com raio `radius.sheet`, toque no título e arrastar alternam; animação com Reanimated e Gesture Handler (skill `expo:expo-animation`); respeita "reduzir movimento".
  - `relativeTime(date: Date, now: Date): string` em pt-PT: `<1 min` → `agora`; `há 5 min`; `há 1 hora`, `há 3 horas`; `ontem`; `há 4 dias`; ≥ 7 dias → `12 nov.` (data curta pt-PT).
  - `type NewsVM = { id: string; title: string; imageUrl: string | null; source: string; publishedAt: Date; sport?: string }`
  - `NewsCard({ news: NewsVM; now: Date; onPress: (id: string) => void })`: fotografia (placeholder com tokens se null), título, fonte e `relativeTime`.
  - `type RankingVM = { position: number; uid: string; displayName: string; points: number; avatarId?: string | null }`
  - `RankingRow({ row: RankingVM; highlighted: boolean })`: posição em círculo, nome público, pontos; `highlighted` destaca o próprio utilizador.

- [ ] **Step 1:** `get_design_context` em `564:7096`, `564:6990`, `564:6981`, `564:7119`, `500:29416`, `500:29423`. `NewsCard` e `RankingRow` levam `// SEM FIGMA:` e a nota "a validar pelo Martim na galeria" até haver frame (ver Pergunta 1).
- [ ] **Step 2: Escrever os testes.**
  - `relativeTime` para `now = 2026-11-17T12:00:00Z`: `11:59:30Z` → `agora`; `11:55Z` → `há 5 min`; `11:00Z` → `há 1 hora`; `2026-11-16T10:00Z` → `ontem`; `2026-11-13T12:00Z` → `há 4 dias`; `2026-11-05T12:00Z` → `5 nov.`.
  - `MenuRow` com `external` tem `accessibilityRole="link"`; sem, `button`; carregar chama `onPress`.
  - `Sheet`: com `open=false` o conteúdo tem `accessibilityElementsHidden`; carregar no título chama `onOpenChange(true)`.
  - `NewsCard` com `imageUrl: null` renderiza sem erro e mostra a fonte; carregar chama `onPress('n1')`.
  - `RankingRow` com `displayName: 'Sportinguista #1234'` mostra-o tal e qual; `highlighted` tem `accessibilityLabel` com "Tu".
- [ ] **Step 3:** `npm test -- components relativeTime`. Esperado: falha.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** `npm test && npm run check:tokens`. Esperado: passa.
- [ ] **Step 6:** Commit `feat(mobile): menu row, sheet, news card, ranking row`.

### Task 8: Galeria de componentes (só em desenvolvimento)

**Files:**
- Create: `mobile/app/dev/galeria.tsx`
- Modify: `mobile/app/(app)/index.tsx` (link "Galeria" visível só em `__DEV__`)
- Test: `mobile/__tests__/app/galeria.test.tsx`

**Interfaces:**
- Consumes: todos os componentes das Tasks 5 a 7 e `fixtures.ts`.

- [ ] **Step 1: Escrever os testes.** Com `__DEV__` true, a galeria renderiza um título de secção por componente (`Header`, `PrimaryButton`, `TextField`, `Tabs`, `GameHeader`, `CompetitionBadge`, `EventRow`, `SectionBar`, `MenuRow`, `Sheet`, `NewsCard`, `RankingRow`) e o `GameHeader` em estado agendado e ao vivo. Com `__DEV__` false, a rota faz `Redirect` para `/`.
- [ ] **Step 2:** `npm test -- galeria`. Esperado: falha.
- [ ] **Step 3:** Implementar com dados de `fixtures.ts`, incluindo casos extremos: nome de equipa longo (`Sporting Clube de Portugal B`), `formatRound('Round of 32')`, nome público de 20 caracteres, notícia sem imagem.
- [ ] **Step 4:** `npm test`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): dev-only component gallery`.

### Task 9: Callable `updateProfile`, `publicProfiles` e regras

**Files:**
- Create: `functions/src/callables/validation.ts` (mover para aqui `validGameId` de `submitPrediction.ts`, que passa a importá-lo), `functions/src/callables/updateProfile.ts`
- Modify: `functions/src/index.ts` (exportar `updateProfile`), `firestore.rules`
- Test: `functions/test/emulator/profileAccount.test.ts`, `functions/test/emulator/rules.phase1.test.ts` (acrescentar casos), `functions/test/unit/validation.test.ts`

**Interfaces:**
- Consumes: `publicName` (`functions/src/data/profiles.ts`), `periodKeys` (`functions/src/time/periods.ts`)
- Produces:
  - `validateDisplayName(raw: unknown): { ok: true; value: string } | { ok: false; error: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARS' | 'HAS_AT' }`: `trim`, espaços internos colapsados num só, 3 a 20 code points, `^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$` com flag `u`, sem `@` (o `HAS_AT` tem prioridade sobre `INVALID_CHARS`).
  - `validAvatarId(v: unknown): v is string | null`: null ou `^[a-z0-9-]{1,32}$`.
  - `handleUpdateProfile(db, auth, data, now): Promise<{ displayName: string; avatarId: string | null }>` e `updateProfile = onCall({ region: 'europe-west1' }, ...)`.
    - `data` pode ter `displayName` e/ou `avatarId`; `{}` garante o perfil público (chamado pela app depois de cada login).
    - Escreve `users/{uid}.displayName` (só se veio no pedido) e `publicProfiles/{uid}` = `{ displayName: publicName(users doc atualizado, uid), avatarId, updatedAt }`.
    - Se o nome mudou, atualiza `displayName` em `leaderboards/{week|month|season}_{key}/entries/{uid}` dos períodos de `periodKeys(now)`, só se a entrada existir.
    - Erros: `unauthenticated`; `invalid-argument` com a mensagem igual ao código de erro de `validateDisplayName` ou `INVALID_AVATAR`.
  - Regras: `publicProfiles/{uid}` leitura pública, escrita negada; `config/{id}` leitura pública, escrita negada; `users/{uid}`: o `create` não pode ter `displayName` e o `update` não pode alterar `displayName` (`!request.resource.data.diff(resource.data).affectedKeys().hasAny(['displayName'])`). A V2 nunca escreve `displayName`, por isso não parte.

- [ ] **Step 1: Escrever os testes.**
  - Unit `validation.test.ts`: `'  Leão   77 '` → ok `'Leão 77'`; `'ab'` → `TOO_SHORT`; 21 letras → `TOO_LONG`; `'a@b.pt'` → `HAS_AT`; `'Leão 🦁'` → `INVALID_CHARS`; `'   '` → `TOO_SHORT`; `"D'Alva-Sá"` → ok; `'Ç'.repeat(20)` → ok.
  - Emulator: sem sessão → `unauthenticated`; `{}` para um utilizador V2 só com `{ name: 'MARTIM BUSTORFF', email: 'm@x.pt' }` → `publicProfiles/u1.displayName == 'Martim Bustorff'` e nenhum campo de `publicProfiles` contém `@`; `{}` sem `users` doc → `'Sportinguista #' + uid.slice(-4)`; `{ displayName: 'Leão 77' }` com entradas existentes em `week_2026-W47`, `month_2026-11` e `season_2026-2027` (now `2026-11-17T12:00:00Z`) → as três ficam com `'Leão 77'` e não se criam entradas noutros períodos; `{ displayName: 'a@b.pt' }` → `invalid-argument` `HAS_AT`; `{ avatarId: 'X Y' }` → `INVALID_AVATAR`.
  - Regras: leitura anónima de `publicProfiles/u1` e `config/app` permitida; escrita em ambos negada, mesmo pelo dono; `alice` a atualizar `users/alice` com `displayName` negado; com `name` permitido; criar `users/alice` com `displayName` negado. Os testes de regras existentes continuam a passar.
- [ ] **Step 2:** `cd functions && npm test -- validation && npm run test:emulator -- profileAccount rules.phase1`. Esperado: falha nos casos novos.
- [ ] **Step 3:** Implementar. Guardar o mesmo conjunto de vetores de teste num comentário de `validation.ts` porque a app duplica a regra na Task 16.
- [ ] **Step 4:** Repetir o Step 2 e `npm run lint`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(callables): updateProfile with public profiles and displayName rules`.

### Task 10: Callable `deleteAccount`

**Files:**
- Create: `functions/src/callables/deleteAccount.ts`
- Modify: `functions/src/index.ts`, `firestore.indexes.json` (`fieldOverrides` para `entries.uid` com âmbito `COLLECTION_GROUP`)
- Test: `functions/test/emulator/profileAccount.test.ts` (acrescentar)

**Interfaces:**
- Produces:
  - `REAUTH_MAX_AGE_S = 300`
  - `handleDeleteAccount(db, authAdmin, auth: { uid: string; token: { auth_time: number } } | undefined, nowSeconds: number): Promise<{ ok: true; deleted: number }>` e `deleteAccount = onCall({ region: 'europe-west1', timeoutSeconds: 120 }, ...)`.
    - `nowSeconds - auth_time > 300` → `failed-precondition` `REAUTH_REQUIRED`.
    - Apaga, com `BulkWriter`: `users/{uid}`, `publicProfiles/{uid}`, `gamebox` com `userid == uid`, `matchPredictions` e `mvpVotes` com `userId == uid`, `predictions`, `manofmatch` e `rankings` da V2 com `userId == uid`, `pointEvents` com `uid == uid` e `collectionGroup('entries')` com `uid == uid`. Depois `authAdmin.deleteUser(uid)`; `auth/user-not-found` conta como sucesso (repetir é seguro).
    - Não toca em documentos de outros utilizadores nem em `settlements`.

- [ ] **Step 1: Escrever os testes (emulator).** Semear `alice` e `bob` com um documento em cada coleção acima e entradas em dois leaderboards.
  - `auth_time` há 301 s → `REAUTH_REQUIRED` e nada é apagado.
  - `auth_time` há 10 s → `ok`; nenhum documento de `alice` sobra em nenhuma coleção; todos os de `bob` ficam; `getUser('alice')` dá `auth/user-not-found`.
  - Repetir a chamada → `ok` com `deleted: 0`.
  - Sem sessão → `unauthenticated`.
- [ ] **Step 2:** `npm run test:emulator -- profileAccount`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(callables): deleteAccount with recent-login check`.

### Task 11: Callable `linkProviderByEmail` (ligação automática Apple e Google)

**Files:**
- Create: `functions/src/callables/linkProviderByEmail.ts`, `functions/src/auth/verifyIdToken.ts`
- Modify: `functions/src/index.ts`, `functions/package.json` (`jose`, `google-auth-library`)
- Test: `functions/test/emulator/linkProvider.test.ts`

**Interfaces:**
- Produces:
  - `type VerifiedIdentity = { provider: 'apple.com' | 'google.com'; sub: string; email: string; emailVerified: boolean; isPrivateRelay: boolean }`
  - `verifyIdToken(provider: 'apple' | 'google', idToken: string, rawNonce?: string): Promise<VerifiedIdentity>`: Apple com o JWKS `https://appleid.apple.com/auth/keys`, `iss` `https://appleid.apple.com`, `aud` `com.scp360`, `nonce == sha256(rawNonce)`; Google com `OAuth2Client.verifyIdToken`, `aud` igual ao web client id `394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com` ou ao iOS client id da V2. `isPrivateRelay` é true para emails `@privaterelay.appleid.com`.
  - `handleLinkProviderByEmail(authAdmin, data, verify = verifyIdToken): Promise<{ linked: boolean; reason?: 'NO_ACCOUNT' | 'PRIVATE_RELAY' | 'ALREADY_LINKED' | 'EMAIL_NOT_VERIFIED' }>` e o `onCall` (sem sessão obrigatória: quem chama ainda não entrou).
    - Token inválido → `unauthenticated`.
    - Email não verificado → `{ linked: false, reason: 'EMAIL_NOT_VERIFIED' }`; relay → `PRIVATE_RELAY`; sem conta com esse email → `NO_ACCOUNT`; conta já tem esse provider → `ALREADY_LINKED`.
    - Senão `authAdmin.updateUser(uid, { providerToLink: { providerId, uid: sub, email } })` → `{ linked: true }`.

- [ ] **Step 1: Escrever os testes** (emulator de auth; `verify` injetado como stub):
  - utilizador `a@x.pt` com password, identidade Apple verificada `a@x.pt` → `linked: true` e `getUser` mostra `apple.com` nos `providerData`;
  - email `xyz@privaterelay.appleid.com` → `PRIVATE_RELAY`, sem alterações;
  - email sem conta → `NO_ACCOUNT`; `emailVerified: false` → `EMAIL_NOT_VERIFIED`;
  - segunda chamada → `ALREADY_LINKED`;
  - stub que lança → `unauthenticated`.
  - Unit: `verifyIdToken('apple', ...)` com um JWT assinado por uma chave local e JWKS mockado aceita o `nonce` certo e rejeita `aud` errado, `nonce` errado e token expirado.
- [ ] **Step 2:** `npm test -- verifyIdToken && npm run test:emulator -- linkProvider`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa. `npm run lint` sem erros.
- [ ] **Step 5:** Commit `feat(callables): link apple/google identity to existing account by verified email`.

### Task 12: Sessão e autenticação por email

**Files:**
- Create: `mobile/src/lib/authErrors.ts`, `mobile/src/lib/publicName.ts`, `mobile/src/services/auth.ts`, `mobile/src/services/profile.ts`, `mobile/src/services/legacyCleanup.ts`, `mobile/src/providers/SessionProvider.tsx`
- Modify: `mobile/app/_layout.tsx` (`SessionProvider`, `initFirebase()`, `legacyCleanup()`)
- Test: `mobile/__tests__/lib/authErrors.test.ts`, `mobile/__tests__/lib/publicName.test.ts`, `mobile/__tests__/services/auth.test.ts`, `mobile/__tests__/providers/SessionProvider.test.tsx`

**Interfaces:**
- Consumes: `authInstance()`, `db()`, `fns()`, `setAnalyticsUser` (Task 3); contrato de `updateProfile` (Task 9)
- Produces:
  - `authErrorMessage(code: string | undefined): string`, com a tabela exata:

    | Código | Mensagem |
    |---|---|
    | `auth/invalid-email` | `Email inválido.` |
    | `auth/user-not-found`, `auth/wrong-password`, `auth/invalid-credential` | `Email ou password incorretos.` |
    | `auth/email-already-in-use` | `Já existe uma conta com este email.` |
    | `auth/weak-password` | `A password tem de ter pelo menos 6 caracteres.` |
    | `auth/too-many-requests` | `Demasiadas tentativas. Tenta mais tarde.` |
    | `auth/network-request-failed` | `Sem ligação à internet.` |
    | outro | `Algo correu mal. Tenta outra vez.` |

  - `publicName(user, uid)`: cópia exata de `functions/src/data/profiles.ts`, com os mesmos testes.
  - `signInEmail(email: string, password: string): Promise<void>`, `signUpEmail(name: string, email: string, password: string): Promise<void>` (cria a conta e `users/{uid}` com `{ name, email, createdAt }` em merge, sem `displayName`), `sendReset(email: string): Promise<void>` (engole `auth/user-not-found`), `signOut(): Promise<void>` (também `GoogleSignin.signOut()` se houver sessão Google).
  - `ensureProfile(): Promise<void>`: chama `updateProfile({})`; falhas só vão para o Crashlytics.
  - `useSession(): { status: 'loading' | 'signedOut' | 'signedIn'; user: { uid: string; email: string | null; providers: string[] } | null }`. Ao entrar: `setAnalyticsUser(uid)`, `crashlytics().setUserId(uid)` e `ensureProfile()` uma vez por sessão.
  - `legacyCleanup(): void`: uma vez por instalação, apaga a chave `passcodecert` da instância MMKV por omissão e limpa a instância `app-persist-storage` da V2; marca `s360.legacyCleanupDone` numa instância MMKV nova `s360`.

- [ ] **Step 1: Escrever os testes.**
  - `authErrors`: uma asserção por linha da tabela.
  - `publicName`: os mesmos casos do Plano 1 (`'Leão 77'`, `'MARTIM BUSTORFF'` → `'Martim Bustorff'`, `{}` → `'Sportinguista #1234'` com uid `abcd1234`, nome com `@` ignorado).
  - `auth`: `signUpEmail('Zé','z@x.pt','secret1')` escreve `users/{uid}` com `name`, `email` e sem `displayName`; `sendReset` com `auth/user-not-found` resolve sem erro.
  - `SessionProvider` (**Review Focus 1**): com um utilizador já autenticado ao arrancar (sessão herdada da V2), o estado passa de `loading` a `signedIn` sem passar por `signedOut` e chama `updateProfile` com `{}` uma só vez, mesmo com dois re-renders; sem utilizador → `signedOut`; `ensureProfile` a falhar não muda o estado.
  - `legacyCleanup`: apaga `passcodecert` na primeira chamada e não faz nada na segunda.
- [ ] **Step 2:** `npm test -- authErrors publicName auth SessionProvider legacyCleanup`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): session provider and email auth`.

### Task 13: Ecrãs de autenticação e guardas de rotas

**Files:**
- Create: `mobile/app/(auth)/_layout.tsx`, `welcome.tsx`, `entrar.tsx`, `criar-conta.tsx`, `recuperar-password.tsx`, `termos.tsx`, `mobile/src/content/termos.ts`
- Modify: `mobile/app/(app)/_layout.tsx`, `mobile/app/_layout.tsx`
- Test: `mobile/__tests__/app/auth-flow.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `signInEmail`, `signUpEmail`, `sendReset`, `authErrorMessage`, componentes da Task 5
- Produces: rotas `/(auth)/welcome`, `/entrar`, `/criar-conta`, `/recuperar-password`, `/termos`. Guardas: `signedOut` → só `(auth)`; `signedIn` → só `(app)`; `loading` → nada (o splash continua).
  - `termos.ts`: `TERMS: { title: string; body: string }[]` com o texto de `SCP360_V2-master/src/screens/app/terms.tsx`.

- [ ] **Step 1:** `get_design_context` nos ecrãs Welcome, Entrar, Criar conta, Recuperar e Termos (mapa do Figma). Copiar os textos exatos: "A tua ligação ao universo Verde & Branco", "Esqueces-te Password? Recupera-a", "Novo utilizador? Cria uma conta", "Ao clicar em criar conta aceita os nossos Termos e condições", "Indica o teu email para receberes uma nova password.", botões "Entrar", "Criar uma conta", "Criar conta", "Enviar". Corrigir só "Esqueces-te" para "Esqueceste-te da password?" e "Accesso" para "Acesso" (erros de escrita no Figma).
- [ ] **Step 2: Escrever os testes** (serviços mockados, `expo-router/testing-library`):
  - Welcome → "Entrar" navega para `/entrar`; "Criar uma conta" para `/criar-conta`.
  - Entrar com campos vazios não chama `signInEmail` e mostra "Indica o email e a password."; com erro `auth/invalid-credential` mostra "Email ou password incorretos."; o botão fica em `loading` durante o pedido.
  - Criar conta com nome vazio mostra "Indica o teu nome."; sucesso chama `signUpEmail(nome, email, password)` com o email em minúsculas e sem espaços.
  - Recuperar: sucesso e `auth/user-not-found` mostram a mesma mensagem "Se existir uma conta com este email, vais receber um link para mudar a password."
  - Com sessão `signedIn`, abrir `/entrar` redireciona para `/`.
- [ ] **Step 3:** `npm test -- auth-flow`. Esperado: falha.
- [ ] **Step 4:** Implementar (teclado não tapa o botão: `KeyboardAvoidingView` ou `react-native-keyboard-controller`; `autoComplete`/`textContentType` de email e password para o gestor de passwords).
- [ ] **Step 5:** `npm test && npm run check:tokens`. Esperado: passa.
- [ ] **Step 6:** Commit `feat(mobile): auth screens and route guards`.

### Task 14: Login Google e Apple, com ligação de contas

**Files:**
- Create: `mobile/src/services/social.ts`, `mobile/app/(app)/ligar-apple.tsx`
- Modify: `mobile/app/(auth)/welcome.tsx` e `entrar.tsx` (botões Google e, só em iOS, Apple), `mobile/app.json` (plugin `@react-native-google-signin/google-signin` com o `iosUrlScheme` da V2; `ios.usesAppleSignIn: true`; plugin `expo-apple-authentication`)
- Test: `mobile/__tests__/services/social.test.ts`

**Interfaces:**
- Consumes: `fns()` (`linkProviderByEmail`, Task 11), `db()`
- Produces:
  - Constantes `GOOGLE_WEB_CLIENT_ID` e `GOOGLE_IOS_CLIENT_ID` com os valores de `SCP360_V2-master/src/api/firebase/googleAuth.ts`.
  - `type SocialResult = { status: 'signedIn' } | { status: 'cancelled' } | { status: 'needsExistingLogin'; message: string }`
  - `signInWithGoogle(): Promise<SocialResult>` e `signInWithApple(): Promise<SocialResult>`:
    1. Obter o token (Apple com `nonce` aleatório de `expo-crypto`, enviado em SHA-256).
    2. `signInWithCredential`. Na primeira vez, criar `users/{uid}` com `{ name, email }` em merge (nome do Google ou `fullName` da Apple; se não houver, não escrever `name`).
    3. Se der `auth/account-exists-with-different-credential`, chamar `linkProviderByEmail({ provider, idToken, rawNonce })`. Com `linked: true`, repetir o passo 2 com um token novo (Apple: pedir outra vez; Google: `signInSilently`). Com `PRIVATE_RELAY` ou outra razão, devolver `needsExistingLogin` com a mensagem exata "Já tens conta S360? Entra com o teu método habitual e liga a Apple nas Definições".
    4. Cancelamento do utilizador → `cancelled`, sem mensagem de erro.
  - Login Apple com relay e sem conta existente cria conta nova (regra normal do Firebase); o ecrã mostra antes a nota do spec como texto informativo no botão Apple.
  - `linkAppleToCurrentUser(): Promise<'linked' | 'cancelled' | 'inUse'>` para as Definições (Plano 4); `ligar-apple.tsx` é o ecrã mínimo que a usa. `auth/credential-already-in-use` → `inUse` com "Esta conta Apple já está ligada a outra conta S360.".

- [ ] **Step 1: Escrever os testes** (módulos nativos mockados):
  - Google sucesso, utilizador novo → `signedIn` e `users/{uid}` com `name` e `email`; utilizador existente → não reescreve `name`.
  - Google cancelado (`SIGN_IN_CANCELLED`) → `cancelled`.
  - **Review Focus 4:** Apple com `account-exists-with-different-credential` e `linkProviderByEmail` a devolver `linked: true` → segunda tentativa e `signedIn`; com `PRIVATE_RELAY` → `needsExistingLogin` com a mensagem exata.
  - O `nonce` enviado à Apple é o SHA-256 em hex do `rawNonce` enviado ao Firebase e à callable.
  - `Platform.OS = 'android'`: `welcome.tsx` não mostra o botão Apple.
- [ ] **Step 2:** `npm test -- social`. Esperado: falha.
- [ ] **Step 3:** Implementar, com os botões oficiais (`AppleAuthenticationButton` com estilo branco sobre fundo escuro; Google segundo as regras de marca da Google).
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): google and apple sign-in with account linking`.

### Task 15: Desbloqueio biométrico

**Files:**
- Create: `mobile/src/lib/biometricPolicy.ts`, `mobile/src/services/biometrics.ts`, `mobile/src/providers/BiometricGate.tsx`
- Modify: `mobile/app/_layout.tsx` (envolver `(app)` com o gate), `mobile/app.json` (plugin `expo-local-authentication` com `faceIDPermission: "Permite à S360 usar o Face ID para desbloquear a app."`)
- Test: `mobile/__tests__/lib/biometricPolicy.test.ts`, `mobile/__tests__/providers/BiometricGate.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `signOut`
- Produces:
  - `BIOMETRIC_RELOCK_MS = 5 * 60_000`
  - `shouldLock(s: { enabled: boolean; signedIn: boolean; coldStart: boolean; backgroundedAt: number | null; now: number }): boolean`: verdadeiro sse `enabled && signedIn && (coldStart || (backgroundedAt !== null && now - backgroundedAt >= BIOMETRIC_RELOCK_MS))`.
  - `biometricStatus(): Promise<'available' | 'notEnrolled' | 'noHardware'>`, `biometricLabel(): Promise<'Face ID' | 'Touch ID' | 'impressão digital' | 'biometria'>`
  - `isBiometricEnabled(uid)`, `setBiometricEnabled(uid, on: boolean)`: `expo-secure-store`, chave `s360.biometric.<uid>`.
  - `unlock(): Promise<boolean>`: `authenticateAsync({ promptMessage: 'Desbloquear a S360', cancelLabel: 'Cancelar', disableDeviceFallback: false })`.
  - `BiometricGate`: mostra o ecrã de bloqueio (logo, "Desbloquear com {label}", "Entrar com outra conta") quando `shouldLock`; pede `unlock()` ao aparecer. "Entrar com outra conta" faz `signOut()` e desliga a opção. Depois do primeiro login com biometria disponível e opção nunca respondida, mostra uma vez a folha "Ativar {label}?" com "Ativar" e "Agora não".

- [ ] **Step 1: Escrever os testes.**
  - `shouldLock`: arranque a frio com opção ligada → true; desligada → false; sem sessão → false; regresso após 4 min 59 s → false; após 5 min → true; `backgroundedAt` null sem arranque a frio → false.
  - `BiometricGate`: `unlock` true → mostra os filhos; false → fica no bloqueio com "Tentar outra vez"; **Review Focus 3:** opção ligada mas `biometricStatus()` = `notEnrolled` → desliga a opção, mostra os filhos e não chama `unlock`; "Entrar com outra conta" chama `signOut` e `setBiometricEnabled(uid, false)`.
  - A folha "Ativar" aparece uma vez e "Agora não" grava a resposta (não volta a aparecer).
- [ ] **Step 2:** `npm test -- biometric`. Esperado: falha.
- [ ] **Step 3:** Implementar (`AppState` para `backgroundedAt`; o ecrã de bloqueio segue o layout de `310:9622` sem o teclado).
- [ ] **Step 4:** Repetir e `npm run check:tokens`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): biometric unlock replaces pin`.

### Task 16: Nome público e apagar conta (lado da app)

**Files:**
- Create: `mobile/src/lib/displayName.ts`, `mobile/src/services/account.ts`, `mobile/app/(app)/perfil/nome.tsx`, `mobile/app/(app)/apagar-conta.tsx`
- Modify: `mobile/src/services/profile.ts` (`updateDisplayName`)
- Test: `mobile/__tests__/lib/displayName.test.ts`, `mobile/__tests__/services/account.test.ts`, `mobile/__tests__/app/nome.test.tsx`

**Interfaces:**
- Consumes: `updateProfile` e `deleteAccount` (Tasks 9 e 10), `usePublicProfile` (Task 4), `setBiometricEnabled` (Task 15)
- Produces:
  - `validateDisplayName(raw: string)`: mesma assinatura e mesmos vetores da Task 9. Mensagens: `TOO_SHORT` "O nome tem de ter pelo menos 3 caracteres.", `TOO_LONG` "O nome pode ter no máximo 20 caracteres.", `INVALID_CHARS` "Usa só letras, números, espaços e . _ ' -", `HAS_AT` "O nome não pode ter @.".
  - `updateDisplayName(name: string): Promise<string>` (devolve o nome gravado pelo servidor).
  - `deleteMyAccount(reauth: () => Promise<'ok' | 'cancelled'>): Promise<'deleted' | 'cancelled'>`: chama `deleteAccount`; se der `REAUTH_REQUIRED`, chama `reauth` e tenta uma vez mais. O `reauth` por provider: password → folha com campo password e `reauthenticateWithCredential`; Google → `signInWithGoogle` silencioso ou interativo e `reauthenticateWithCredential`; Apple → novo pedido Apple, `reauthenticateWithCredential` e `auth().revokeToken(authorizationCode)` antes de apagar. No fim: `setBiometricEnabled(uid, false)`, `signOut()` e Welcome com o aviso "Conta apagada.".
  - `apagar-conta.tsx`: explica o que se apaga ("perfil, GameBox, prognósticos, votos e pontos") e pede confirmação escrevendo `APAGAR`.

- [ ] **Step 1: Escrever os testes.**
  - `displayName`: os vetores da Task 9 com o mesmo resultado (**Review Focus 5**).
  - `nome.tsx`: mostra o nome público atual (ou `Sportinguista #1234`); um nome inválido desativa "Guardar" e mostra a mensagem; o erro `invalid-argument` do servidor mostra a mensagem do código devolvido.
  - `account`: `REAUTH_REQUIRED` → chama `reauth` e repete; `reauth` cancelado → `cancelled` e não faz `signOut`; sucesso → `signOut` e `setBiometricEnabled(uid, false)` chamados; utilizador Apple → `revokeToken` chamado antes da segunda chamada a `deleteAccount`.
  - `apagar-conta.tsx`: o botão "Apagar conta" só fica ativo com `APAGAR` escrito.
- [ ] **Step 2:** `npm test -- displayName account nome apagar`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): public name editing and account deletion flow`.

### Task 17: Atualização obrigatória

**Files:**
- Create: `mobile/src/lib/version.ts`, `mobile/src/providers/UpdateGate.tsx`
- Modify: `mobile/app/_layout.tsx` (`UpdateGate` por fora de todos os outros gates)
- Test: `mobile/__tests__/lib/version.test.ts`, `mobile/__tests__/providers/UpdateGate.test.tsx`

**Interfaces:**
- Consumes: `useAppConfig()` (Task 4)
- Produces:
  - `isVersionBelow(current: string, min: string): boolean`: compara numericamente até 3 partes; parte em falta vale 0; qualquer valor que não seja `^\d+(\.\d+){0,2}$` → false.
  - `STORE_URLS = { ios: 'https://apps.apple.com/app/id6450608023', android: 'https://play.google.com/store/apps/details?id=com.scp360' }`; `config/app.storeUrls` sobrepõe-se se existir.
  - `UpdateGate`: com `useAppConfig()` em `ready` e `isVersionBelow(Application.nativeApplicationVersion, minVersion[Platform.OS])`, mostra o ecrã "Atualização necessária", texto "Há uma nova versão da S360. Atualiza para continuar." e o botão "Atualizar", que abre a loja (`Linking.openURL`). Em `loading`, `missing` ou `error`, mostra os filhos.
  - Contrato para o Plano 2: `config/app.minVersion.{ios,android}` (texto semver) e `config/app.storeUrls.{ios,android}` (opcional). O Plano 2 não muda estes nomes.

- [ ] **Step 1: Escrever os testes.**
  - `isVersionBelow`: `('7.0.0','7.0.1')` true; `('7.10.0','7.9.9')` false; `('7.0','7.0.0')` false; `('6.1.2','7.0.0')` true; `('7.0.0','abc')` false; `('7.0.0','')` false; `(null as any,'7.0.0')` false.
  - `UpdateGate` (**Review Focus 2**): `minVersion.ios '7.1.0'` com app `7.0.0` em iOS → ecrã de atualização e o botão abre `STORE_URLS.ios`; `minVersion.android '7.1.0'` com Platform iOS → filhos; `missing` → filhos; `error` (documento malformado) → filhos; o documento passa a exigir mais do que a versão durante a sessão → o ecrã aparece sem reiniciar (`onSnapshot`).
- [ ] **Step 2:** `npm test -- version UpdateGate`. Esperado: falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir e `npm run check:tokens`. Esperado: passa.
- [ ] **Step 5:** Commit `feat(mobile): mandatory update gate from config/app`.

### Task 18: EAS e build de desenvolvimento (pontos de paragem)

**Files:**
- Create: `mobile/eas.json`, `mobile/README.md` (como correr: emulator, seed, dev client, variáveis `EXPO_PUBLIC_*`)
- Modify: `mobile/app.json` (`extra.eas.projectId` e `owner` gerados pelo `eas init`)

**Interfaces:**
- Produces: perfis EAS `development` (`developmentClient: true`, `distribution: internal`, `env.EXPO_PUBLIC_USE_EMULATOR: "0"`), `development-emulator` (igual com `"1"`), `preview` (internal) e `production` (`autoIncrement: true`); `cli.appVersionSource: "remote"`; `node` com a versão mínima exigida pelo SDK (22.13+ no SDK 58). Sem `submit` (Plano 5).

- [ ] **Step 1:** Correr toda a verificação local: `cd mobile && npm test && npm run typecheck && npm run check:tokens && npx expo-doctor` e `cd ../functions && npm test && npm run test:emulator && npm run lint`. Esperado: tudo passa.
- [ ] **Step 2:** Escrever `eas.json` e o README.
- [ ] **Step 3 (PARAGEM, Martim):** `npx eas-cli login` com a conta Expo do Martim e `npx eas-cli init` em `mobile/` (projeto novo). Commit das alterações de `app.json`.
- [ ] **Step 4 (PARAGEM, Martim):** credenciais. iOS: `eas credentials -p ios` na conta Apple Developer do Martim (App ID `com.scp360` com a capability "Sign In with Apple"; certificados novos). Firebase Console → Authentication: ativar o provider Apple; em Definições, confirmar "Associar contas que usam o mesmo email" (uma conta por email). Android: `eas credentials -p android` gera a keystore de desenvolvimento; acrescentar o SHA-1 e o SHA-256 dessa keystore na app Android `com.scp360` do Firebase (necessário para o login Google no build de desenvolvimento) e voltar a descarregar `google-services.json` se o Firebase o pedir.
- [ ] **Step 5 (PARAGEM, Martim):** `eas build --profile development --platform all` e instalar nos telemóveis do Martim.
- [ ] **Step 6 (PARAGEM, Martim): smoke em dispositivo**, iOS e Android, contra o Firebase de produção só para autenticação:
  - abre com o splash e as fontes certas (DIN condensada nos títulos);
  - Welcome, Entrar com a conta real do Martim, sair, Entrar com Google, Entrar com Apple (iOS);
  - recuperar password com o email do Martim (chega o email);
  - ativar a biometria, mandar a app para segundo plano mais de 5 minutos, voltar: pede Face ID ou impressão digital;
  - galeria (`/dev/galeria`) revista pelo Martim contra o Figma, componente a componente;
  - com o perfil `development-emulator` e o emulator mais `seed-emulator.mjs` na rede local: mudar o nome público, apagar uma conta de teste e ver o ecrã de atualização com `minVersion` `9.0.0`.
  Anotar o resultado no fim deste plano. Se algo falhar, corrigir antes da Task 19.

### Task 19: Retirar a app antiga da raiz

**Files:**
- Delete (raiz): `App.tsx`, `index.ts`, `src/`, `android/`, `assets/`, `app.json`, `eas.json`, `babel.config.js`, `metro.config.js`, `global.css`, `gesture-handler.js`, `gesture-handler.native.js`, `nativewind-env.d.ts`, `tailwind.config.js`, `tsconfig.json`, `package.json`, `package-lock.json`, `google-services.json`, `GoogleService-Info.plist`
- Keep: `functions/`, `legacy/`, `docs/`, `mobile/`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `.gitignore`

- [ ] **Step 1:** Confirmar que `archive/v1-app` existe no remoto: `git ls-remote --heads origin archive/v1-app`. Esperado: uma linha. Se não existir, parar e avisar o Martim.
- [ ] **Step 2:** Confirmar que nada em `mobile/` importa da raiz: `grep -rn "\.\./src/\|\.\./\.\./src/" mobile/app mobile/src` sem resultados.
- [ ] **Step 3:** `git rm -r` da lista acima.
- [ ] **Step 4:** Verificar: `git diff --stat HEAD -- functions legacy` vazio (nada mudou nesta task); `cd functions && npm test`; `cd mobile && npm test && npm run typecheck`. Esperado: tudo passa.
- [ ] **Step 5:** Commit `chore: remove v1 app from repo root (kept in archive/v1-app)`.

---

## Notas para os planos seguintes

- **Plano 2:** publicar `updateProfile`, `deleteAccount` e `linkProviderByEmail` junto com o motor do Plano 1, com deploy por nome (`functions:v2027:updateProfile,...`). Criar `config/app` com `minVersion` (`ios`, `android`) e manter os nomes do contrato da Task 17. O modelo `games` mapeia para `GameHeaderVM`/`EventVM` no Plano 4, não nos componentes.
- **Plano 4:** os ecrãs usam só os componentes deste plano e os hooks da Task 4; as Definições ligam a `ligar-apple`, `perfil/nome`, `apagar-conta` e à opção de biometria.
- **Plano 5:** a V2 não tem nenhum mecanismo de atualização obrigatória (só a constante `appversion = 5.4`), por isso a "app antiga bloqueada" do spec 8.6 não se consegue por `config/app`; ver Pergunta 3. Antes do primeiro build de produção, `eas build:version:set` para o `versionCode` Android ficar acima do da V2 no Play. Registar App Attest e Play Integrity no App Check antes de o tornar obrigatório. Regras finais: `users` deixa de ser público e os campos públicos ficam só em `publicProfiles`.
- O caminho dos tokens passa a `mobile/src/theme/tokens.ts`; o spec ainda refere `src/theme/tokens.ts`.

## Perguntas para o Martim

1. **Cartão de notícia e linha de ranking não têm frame no Figma** (só existe a linha da classificação `500:29416`). Desenhas os dois no Figma antes da Task 7, ou aceitas que sejam compostos com os tokens e validados por ti na galeria?
2. **Conta Apple Developer:** a V2 submete com a equipa `5U6HWPNTZ3` (`app.scp360@gmail.com`). É a tua conta? A Task 18 precisa dela para os certificados novos e para o "Sign In with Apple".
3. **Bloquear a app antiga:** a V2 não lê nenhuma versão mínima, por isso não há forma de lhe mostrar um ecrã de atualização. Aceitas que, no corte do Plano 5, a V2 deixe só de funcionar (regras fechadas) e que a passagem dependa da atualização nas lojas?

## Respostas do Martim (17/11/2026)
1. Cartão de notícia e linha do ranking: construir com os tokens no estilo do Figma e aprovar na galeria.
2. A equipa Apple 5U6HWPNTZ3 (app.scp360@gmail.com) é do Martim e ele tem acesso.
3. Aceita que, no corte, a app antiga deixe de carregar dados e os utilizadores atualizem pela loja.
