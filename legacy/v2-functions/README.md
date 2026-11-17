# Cloud Functions V2 (arquivo de referência, só leitura)

**Não publicar a partir desta pasta.** Esta cópia serve apenas de referência para o Plano 2 (endpoints da API-Football usados, mapeamento para as coleções atuais, formato das coleções `players` e `games`). A pasta de código ativo é `functions/`.

## Origem

- Bucket GCS: `gcf-v2-sources-394641993263-us-central1`
- Objeto: `predictionsSettlementScheduler/function-source.zip`
- Data do código no bucket: 27/08/2026
- Data da cópia para este repositório: 17/11/2026
- Conteúdo copiado: `src/` e `package.json`, com os ficheiros omitidos indicados abaixo. Não foram copiados `lib/`, `node_modules/`, `package-lock.json`, `tsconfig.json` nem `.gitignore`.
- Cópia integral (com os ficheiros omitidos): `predictionsSettlementScheduler_function-source.zip`, no PC do Martim, em `Desktop\Personal\S360`.

## Segredos e ficheiros omitidos

Os ficheiros que continham a chave RapidAPI, o bearer token do Twitter/X, a apiKey web do Firebase ou literais por classificar **não foram copiados** para este repositório. Estas credenciais estavam no código original e **é recomendado rodá-las (rotation)**, porque estiveram expostas: a chave RapidAPI no painel da RapidAPI, e o bearer token do Twitter/X no portal de programadores do Twitter/X. Decisão do dono: o repositório privado mantém-se e as chaves não são rodadas por agora; nunca entram no código novo, e a chave RapidAPI passa para o Secret Manager no Plano 2.

Ficheiros omitidos de `src/`:

| Ficheiro omitido | Motivo |
|---|---|
| `src/index.ts` | Contém a chave RapidAPI |
| `src/database/firebase.ts` | Contém a apiKey web do Firebase (não secreta) e um literal longo por classificar |
| `src/services/todayGame.ts` | Contém a chave RapidAPI |
| `src/services/backfill.ts` | Contém a chave RapidAPI |
| `src/midleware/config.ts` | Contém a chave RapidAPI |
| `src/midleware/videos.ts` | Contém a chave VSports como valor por omissão de `VSPORTS_KEY` |
| `src/midleware/tweets.ts` | Contém um bearer token do Twitter/X como valor de fallback de `process.env.TWITTER_BEARER_TOKEN` |

Esta pasta não compila de forma isolada: os ficheiros omitidos continuam referidos por imports (por exemplo, `src/services/tweets.ts` importa `midleware/tweets.ts`, e os serviços importam a configuração). Serve apenas para leitura.

Como `src/index.ts` foi omitido, a lista de funções e crons abaixo foi retirada da leitura desse ficheiro antes da omissão. Para o código completo, usar o zip indicado acima.

## Funções

Os horários dos agendamentos estão em UTC (nenhum `onSchedule` define `timeZone`).

Funções HTTP:

| Função | Tipo | Descrição |
|---|---|---|
| `games` | HTTP (`onRequest`) | Atualiza os jogos (`GamesScript`) |
| `backfill` | HTTP (`onRequest`), timeout 3600 s | Carga histórica única por época (`?part=`, `?seasons=`) |

Funções agendadas:

| Função | Cron (UTC) | Descrição |
|---|---|---|
| `liveMatchUpdater` | `*/1 * * * *` (cada minuto) | Atualiza `isActive` e os dados ao vivo dos jogos em curso |
| `videosSheduler` | `*/5 * * * *` | Vídeos (`VideosScript`) |
| `predictionsSettlementScheduler` | `*/5 * * * *` | Liquidação de palpites (ver secção abaixo) |
| `newsSheduler` | `*/15 * * * *` | Notícias por RSS (`NewsScript`) |
| `gamesSheduler` | `0 */2 * * *` | Jogos da época atual (`GamesScript`) |
| `statisticsSheduler` | `0 */2 * * *` | Estatísticas (`StatisticsScript`) |
| `standingsSheduler` | `0 */2 * * *` | Classificações (`StandingsScript`) |
| `twitterScheduler` | `0 */10 * * *` (de 10 em 10 horas) | Tweets (`TweetsScript`) |
| `summarySheduler` | `0 9 * * *` (diária) | Resumos (`SummaryScript`) |
| `PlayersSheduler` | `0 9 * * *` (diária) | Jogadores (`PlayersScript`) |
| `lineupsheduler` | `0 9 * * *` (diária) | Convocatórias (`LineupsScript`) |

Total: 11 funções agendadas e 2 HTTP (13). A `twitterScheduler` corre de 10 em 10 horas, e não diariamente.

## Liquidação de palpites (`predictionsSettlementScheduler`)

A função `predictionsSettlementScheduler` já atribui o bónus de +3 pontos por resultado exato (`exact_score`) quando um jogo termina. Lê os palpites com `scored == false` e, para cada um, atualiza `rankings` (campo `points`, com incremento de 3) e cria um documento em `point_events` com id `exact_score_<jogo>_<utilizador>`. Ver `src/services/predictionSettlement.ts`. Este comportamento é relevante para a v2027, porque a lógica de pontos da nova versão não deve duplicar este bónus.

## Diferenças conhecidas face ao código publicado

- A pasta `lib/` do zip original continha um `cleanup.js` compilado sem ficheiro correspondente em `src/`. O código publicado pode, por isso, ser diferente do código aqui copiado. Não foi copiado nenhum ficheiro de `lib/`.
