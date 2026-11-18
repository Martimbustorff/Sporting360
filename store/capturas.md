# Capturas de ecrã das lojas

Especificação das 8 capturas (a mesma ordem nas duas lojas) e dos tamanhos. Os dados vêm de `mobile/src/data/fixtures.ts`, carregados no emulador com o seed. Nomes fictícios, sem utilizadores nem emails reais.

## Preparação

1. Emuladores: na raiz do repo, `firebase emulators:start --only auth,firestore,functions`.
2. Seed, logo antes de capturar (os jogos são relativos à hora do seed): `cd mobile && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed:emulator`.
3. Dev client com `EXPO_PUBLIC_USE_EMULATOR=1` (perfil EAS `development-emulator`).
4. Entrar com `teste@s360.local` / `teste1234` (utilizador de teste do emulador, "Teste Leão"). Na folha de consentimento de análise, escolher "Agora não".
5. Barra de estado limpa: iOS simulador com `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`; Android com o modo de demonstração (`adb shell settings put global sysui_demo_allowed 1`).
6. Abrir cada rota com `xcrun simctl openurl booted "s360:///<rota>"` (iOS) ou `adb shell am start -a android.intent.action.VIEW -d "s360:///<rota>"` (Android), ou navegar à mão.

## Dispositivos

| Loja | Dispositivo | Resolução nativa |
|---|---|---|
| App Store, 6,9" (obrigatório) | Simulador iPhone 16 Pro Max (ou 17 Pro Max) | 1320x2868 |
| App Store, 6,5" (opcional) | Simulador iPhone 11 Pro Max, ou o 6,9" reduzido com `resize.mjs` | 1284x2778 |
| Google Play, telemóvel (mínimo 2, até 8) | Emulador Android com ecrã 1080x1920 (a Play não aceita proporção acima de 2:1, por isso não usar 1080x2400) | 1080x1920 |

## Tamanhos de saída

| Destino | Tamanho (px) | Notas |
|---|---|---|
| iPhone 6,9" | 1320x2868 | obrigatório, 3 a 10 capturas |
| iPhone 6,5" | 1284x2778 | opcional |
| Play, telemóvel | 1080x1920 | mínimo 2, até 8 |
| Play, gráfico de destaque | 1024x500 | `store/feature-graphic-1024x500.png`, já gerado; sem emblema do Clube |

Gerar os tamanhos a partir de uma captura (mantém a proporção, as margens levam a cor `bg` do tema; `--fit cover` corta em vez de deixar margens):

```
NODE_PATH=<pasta com sharp>/node_modules node store/scripts/resize.mjs capturas/01-home.png store/capturas-out
```

Regenerar o gráfico de destaque: `NODE_PATH=<pasta com sharp>/node_modules node store/scripts/feature-graphic.mjs`.

## As 8 capturas

Utilizador de teste: `seed-user-1`. Jogos do seed: 9002 ao vivo (Sporting CP 2-1 SC Braga, 82'), 9001 próximo (Sporting CP vs Benfica, J12), 9000 terminado (FC Porto 1-2 Sporting CP, J11, prognóstico 1-2, voto no MVP 1002, liquidado).

| # | Ecrã | Rota | Estado dos dados | Tamanhos |
|---|---|---|---|---|
| 1 | Home | `/` | Cartão do jogo ao vivo (9002) e menu completo (Notícias, Agenda, Ranking, Mapa do estádio, Sites do clube); folha GameBox fechada | 1320x2868, 1284x2778, 1080x1920 |
| 2 | Agenda | `/agenda` | Filtro Futebol, separador Próximos; jogos 9002, 9001, 9004 e outros do seed, com competição e jornada visíveis | os três |
| 3 | Detalhe ao vivo | `/jogo/9002` | Separador Sumário: 2-1 aos 82', golos de Jogador Um e Jogador Dois, faixa "Live" | os três |
| 4 | Prognóstico com cartão | `/jogo/9000?tab=prognostico` | Prognóstico 1-2 guardado, com a folha "Partilhar prognóstico" aberta a mostrar o cartão "S360 MATCHDAY" | os três |
| 5 | MVP com percentagens | `/jogo/9000?tab=mvp` | Votação fechada, voto em Jogador Dois, liquidada; percentagens do `mvpTallies/9000` (Jogador Dois 55 %, Jogador Um 35 %, os outros dois candidatos abaixo de 10 %, 40 votos) | os três |
| 6 | Ranking | `/ranking` | Separador Semana, 10 entradas fictícias (Marta F., Ana Silva, Diogo L., Rui Costa, Sofia R., Teste Leão destacado, entre outros) | os três |
| 7 | Notícias | `/noticias` | Filtro Todas, três notícias do seed (futebol, basquetebol, futsal) | os três |
| 8 | Perfil | `/perfil` | Separador Semana, "Meu jogo" com 1 jogo liquidado, 100 % de acerto, 1 exato, 1 MVP certo, histórico com +6 | os três |

O gráfico de destaque (1024x500) é só da Play e já está feito.

## Regras

- Sem emblema nem logótipo do Sporting no gráfico de destaque: a app é não oficial. O gráfico usa só o nome S360 e as cores do tema.
- Só aparece o que está ligado no lançamento. O que está escondido (flags de `config/app.features` a `false`) não aparece em nenhuma captura nem em nenhum texto das lojas, e o seed já tem essas flags desligadas, por isso o menu da Home só tem Notícias, Agenda, Ranking, Mapa do estádio e Sites do clube.
- Sem notificações push nas capturas e sem o ecrã de preferências de notificação.
- Só nomes fictícios no ranking e no perfil. Verificar cada captura antes de a carregar: nenhum email, nenhum nome real.
- Os emblemas das equipas nos cabeçalhos dos jogos vêm do fornecedor de dados (imagens remotas). O seed aponta-os para o fornecedor; se o emblema do Sporting aparecer nas capturas 2 a 5, decidir antes de submeter se se aceita (ver o relatório da Task 11) ou se se capturam as imagens sem rede, como o resto dos jogos de futsal do seed, que não têm emblema.
