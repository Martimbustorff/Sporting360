# S360 (mobile)

App Expo (SDK 58, React Native 0.88, Expo Router) para iOS e Android. Backend em Firebase (`../functions`). Requer Node 22.13+.

## Verificação local

```
cd mobile
npm test && npm run typecheck && npm run check:tokens && npx expo-doctor
cd ../functions
npm test && npm run test:emulator && npm run lint
```

## Como correr

A app usa módulos nativos (Firebase, Google Sign-In, Apple, MMKV...), por isso **não corre no Expo Go**. É preciso um dev client.

1. Dev client: `eas build --profile development --platform all` (ou `development-emulator`, ver abaixo) e instalar no telemóvel/simulador.
2. Emulators (na raiz do repo): `firebase emulators:start --only auth,firestore,functions` (portas 9099, 8080, 5001).
3. Seed (outro terminal, emulators a correr): `cd mobile && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:emulator`. Cria `config/app`, um utilizador de teste e as fixtures. Recusa correr sem `FIRESTORE_EMULATOR_HOST`.
4. Metro: `cd mobile && npm start` (`expo start --dev-client`).

### Variáveis `EXPO_PUBLIC_*`

| Variável | Efeito |
| --- | --- |
| `EXPO_PUBLIC_USE_EMULATOR` | `1` liga Auth, Firestore e Functions aos emulators. Só tem efeito com `__DEV__`; num build de release é ignorada. Os perfis EAS `development` (`0`) e `development-emulator` (`1`) já a definem. |
| `EXPO_PUBLIC_EMULATOR_HOST` | Host dos emulators. Por omissão `127.0.0.1` (iOS) e `10.0.2.2` (Android emulator). Ver abaixo para telemóveis físicos. |

Exemplo: `EXPO_PUBLIC_USE_EMULATOR=1 EXPO_PUBLIC_EMULATOR_HOST=192.168.1.20 npm start`.

### Telemóvel físico contra os emulators (R13)

- **Android físico (USB):** `adb reverse tcp:9099 tcp:9099 && adb reverse tcp:8080 tcp:8080 && adb reverse tcp:5001 tcp:5001` e `EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1`.
- **iPhone / rede local (LAN):** os emulators têm de escutar fora de localhost. Criar um `firebase.lan.json` **não versionado** (cópia do `firebase.json` com `"host": "0.0.0.0"` em cada emulator), arrancar com `firebase emulators:start --config firebase.lan.json --only auth,firestore,functions` e usar `EXPO_PUBLIC_EMULATOR_HOST=<IP do computador>`. Não editar o `firebase.json`. O seed com `FIRESTORE_EMULATOR_HOST` só aceita `localhost`, `127.0.0.1` e `10.0.2.2`: correr o seed no próprio computador.

## Perfis EAS (`eas.json`)

- `development`: dev client, distribuição interna, `EXPO_PUBLIC_USE_EMULATOR=0` (Firebase de produção).
- `development-emulator`: igual, com `EXPO_PUBLIC_USE_EMULATOR=1`.
- `preview`: distribuição interna.
- `production`: `autoIncrement`.

`cli.appVersionSource` é `remote`. Node 22.13.0 (mínimo do SDK 58). Sem `submit` (Plano 5).

## Paragens do Martim

Passos que precisam das contas do Martim. Nada disto foi corrido pelo agente.

- [ ] **Expo:** `npx eas-cli login` e `npx eas-cli init` em `mobile/` (projeto novo). Commit do `extra.eas.projectId` e `owner` em `app.json`.
- [ ] **iOS credenciais:** `eas credentials -p ios`. App ID `com.scp360` com a capability "Sign In with Apple"; certificados novos.
- [ ] **Firebase Console, Authentication:** ativar o provider Apple; em Definições confirmar "Associar contas que usam o mesmo email" (uma conta por email).
- [ ] **Provider Apple, fluxo de código OAuth:** configurar Services ID, Team ID `5U6HWPNTZ3`, Key ID e a chave `.p8`. É necessário para o `revokeToken` ao apagar a conta.
- [ ] **Android credenciais:** `eas credentials -p android` (keystore de desenvolvimento). Acrescentar SHA-1 e SHA-256 na app Android `com.scp360` do Firebase (login Google no build de desenvolvimento) e voltar a descarregar `google-services.json` se o Firebase pedir.
- [ ] **Build:** `eas build --profile development --platform all` e instalar nos telemóveis. É preciso um dev client novo por causa dos módulos nativos: google-signin (com config plugin), keyboard-controller, expo-apple-authentication, expo-crypto, expo-local-authentication, expo-secure-store, expo-application e mmkv.
- [ ] **Smoke em dispositivo (iOS e Android, Firebase de produção só para autenticação):**
  - [ ] abre com o splash e as fontes certas (DIN condensada nos títulos);
  - [ ] Welcome, Entrar com a conta real, sair, Entrar com Google, Entrar com Apple (iOS);
  - [ ] recuperar password com o email do Martim (o email chega);
  - [ ] ativar a biometria, app em segundo plano mais de 5 minutos, ao voltar pede Face ID ou impressão digital;
  - [ ] galeria (`/dev/galeria`) revista contra o Figma, componente a componente;
  - [ ] com `development-emulator` + emulators + seed na rede local: mudar o nome público, apagar uma conta de teste e ver o ecrã de atualização com `minVersion` `9.0.0`.
- [ ] **Apple, apagar conta a sério:** uma eliminação real numa conta Apple e confirmar que o token desaparece em Apple ID, "Iniciar sessão com a Apple".
- [ ] **Verificações visuais e de runtime:**
  - [ ] o texto do botão Apple aparece em português;
  - [ ] MMKV 3 no RN 0.88 com nova arquitetura (limpeza de dados legacy) não crasha;
  - [ ] os anéis do welcome e do lock-screen renderizam (os do lock estão sem máscara face ao Figma);
  - [ ] o teclado não tapa botões no Android.
- [ ] **Decisões pendentes do Martim:**
  - [ ] Poppins Light não está incluída no bundle;
  - [ ] texto dos Termos para revisão;
  - [ ] copy do Google `needsExistingLogin`;
  - [ ] privacidade: nomes longos passam a mostrar primeira e última palavra (antes "Sportinguista #xxxx"). Decidir antes do deploy das functions.

Anotar o resultado do smoke no fim do Plano 3. Se algo falhar, corrigir antes da Task 19.

### Push (Plano 6)

O envio fica desligado (`PUSH_ENABLED=false` nos dois `.env` das functions) até ao lançamento da V7.1. Nada disto foi corrido pelo agente.

- [ ] **Chave APNs:** criar a chave `.p8` na Apple Developer (Keys, "Apple Push Notifications service") e carregá-la no Firebase Console, projeto `scp360-37a74`, Definições do projeto, Cloud Messaging, app iOS `com.scp360`. Sem ela o iOS não recebe nada; o Android funciona sem ela.
- [ ] **Build:** o módulo `@react-native-firebase/messaging` e o entitlement `aps-environment` pedem um build nativo novo. É o mesmo build do redesign V7.1 e só corre com o OK explícito do Martim (não há build só para o push).
- [ ] **Smoke em dispositivo (iOS e Android):**
  - [ ] a permissão só é pedida depois do login (e depois da folha de Analytics), nunca no primeiro arranque nem no Welcome;
  - [ ] os 5 tipos chegam: início do jogo, golo do Sporting, abertura do MVP, lembrete de prognóstico (2 h antes, só sem prognóstico feito) e notícia;
  - [ ] tocar em cada um abre o ecrã certo (jogo, tab MVP, tab Prognóstico, notícia), com a app fechada e em segundo plano;
  - [ ] desligar um interruptor no ecrã Notificações deixa de receber esse tipo;
  - [ ] com a app aberta: no iOS aparece a notificação do sistema; no Android aparece o aviso dentro da app (uma só vez) e tocar abre o ecrã certo;
  - [ ] recusar a permissão, ligá-la nas definições e voltar à app: o lembrete de prognóstico passa a chegar sem fechar a app;
  - [ ] com a permissão recusada nas definições do telemóvel, o ecrã Notificações mostra o aviso e o botão "Abrir definições";
  - [ ] sair da conta deixa de receber; entrar com outra conta no mesmo telemóvel segue as preferências da conta nova.
- [ ] **Publicação, só com OK do Martim, por esta ordem:**
  1. regras: o `firestore.rules` da fase em vigor (ou o `firestore.final.rules` depois do lançamento), com a regra nova de `users/{uid}/devices`;
  2. functions: `functions:v2027:footballLiveTicker,functions:v2027:newsSync,functions:v2027:predictionReminderPush,functions:v2027:deleteAccount` (ainda com `PUSH_ENABLED=false`);
  3. só depois: `PUSH_ENABLED=true` no `.env` de produção e nova publicação das três de envio (`footballLiveTicker`, `newsSync`, `predictionReminderPush`).
- [ ] **Ícone pequeno no Android:** gerado de `assets/images/android-icon-monochrome.png` com a cor `#00835B` (`plugins/withNotificationIcon.js`). Confirmar no smoke que aparece na barra de estado (e não um quadrado branco).
