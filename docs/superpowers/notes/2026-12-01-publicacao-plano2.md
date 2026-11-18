# Plano 2: guia de publicação (Task 21)

Guia passo a passo para publicar o Plano 2 no projeto `scp360-37a74`. Os passos marcados **PARAGEM (Martim)** só correm com o OK explícito do Martim na conversa, e quem escreve chaves ou corre comandos contra produção é sempre o Martim, no terminal dele. A app V2 tem de continuar a funcionar em todos os passos até ao corte do Plano 5.

Os argumentos `--only functions:v2027:...` abaixo foram gerados por `deployArg` (`functions/scripts/deployLists.ts`). Para os voltar a gerar: `cd functions && npx tsx scripts/deployLists.ts`.

## 0. Convenções

- Comandos `firebase ...`: na raiz do repositório (onde está o `firebase.json`), com o CLI global ou `npx --prefix functions firebase ...`. Sessão iniciada com `firebase login` na conta dona do projeto.
- Comandos `npx tsx scripts/...`: dentro de `functions/`. Os scripts usam as credenciais ADC: `gcloud auth application-default login` uma vez.
- Nunca `firebase deploy` sem `--only`, nunca `--only functions` sem nomes, nunca `--force`.
- `firebase functions:delete` só com nomes de functions, **nunca** com um nome de codebase (`v2027`, `default`): apagaria o codebase inteiro.
- Se durante um deploy aparecer `Enter a string value for ...` (parâmetro em falta no `functions/.env.scp360-37a74`): **Ctrl-C e parar**. O CLI gravaria a resposta no ficheiro, e um `LEGACY_COLLECTION_PREFIX` em falta vale `""`, ou seja, escrever nas coleções reais. O ficheiro tem de ter `LEGACY_COLLECTION_PREFIX`, `VSPORTS_SEASON_ID` (vazio = calculado) e `NEWS_LEGACY_CONTENT` (`true` até ao passo L6), os `defineString` e o `defineBoolean` de `src/config/secrets.ts`.
- Functions antigas: codebase por omissão, região `us-central1` (o `index.ts` antigo não define região nem `setGlobalOptions`, e o código está no bucket `gcf-v2-sources-394641993263-us-central1`). Functions novas: codebase `v2027`, região `europe-west1`. Um deploy do codebase `v2027` nunca mexe nas antigas.
- Chaves só no terminal do Martim, nunca no repositório, em ficheiros, em logs ou na conversa. Para pôr uma chave no ambiente sem ficar no histórico:
  - bash: `read -rs RAPIDAPI_KEY && export RAPIDAPI_KEY` (o mesmo para `VSPORTS_KEY`)
  - PowerShell: `$env:RAPIDAPI_KEY = Read-Host -MaskInput "RAPIDAPI_KEY"`
- Antes de cada PARAGEM que mexe em produção: `cd functions && npm run lint && npm test && npm run test:emulator` tudo verde.

### Listas (de `deployLists.ts`)

| Lista | Nomes |
|---|---|
| `DEPLOY_DATA_FUNCTIONS` (12) | footballFixturesSync, footballPostMatchSync, footballLiveTicker, footballStandingsSync, footballSeasonSync, footballWeeklySync, footballPrematchSync, videosSync, newsSync, tweetsSync, apiSportsSync, freeSourcesSync |
| `DEPLOY_CUTOVER_FUNCTIONS` (1) | legacyPredictionSettlement |
| `DEPLOY_ENGINE_FUNCTIONS` (6) | submitPrediction, voteMvp, settleScheduler, updateProfile, deleteAccount, linkProviderByEmail (as três últimas vêm do Plano 3, branch `v2027-app`) |
| `LEGACY_FUNCTIONS` (13, `us-central1`) | gamesSheduler, liveMatchUpdater, summarySheduler, statisticsSheduler, newsSheduler, twitterScheduler, videosSheduler, PlayersSheduler, lineupsheduler, standingsSheduler, predictionsSettlementScheduler, games, backfill |

## 1. Verificações iniciais (PARAGEM (Martim): credenciais do Martim, só leitura)

```bash
cd functions
npm run lint && npm test && npm run test:emulator
npx tsx scripts/check-predeploy.ts --project scp360-37a74
```

Esperado: saída 0 e as linhas:
- `rankings: N documentos, 0 fora do formato` (todos com `season` `aaaa-aaaa` e id `userId_season`, senão as regras novas negam os +1 da V2 nesses documentos);
- `predictions: ... 0 com source` e `manofmatch: ... 0 com source`;
- `functions antigas (us-central1): 13/13` e nenhuma `functions desconhecidas` (um `cleanup` antigo, por exemplo, faz falhar: apagar por nome depois do OK do Martim, ou explicar);
- `rankings com email em userName (informativo)`: N (herança da V2, limpa no Plano 5);
- `motor v2027 (informativo)`: contagens de `matchPredictions`, `mvpVotes`, `pointEvents`, `leaderboards`, `settlements` (o corte do Plano 5 apaga o que lá estiver).

No painel da RapidAPI: confirmar API-Football **Pro** (7.500/dia) e as subscrições de andebol, voleibol e basquetebol (mesma conta, plano gratuito, 100/dia cada).

## 2. Segredos (PARAGEM (Martim): valores escritos pelo Martim no terminal dele)

Valores atuais, sem rotação. O CLI pede o valor sem o mostrar.

```bash
firebase functions:secrets:set RAPIDAPI_KEY --project scp360-37a74
firebase functions:secrets:set VSPORTS_KEY --project scp360-37a74
firebase functions:secrets:set TWITTER_BEARER_TOKEN --project scp360-37a74
firebase functions:secrets:get RAPIDAPI_KEY --project scp360-37a74   # mostra as versões, nunca o valor
```

O deploy dá acesso aos segredos à conta de serviço das functions. Nada vai para o repositório. Se um segredo já estiver em uso, o `secrets:set` oferece republicar as functions que o usam: responder **não** e republicar por nome, no passo certo deste guia.

**Pergunta para o Martim:** rodar no corte as chaves que estavam escritas no código antigo (chave RapidAPI, chave VSports por omissão, bearer token do X)? Da última vez a resposta foi não (repositório privado, chaves só no Secret Manager no código novo, monitorizar o consumo da RapidAPI). Se a resposta mudar: gerar as novas no painel de cada serviço, repetir os três `secrets:set` acima com os valores novos e voltar a publicar as functions que os usam (um segredo novo só é lido num deploy novo); as antigas deixam de funcionar no momento da rotação, por isso só depois do corte (secção 9).

## 3. Gravar fixtures reais (PARAGEM (Martim): chave no ambiente do Martim)

```bash
cd functions
read -rs RAPIDAPI_KEY && export RAPIDAPI_KEY
read -rs VSPORTS_KEY && export VSPORTS_KEY
npx tsx scripts/record-fixtures.ts --help
npx tsx scripts/record-fixtures.ts --fixture <id de um jogo recente terminado> --player <id> --coach <id>
```

Cada pedido gasta 1 chamada da quota. O script grava diretamente em `test/fixtures/api-football/real/` (e `vsports/real/`); ajustar os testes para usar essas respostas onde a forma real difere das sintéticas, correr `npm test && npm run test:emulator`, corrigir os mapeamentos onde a forma real diferir e fazer commit `test: real recorded api fixtures` (o controlador revê antes de seguir).

IDs das API-Sports (para preencher `src/modalities/sourcesConfig.ts`, que hoje tem tudo `enabled: false`):

```bash
for h in api-handball api-volleyball api-basketball; do
  printf 'x-rapidapi-key: %s\n' "$RAPIDAPI_KEY" | curl -s -H @- -H "x-rapidapi-host: $h.p.rapidapi.com" "https://$h.p.rapidapi.com/teams?search=Sporting" > /tmp/$h-teams.json
  printf 'x-rapidapi-key: %s\n' "$RAPIDAPI_KEY" | curl -s -H @- -H "x-rapidapi-host: $h.p.rapidapi.com" "https://$h.p.rapidapi.com/leagues?country=Portugal" > /tmp/$h-leagues.json
done
unset RAPIDAPI_KEY VSPORTS_KEY
```

(6 pedidos, 2 por modalidade.) O cabeçalho com a chave entra pelo stdin (`-H @-`, `printf` é interno da shell), para a chave não aparecer na lista de processos; nunca a escrever na própria linha do `curl`. No fim, `unset` tira as chaves do ambiente. Depois: `teamId`, ids e `covered` das ligas, `enabled: true`, testes, commit.

### Lista de confirmação na gravação (itens "ver na Task 21" do ledger)

- [ ] **API-Sports:** hosts `api-handball.p.rapidapi.com`, `api-volleyball.p.rapidapi.com`, `api-basketball.p.rapidapi.com` respondem com `x-rapidapi-key`; ids do Sporting e das ligas confirmados; formato de época (`year` no andebol e voleibol, `span` no basquetebol).
- [ ] **Classificação da Liga (94):** número real de linhas (18). O teste da Task 9 afirma 8 porque a fixture sintética tem 8: atualizar a asserção.
- [ ] **Troféus multi-jogador:** forma real de `/trophies?players=a-b`; a atribuição usa um campo `player` opcional por linha. Se não vier, fica a alternativa um a um (30 pedidos por semana em vez de 2).
- [ ] **VSports:** formato de `dt` (ISO ou `D/M/YYYY`; os dois são aceites) e tipo do resumo (`"summary"` ou `"resume"`).
- [ ] **Futsal:** etiqueta "hora XX" nas fichas de jogo (uma etiqueta desconhecida gera alerta); horas comparadas com o JSON-LD; desvio do JSON-LD numa ficha de **inverno** (a afirmação é `+01:00`, confirmar que não é `+00:00`).
- [ ] **Hóquei em patins:** liga `233` no hoqueipatins.pt e fases `/136/15` e `/136/20` no hp.fpp.pt; `date` contra `date_gmt` no hoqueipatins.
- [ ] **Textos de ronda:** playoffs e formato "Jornada N" das minicompetições (futsal e hóquei) mostrados em português e nunca "J" + texto.
- [ ] **Liga dos Campeões:** com `fixtures/rounds` real, a ronda atual é a fase de liga (não o quadro); um jogo de pré-eliminatória por acabar não prende a ronda; a alternativa por ordem de jogos (quando o endpoint de rondas falha) não troca a vista para quadro; nomes em português para as pré-eliminatórias.
- [ ] **Adiamentos:** se possível, ver um jogo adiado tarde pela API (o ticker pode fazer até 4 h de polling de um `NS`).
- [ ] **X (Twitter):** escalão da conta de programador e limite mensal de leitura no portal. O código novo usa a mesma cadência da antiga (`0 */10 * * *`, 2 contas, 10 tweets por pedido, ≈5 pedidos/dia, ≈1.500 tweets/mês): tem de caber no escalão atual.
- [ ] **Manutenção anual:** os ids de época do hoqueipatins (`seasons=1122` para 2026/2027) e das fases do hp.fpp.pt mudam todos os anos: atualizar em `sourcesConfig.ts` em agosto.

## 4. Integrar o v2027-app (PARAGEM (Martim): git local, sem deploy)

As regras, os índices e as callables do Plano 3 só se publicam a partir da árvore que tem o `v2027-app` integrado. Como os índices são precisos antes do modo sombra (secção 5), a integração faz-se aqui.

```bash
git checkout v2027
git merge v2027-app
```

Conflitos esperados (notas do ledger):
- `firestore.rules`: manter o bloco da Task 18 **e** o `publicProfiles` e as guardas de `users` (create/update) do Plano 3.
- `functions/tsconfig.test.json`: manter `resolveJsonModule`, `allowJs` e o `include` com `"scripts"`.
- `firestore.indexes.json`: manter os índices de `matches` **e** os `fieldOverrides` do Plano 3 (`entries.uid`, collection group).
- `functions/src/callables/validation.ts`: união (o Plano 2 é dono de `validGameId`; corrigir o import em `voteMvp.ts`).

Depois: apagar `PENDING_MERGE_FUNCTIONS` em `functions/scripts/deployLists.ts` e as referências a ela em `functions/test/unit/exports.test.ts` (o teste passa a ser estrito), `npm run lint && npm test && npm run test:emulator`, commit. Push só com o OK do Martim.

## 5. Índices (PARAGEM (Martim))

```bash
firebase firestore:indexes --project scp360-37a74 > /tmp/prod-indexes.json
```

Juntar ao `firestore.indexes.json` todos os índices e `fieldOverrides` de produção que lá não estejam (para o deploy não propor apagá-los) e fazer commit. Depois:

```bash
firebase deploy --only firestore:indexes --project scp360-37a74
```

O CLI pode perguntar duas vezes (primeiro pelos índices, depois pelos field overrides que estão em produção e não no ficheiro): responder **não** às duas. Esperar que os índices de `matches` (`sport`+`kickoff`, `sport`+`finishedAt`) fiquem "Ativado" na consola antes da secção 6.

## 6. Modo sombra (PARAGEM (Martim))

Pré-requisitos: secções 2 a 5 feitas, e a 7 e a 8 (emblema e alerta) de preferência também. O `functions/.env.scp360-37a74` tem exatamente estas três linhas, sem segredos:

```
LEGACY_COLLECTION_PREFIX=_shadow_
VSPORTS_SEASON_ID=
NEWS_LEGACY_CONTENT=true
```

```bash
cat functions/.env.scp360-37a74   # confirmar LEGACY_COLLECTION_PREFIX=_shadow_ antes de publicar
date -u +%Y-%m-%dT%H:%M:%SZ   # guardar: é o --since da comparação
firebase deploy --only functions:v2027:footballFixturesSync,functions:v2027:footballPostMatchSync,functions:v2027:footballLiveTicker,functions:v2027:footballStandingsSync,functions:v2027:footballSeasonSync,functions:v2027:footballWeeklySync,functions:v2027:footballPrematchSync,functions:v2027:videosSync,functions:v2027:newsSync,functions:v2027:tweetsSync,functions:v2027:apiSportsSync,functions:v2027:freeSourcesSync --project scp360-37a74
```

Com o prefixo `_shadow_`, as coleções antigas são escritas em `_shadow_games`, `_shadow_summaries`, etc.; o modelo novo (`matches`, `competitions`, `teams`, `venues`, `ingestHealth`, `ingestState`) é escrito nas coleções reais, que a V2 não lê. A `legacyPredictionSettlement` **não** é publicada aqui.

**Teste de isolamento, logo a seguir à publicação:** na consola do Cloud Scheduler, "Forçar execução" no `footballFixturesSync` (não esperar pelas 3 h), esperar 2 minutos e correr:

```bash
cd functions && npx tsx scripts/check-predeploy.ts --project scp360-37a74 --phase shadow
```

Esperado: `OK: sombra isolada.` (`_shadow_games` com documentos e nenhum `games`/`standings` real com `_ingest == "v2027"`; só count(), barato). **Se falhar: correr de imediato o "Antes do corte" da secção 17** (apagar as 12 novas) e avisar; as antigas reescrevem as coleções reais nas execuções seguintes.

Verificar também: na consola as 13 antigas continuam ativas; as 12 novas correm sem erros; `ingestHealth/*` com `lastOkAt` recente. Durante a sombra o ticker novo e o `liveMatchUpdater` antigo pedem os dois à API-Football num dia de jogo (consumo a dobrar durante alguns dias, dentro da quota Pro).

### Comparação depois de N horas (verificação, só leitura)

Depois de pelo menos um `footballFixturesSync` (3 h), um `newsSync`, um `footballStandingsSync` (6 h) e, de preferência, um jogo do Sporting já acabado:

```bash
cd functions
npx tsx scripts/compare-legacy.ts --project scp360-37a74 --since <hora guardada acima>
```

O script conta primeiro os documentos (1 leitura por documento de cada coleção real e sombra, mais 2 por documento comparado) e pára acima de `--max-reads` (150.000); `--collections games,standings` limita. Esperado: `RESULTADO: zero diferenças fora das esperadas` e saída 0. `news.summary` conta como esperado quando é o resumo (`summarize`, 400 caracteres) do `content`.

Diferenças já classificadas como esperadas (não contam): `_ingest`; em `games`, `isActive`, `endTime` (estado real em vez da janela de 150 min), `channel` (manual, não existe em sombra) e `predictionsSettled`; qualquer `*.logo` que passa a ser o emblema de 2026; `summaries.playerSub` vazio como `""` ou `"null"`; contadores de `players` `0`/`""`/`null`; `news.sport` e `news.publishedAt` (campos novos); `news.summary` resumido do `content`; `tweets.metrics.*`; jogos só em sombra de competições que a função antiga não pedia (e os seus `summaries`, `lineups`, etc.).

Diferenças a explicar caso a caso (não são erro por si): jogo a decorrer no momento da leitura (`elapsedTime`, resultado), notícias ou tweets que uma das functions já apanhou e a outra ainda não. Conferir também no painel da RapidAPI o consumo real do dia face à secção 16.

## 7. Emblema de 2026 no Hosting (PARAGEM (Martim))

URL fixo no código (`functions/src/config/brand.ts`): `https://scp360-37a74.web.app/brand/sporting-cp-2026.png`. O ficheiro está no repositório em `brand/sporting-cp-2026.png`. **Fazer antes do corte (secção 9).**

1. Ver se o site já tem conteúdo (um deploy de Hosting substitui o site inteiro):
   ```bash
   curl -sI https://scp360-37a74.web.app/ | head -1
   firebase hosting:sites:list --project scp360-37a74
   ```
   Consola Firebase, Hosting: histórico de versões. Se houver uma versão publicada com conteúdo (não a página "Site Not Found"), **parar**: juntar esses ficheiros à pasta abaixo antes de publicar, ou decidir com o Martim outra solução.
2. Publicar a partir de uma pasta temporária fora do repositório (o `firebase.json` do repositório não tem Hosting):
   ```bash
   REPO=$(git rev-parse --show-toplevel)
   mkdir -p /tmp/s360-hosting/public/brand && cd /tmp/s360-hosting
   cp "$REPO/brand/sporting-cp-2026.png" public/brand/
   cat > firebase.json <<'EOF'
   { "hosting": { "public": "public", "headers": [ { "source": "/brand/**", "headers": [ { "key": "Cache-Control", "value": "public, max-age=86400" }, { "key": "Access-Control-Allow-Origin", "value": "*" } ] } ] } }
   EOF
   "$REPO/functions/node_modules/.bin/firebase" deploy --only hosting --project scp360-37a74
   curl -sI https://scp360-37a74.web.app/brand/sporting-cp-2026.png
   ```
   Esperado: `HTTP/2 200` e `content-type: image/png`.

## 8. Alerta por email (PARAGEM (Martim))

Destino: martimbustorff@gmail.com. As functions escrevem `logger.error("INGEST_ALERT", { source, reason })` (JSON, `jsonPayload.message = "INGEST_ALERT"`). Pode fazer-se a qualquer momento depois da secção 2; recomendado antes da secção 6.

```bash
# Métrica (para gráficos e histórico)
gcloud logging metrics create ingest_alert --project scp360-37a74 \
  --description="Alertas de ingestão do S360 (INGEST_ALERT)" \
  --log-filter='resource.type="cloud_run_revision" AND severity>=ERROR AND (jsonPayload.message="INGEST_ALERT" OR textPayload:"INGEST_ALERT")'

# Canal de email
gcloud beta monitoring channels create --project scp360-37a74 \
  --display-name="S360 alertas (Martim)" --type=email \
  --channel-labels=email_address=martimbustorff@gmail.com \
  --format="value(name)"
# guardar o nome devolvido: projects/scp360-37a74/notificationChannels/<ID>
```

Política de alerta baseada em logs, com no máximo 1 email por hora (desduplicado) e fecho automático ao fim de 1 dia. Gravar em `/tmp/ingest-alert-policy.json`, trocando `<ID>`:

```json
{
  "displayName": "S360 INGEST_ALERT",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "INGEST_ALERT nos logs das functions v2027",
      "conditionMatchedLog": {
        "filter": "resource.type=\"cloud_run_revision\" AND severity>=ERROR AND (jsonPayload.message=\"INGEST_ALERT\" OR textPayload:\"INGEST_ALERT\")",
        "labelExtractors": { "source": "EXTRACT(jsonPayload.source)", "reason": "EXTRACT(jsonPayload.reason)" }
      }
    }
  ],
  "alertStrategy": { "notificationRateLimit": { "period": "3600s" }, "autoClose": "86400s" },
  "notificationChannels": ["projects/scp360-37a74/notificationChannels/<ID>"],
  "documentation": {
    "mimeType": "text/markdown",
    "content": "Uma fonte de dados do S360 falhou ou está fora do normal. Ver ingestHealth/{source} no Firestore e os logs da function."
  }
}
```

```bash
gcloud monitoring policies create --policy-from-file=/tmp/ingest-alert-policy.json --project scp360-37a74
```

O Cloud Monitoring pode abrir um incidente (e um email) por cada combinação de etiquetas (`source`, `reason`), o que fura o limite de 1 por hora quando várias fontes falham ao mesmo tempo: confirmar no primeiro alerta real e, se vierem demasiados, tirar `reason` dos `labelExtractors`. Se o `gcloud` disser que `beta` não está instalado: `gcloud components install beta` (ou `alpha`, se a política for recusada pelo comando GA).

Testar o filtro (só leitura): `gcloud logging read 'jsonPayload.message="INGEST_ALERT"' --limit 5 --freshness 7d --project scp360-37a74` mostra as entradas que disparam o alerta. O primeiro alerta real confirma o email; os seguintes da mesma política chegam no máximo um por hora.

## 9. Corte dos writers (PARAGEM (Martim))

Pré-requisitos:
- comparação da secção 6 limpa;
- nenhum jogo de futebol do Sporting nas 6 h antes nem nas 6 h depois;
- emblema publicado: `curl -sI https://scp360-37a74.web.app/brand/sporting-cp-2026.png` devolve `200` e `image/png` (senão fazer primeiro a secção 7: a partir do corte os `games` reais passam a apontar para este URL);
- alerta de email criado (secção 8), para o corte já ficar vigiado.

Cópia de segurança das coleções que o corte passa a escrever. O balde tem de estar numa localização compatível com a base de dados; ver primeiro onde ela está:

```bash
gcloud firestore databases describe --database="(default)" --format="value(locationId)" --project scp360-37a74
```

| `locationId` | `--location` do balde |
|---|---|
| `eur3` (multirregião Europa; a do projeto, segundo o plano) | `EU` (ou uma das regiões que a compõem: `europe-west1`, `europe-west4`) |
| `nam5` (multirregião EUA) | `US` (ou uma das regiões que a compõem: `us-central1`, `us-central2`) |
| região única (ex. `europe-west1`) | a mesma região |

```bash
gcloud storage buckets create gs://scp360-37a74-backups --location=<da tabela> --project scp360-37a74   # uma vez; pode já existir
gcloud firestore export gs://scp360-37a74-backups/pre-corte-$(date -u +%Y%m%dT%H%MZ) --collection-ids=games,summaries,stastistics,lineups,players,standings,videos,news,tweets,predictions,manofmatch,rankings,point_events --project scp360-37a74
```

Corte, por esta ordem:

1. Apagar **primeiro** a liquidação antiga (a antiga e a nova ao mesmo tempo dariam o +3 duas vezes, e a antiga liquida jogos `PST` como 0-0):
   ```bash
   firebase functions:delete predictionsSettlementScheduler --region us-central1 --project scp360-37a74
   ```
2. Mudar `functions/.env.scp360-37a74` para `LEGACY_COLLECTION_PREFIX=` (vazio; `VSPORTS_SEASON_ID=` e `NEWS_LEGACY_CONTENT=true` ficam: a V2 ainda lê `content` até ao passo L6), **fazer commit** (senão um deploy futuro a partir de outra cópia do repositório volta a pôr os writers em `_shadow_`, congela os dados da V2 e pára a `legacyPredictionSettlement`) e publicar as de dados com a liquidação nova:
   ```bash
   printf 'LEGACY_COLLECTION_PREFIX=\nVSPORTS_SEASON_ID=\nNEWS_LEGACY_CONTENT=true\n' > functions/.env.scp360-37a74
   cat functions/.env.scp360-37a74
   git add functions/.env.scp360-37a74
   git commit -m "chore: cutover, legacy collections written by v2027"
   ```
   ```bash
   firebase deploy --only functions:v2027:footballFixturesSync,functions:v2027:footballPostMatchSync,functions:v2027:footballLiveTicker,functions:v2027:footballStandingsSync,functions:v2027:footballSeasonSync,functions:v2027:footballWeeklySync,functions:v2027:footballPrematchSync,functions:v2027:videosSync,functions:v2027:newsSync,functions:v2027:tweetsSync,functions:v2027:apiSportsSync,functions:v2027:freeSourcesSync,functions:v2027:legacyPredictionSettlement --project scp360-37a74
   ```
   Se o deploy falhar a meio (algumas functions publicadas, outras não): repetir **o mesmo comando**. Não avançar para o passo 3 antes de `cd functions && npx tsx scripts/check-predeploy.ts --project scp360-37a74` mostrar as 13 functions de dados e corte em `europe-west1` (linha `functions v2027`) e nenhuma desconhecida.
3. Logo a seguir, apagar as outras 12 antigas por nome (confirmar a lista no prompt; sem `--force`):
   ```bash
   firebase functions:delete gamesSheduler liveMatchUpdater summarySheduler statisticsSheduler newsSheduler twitterScheduler videosSheduler PlayersSheduler lineupsheduler standingsSheduler games backfill --region us-central1 --project scp360-37a74
   ```

Verificar:
- `npx tsx scripts/check-predeploy.ts --project scp360-37a74` mostra `functions antigas (us-central1): 0/13` e nenhuma desconhecida (`firebase functions:list --project scp360-37a74` só mostra `europe-west1`);
- nos logs das antigas não há invocações depois da hora do corte;
- `games/{próximo jogo}._ingest === "v2027"`; `ingestHealth/legacy_prediction_settlement` com `lastOkAt` recente;
- **PARAGEM (Martim): teste rápido na V2 de produção**, antes das regras: a lista de jogos e a agenda abrem, o detalhe de um jogo recente abre (sumário, estatísticas, formações), e o emblema novo do Sporting aparece. Se algo falhar: secção 17.

Apagar as coleções sombra 48 h depois do corte (cada comando pede confirmação):

```bash
for c in games summaries stastistics lineups players standings videos news tweets; do
  firebase firestore:delete _shadow_$c --recursive --project scp360-37a74
done
```

## 10. Preencher o modelo novo (PARAGEM (Martim): chave no ambiente)

```bash
cd functions
read -rs RAPIDAPI_KEY && export RAPIDAPI_KEY
GOOGLE_CLOUD_PROJECT=scp360-37a74 npx tsx scripts/backfill-season.ts --season 2026 --new-model-only
unset RAPIDAPI_KEY
```

Escreve só `matches` e `details` dos jogos terminados da época 2026/2027 (1 pedido pela época mais 1 por cada 20 jogos). O script não aceita `--project`: o projeto vem de `GOOGLE_CLOUD_PROJECT` (PowerShell: `$env:GOOGLE_CLOUD_PROJECT = "scp360-37a74"`).

## 11. Regras (PARAGEM (Martim))

Só a partir da árvore com o `v2027-app` integrado (secção 4): o `firestore.rules` tem de ter o bloco da Task 18 e o `publicProfiles`/`users` do Plano 3, e a regra `config/{id}` com leitura anónima de `config/app` (o UpdateGate da app nova abre sem ela).

```bash
cd functions && npx tsx scripts/check-predeploy.ts --project scp360-37a74 && cd ..
firebase deploy --only firestore:rules --project scp360-37a74
```

Se os índices mudaram com a integração (o `fieldOverrides` `entries.uid`), publicar também `firebase deploy --only firestore:indexes --project scp360-37a74` (responder **não** a apagar).

Para voltar atrás nas regras: consola Firebase, Firestore, Regras, versão anterior, Publicar.

## 12. Teste da V2 em produção (PARAGEM (Martim): telemóvel com a V2 da loja)

Logo a seguir às regras:
- [ ] entrar com email; sair e entrar por **PIN**;
- [ ] **multi-conta**: trocar de conta e voltar;
- [ ] **GameBox**: criar, **editar** e apagar;
- [ ] fazer um prognóstico e votar no MVP num jogo; ver o ranking (os +1 entram);
- [ ] notícias e tweets abrem;
- [ ] detalhe de um jogo recente: sumário, estatísticas, formações, jogadores, vídeos; classificação; emblema novo do Sporting visível.

Nos logs: nenhum `PERMISSION_DENIED` nas escritas da V2 e nenhuma das functions antigas voltou a correr. Se algo falhar: regras anteriores (secção 11) e avisar.

## 13. Motor do Plano 1 e callables do Plano 3 (PARAGEM (Martim))

A partir da árvore integrada (as três callables do Plano 3 só existem lá):

```bash
firebase deploy --only functions:v2027:submitPrediction,functions:v2027:voteMvp,functions:v2027:settleScheduler,functions:v2027:updateProfile,functions:v2027:deleteAccount,functions:v2027:linkProviderByEmail --project scp360-37a74
```

Verificar: `settleScheduler` corre de 10 em 10 minutos e devolve 0 sem jogos por liquidar; as callables aparecem em `europe-west1`. A V2 não as usa; a app nova (Planos 4 e 5) sim.

## 14. config/app (PARAGEM (Martim))

```bash
cd functions
npx tsx scripts/seed-config.ts --project scp360-37a74
```

Esperado `scp360-37a74: config/app created` (ou `exists`, e nesse caso não se mexe; `--force` só com o OK do Martim, porque substitui a versão mínima). O seed tem `features.comunidadeLeonina: false` e os textos do UpdateGate do Plano 3.

## 15. Apple: fluxo com código OAuth (PARAGEM (Martim): Apple Developer e consola Firebase)

Necessário para apagar conta com Apple (a app nova chama `revokeToken(authorizationCode)` antes de `deleteAccount`, regra da Apple para revogar o acesso).

1. Apple Developer, Certificates, IDs & Profiles, Keys: criar uma chave com "Sign in with Apple" ativado, ligada ao App ID `com.scp360`. Guardar o **Key ID** e descarregar o `.p8` (só se descarrega uma vez; guardar fora do repositório).
2. Apple Developer: anotar o **Team ID** e o **Services ID** (criar um Services ID com Sign in with Apple se ainda não existir; o return URL é o que a consola Firebase mostra no passo 3).
3. Consola Firebase, Authentication, Sign-in method, Apple: na secção "Configuração do fluxo de código OAuth" preencher Services ID, Apple Team ID, Key ID e o conteúdo da chave privada `.p8`. Guardar.
4. Testar quando a app nova tiver o ecrã de apagar conta (Plano 4/5): conta Apple de teste apagada desaparece em appleid.apple.com, "Iniciar sessão com a Apple".

## 16. Orçamento diário de pedidos

### API-Football (RapidAPI, Pro, 7.500/dia)

| Dado | Pedidos/dia |
|---|---|
| Base sem jogo, com 4 competições (2 com tops): calendário de 3 em 3 h, 1 a 3 épocas (8 a 24); classificações de 6 em 6 h (4 × 4 = 16); rondas, calendário e 4 tops de 6 em 6 h (4 × (6 + 6 + 2 + 2) = 64); plantel, treinador, jogadores (2 páginas), estatísticas por competição (4) e lesões, 1×/dia (≈9); semanais (≈6/semana, ≈1/dia); pós-jogo 09:00 e pré-jogo (0 a ≈5) | ≈100 a 120 (≈110 a 150 com uma 5.ª competição, ex. Supertaça, ou mais tops) |
| Um jogo de 90 min (pré-jogo 75 × 1/min, em jogo ≈112 min × 4/min, classificação de 15 em 15 min, 2 refrescos de fim de jogo, pós-jogo 25 × 1/min, 3 refrescos de notas) | ≈573 |
| Um jogo com prolongamento e penáltis | ≈768 (≈776 europeu) |
| Jogo adiado já guardado como `PST` | 0 (pior caso ≈375 se a API só o adiar depois da hora) |
| **Dia com 1 jogo** | **≈670 a 900** |
| **Dia com 2 jogos** (raro; teto de planeamento) | **≈1.450** (≈1.700 com prolongamento nos dois) |
| Durante o modo sombra, num dia de jogo, somar o `liveMatchUpdater` antigo | consumo a dobrar |

Linha do plano a atualizar no fim (Task 21, roteiro): "máximo diário < 1.000" passa a "≈1.450 num dia com 2 jogos".

### API-Sports (RapidAPI, gratuito, 100/dia por modalidade)

| Modalidade | Sem jogo | Dia com jogo |
|---|---|---|
| Andebol (2 ligas) | ≈16 | ≈36 |
| Voleibol (6 ligas) | ≈32 | ≈52; 2 jogos no mesmo dia ≈72 a 74 |
| Basquetebol (2 ligas) | ≈16 | ≈36 |

Calendário de 3 em 3 h (8/dia), 1 por cada tick de 10 min na janela do jogo (≈20 por jogo), classificações 4×/dia por liga coberta e +1 por liga quando um jogo do Sporting acaba. Depois de uma falha fora de janela espera 1 h (pior caso 24/dia). Todas abaixo de 100 (máximo realista ≈74). Hoje as três estão desligadas (`enabled: false`) até os ids da secção 3 estarem confirmados: 0 pedidos.

### Fontes sem chave (pedidos por dia)

| Fonte | Sem jogo | Dia com jogo |
|---|---|---|
| futsalportugal.com | ≈20 a 36 | +≈26 |
| hp.fpp.pt | ≈36 a 48 | +≈13 |
| hoqueipatins.pt | ≈12 | +≈13 a 26 |
| **Total** | **≈70 a 110** | **+≈40 a 60** |
| VSports (sem quota publicada) | 0 sem jogo nas 48 h anteriores | ≈360 no dia do jogo, ≈96 no dia seguinte |
| RSS de notícias (3 fontes, de 15 em 15 min) | ≈288 | ≈288 |
| X (2 contas, `0 */10 * * *`) | ≈5 pedidos, ≈50 tweets | igual |

## 17. Reverter (PARAGEM (Martim))

### Antes do corte (só sombra)

As antigas nunca deixaram de correr. Apagar as novas de dados e, se se quiser, as coleções sombra:

```bash
firebase functions:delete footballFixturesSync footballPostMatchSync footballLiveTicker footballStandingsSync footballSeasonSync footballWeeklySync footballPrematchSync videosSync newsSync tweetsSync apiSportsSync freeSourcesSync --region europe-west1 --project scp360-37a74
```

O modelo novo (`matches`, `competitions`, `teams`, `venues`, `ingestHealth`, `ingestState`) não é lido pela V2 e pode ficar.

### Depois do corte

1. Parar as novas nas coleções antigas: `functions/.env.scp360-37a74` de volta a `_shadow_` **com commit**, apagar a liquidação nova **antes** de repor a antiga, e republicar as de dados (passam a escrever em sombra):
   ```bash
   printf 'LEGACY_COLLECTION_PREFIX=_shadow_\nVSPORTS_SEASON_ID=\nNEWS_LEGACY_CONTENT=true\n' > functions/.env.scp360-37a74
   git add functions/.env.scp360-37a74
   git commit -m "chore: revert cutover, v2027 back to shadow collections"
   firebase functions:delete legacyPredictionSettlement --region europe-west1 --project scp360-37a74
   firebase deploy --only functions:v2027:footballFixturesSync,functions:v2027:footballPostMatchSync,functions:v2027:footballLiveTicker,functions:v2027:footballStandingsSync,functions:v2027:footballSeasonSync,functions:v2027:footballWeeklySync,functions:v2027:footballPrematchSync,functions:v2027:videosSync,functions:v2027:newsSync,functions:v2027:tweetsSync,functions:v2027:apiSportsSync,functions:v2027:freeSourcesSync --project scp360-37a74
   ```
   (Ou apagá-las com o comando da secção anterior.)
2. Republicar as 13 antigas a partir do código completo. A cópia `legacy/v2-functions` do repositório **não compila** (os ficheiros com chaves foram omitidos); usar o zip original `predictionsSettlementScheduler_function-source.zip` (PC do Martim, `Desktop\Personal\S360`), numa pasta temporária fora do repositório:
   ```bash
   mkdir -p /tmp/s360-legacy/functions && cd /tmp/s360-legacy
   unzip <caminho>/predictionsSettlementScheduler_function-source.zip -d functions
   cat > firebase.json <<'EOF'
   { "functions": [ { "source": "functions", "codebase": "default" } ] }
   EOF
   echo '{"projects":{"default":"scp360-37a74"}}' > .firebaserc
   (cd functions && npm ci && npm run build)
   firebase deploy --only functions:default:gamesSheduler,functions:default:liveMatchUpdater,functions:default:summarySheduler,functions:default:statisticsSheduler,functions:default:newsSheduler,functions:default:twitterScheduler,functions:default:videosSheduler,functions:default:PlayersSheduler,functions:default:lineupsheduler,functions:default:standingsSheduler,functions:default:predictionsSettlementScheduler,functions:default:games,functions:default:backfill --project scp360-37a74
   ```
   Ficam em `us-central1` como antes (o código não define região). Confirmar no prompt que nenhuma `v2027` é apagada (com `--only` por nome não é).
3. Coleções: `games`, `summaries`, `stastistics`, `lineups`, `players`, `standings`, `videos`, `news`, `tweets` são reescritas pelas antigas nas execuções seguintes (notícias em 15 min, jogos e classificações em 2 h, resumos, jogadores e formações às 09:00 UTC). Documentos que só a v2027 escrevia (jogos de competições que a antiga não pedia) ficam com `_ingest: "v2027"`; apagá-los se aparecerem a mais na V2. Se houver dados estragados, repor a cópia da secção 9:
   ```bash
   gcloud firestore import gs://scp360-37a74-backups/pre-corte-<data> --collection-ids=games,summaries,stastistics,lineups,players,standings,videos,news,tweets --project scp360-37a74
   ```
   O import substitui os documentos com o mesmo id e não apaga os novos.
4. Pontos da V2: só se a `legacyPredictionSettlement` tiver dado pontos errados. Ver os `point_events` `exact_score_*` criados depois do corte. Repor `predictions`, `rankings`, `point_events` (e `games`) da cópia desfaz também os +1 legítimos feitos desde o corte; preferir corrigir à mão os documentos afetados.
5. Regras: consola Firebase, Firestore, Regras, versão anterior. Motor e callables (secção 13): `firebase functions:delete submitPrediction voteMvp settleScheduler updateProfile deleteAccount linkProviderByEmail --region europe-west1 --project scp360-37a74` (a V2 não os usa).
6. Segredos e índices não precisam de reversão.
