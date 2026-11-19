# Notificações push (V7.1): design curto

Data: 19/11/2026. Aprovado pelo Martim: 19/11/2026 00:35.

## Intenção
O ecrã Notificações já existe e guarda `users/{uid}.notificationPrefs` (matchStart, goals, predictionReminder, mvpOpen, news), mas nada é enviado. O Martim quer manter o ecrã e pô-lo a funcionar nesta versão (o lançamento foi adiado para o redesign V7.1).

## Objetivos
- Push real em iOS e Android para as 5 preferências.
- Tocar na notificação abre o ecrã certo (jogo, tab MVP, prognóstico, notícia).
- Permissão pedida depois do login, nunca no primeiro arranque.

## Não-objetivos
- Notificações para outras modalidades além do futebol do Sporting (fica para depois).
- Centro de notificações dentro da app.

## Anti-objetivos
- Spam: notícias no máximo 2 por dia; nunca push de golo do adversário.
- Enviar a quem desligou o interruptor.
- Guardar dados pessoais nos payloads (sem email, sem nome).

## Abordagens
| Abordagem | Trade-off | Decisão |
|---|---|---|
| A. Tópicos FCM por preferência (`push_matchStart`, `push_goals`, `push_mvpOpen`, `push_news`) | Grátis, escala para 5.200+ contas, o servidor envia uma mensagem por evento; a app sincroniza a inscrição com as preferências | **Escolhida** |
| B. Tokens por dispositivo no Firestore e fan-out filtrado no servidor | Permite mensagens individuais, mas custa leituras e escritas por evento | Só para o lembrete de prognóstico (individual: só quem ainda não prognosticou) |
| C. Serviço de push da Expo | Mais uma dependência e conta; o projeto já usa RNFirebase | Rejeitada |

## Desenho
- App: `@react-native-firebase/messaging`. Depois do login, pedir permissão (iOS) e guardar o token em `users/{uid}/devices/{token}` (para o lembrete). Cada mudança de preferência faz `subscribeToTopic`/`unsubscribeFromTopic`; no arranque, sincroniza os tópicos com as preferências guardadas. Sem preferências: tudo ligado (valor por omissão atual).
- Servidor (codebase v2027, europe-west1):
  - início do jogo: quando um `matches` do Sporting passa a LIVE; envia uma vez (marca `push.matchStartSentAt`).
  - golo: quando o resultado do Sporting sobe; uma mensagem por golo (idempotente por `matchId_minuto_marcador`).
  - MVP aberto: quando a janela do MVP abre; uma vez por jogo.
  - lembrete de prognóstico: agendado, 2 h antes do kickoff, só para dispositivos de utilizadores com `predictionReminder` ligado e sem `matchPredictions/{gameId}_{uid}`.
  - notícias: no máximo 2 por dia, das fontes principais.
- Payload: título e corpo em PT-PT, `data.route` (ex.: `/jogo/9002?tab=mvp`). Nunca email, nome ou uid no payload.
- Regras: `users/{uid}/devices/*` só o dono escreve e lê; tópicos não são dados do Firestore.

## Dependências do Martim (uma vez)
- Chave APNs (.p8) criada na Apple Developer e carregada no Firebase Cloud Messaging.

## Deixado ao implementador
- Textos exatos das mensagens (PT-PT, curtos, sem travessões).
- Throttling interno e testes no emulador com o Admin SDK mockado.

## Alteração 2026-11-19
Decisão do Martim: as push passam a existir só para ações na app.
- Ficam: lembrete de prognóstico (por dispositivo) e abertura do MVP (tópico `push_mvpOpen`).
- Saem: início do jogo (`push_matchStart`), golos (`push_goals`) e notícias (`push_news`). Servidor: `matchPush` só envia o MVP, `newsPush` foi apagado e a `newsSync` já não envia push.
- App: o ecrã Notificações mostra só dois interruptores; o plano de tópicos subscreve `push_mvpOpen` se `mvpOpen` estiver ligado e tira sempre os três tópicos antigos (limpa telemóveis de builds de teste); `routeFromData` aceita só `/jogo/<id>?tab=mvp` e `/jogo/<id>?tab=prognostico`.
- Dados: `notificationPrefs` mantém as cinco chaves, o schema e as regras do Firestore ficam como estão; as chaves antigas deixam de aparecer e de ter efeito.

