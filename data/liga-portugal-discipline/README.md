# Liga Portugal 2026/27 — Discipline Database

Fonte de verdade versionada para a radiografia disciplinar S360 dos três grandes: FC Porto, SL Benfica e Sporting CP.

## Princípio

Nunca usar um total de época como fonte primária. A base é **jogo a jogo**; os totais da infografia são sempre derivados da soma dos jogos já realizados.

## Campos disciplinares

Para cada equipa em cada jogo guardamos:

- `fouls`: faltas cometidas.
- `yellow_first`: cartões amarelos contabilizados como amarelos normais/primeiros amarelos.
- `second_yellow`: segundos amarelos que originam expulsão.
- `direct_red`: vermelhos diretos.
- `yellow_shown`: `yellow_first + second_yellow` — este é o número a usar na infografia quando a pergunta é “quantos amarelos viram?”.
- `red_total`: `second_yellow + direct_red`.

Isto evita o problema clássico de alguns fornecedores contarem um segundo amarelo apenas como vermelho, enquanto outros contam também o cartão amarelo que foi efetivamente mostrado.

## Regra de publicação

1. Preferir dados **match-level** a agregados de época.
2. Idealmente cruzar cada jogo com duas fontes independentes.
3. Em caso de divergência, marcar `verification_status: disputed` e não publicar esse valor como definitivo.
4. Os totais e médias da infografia devem ser gerados pelo script `aggregate.py`; não devem ser editados à mão.
5. Guardar sempre URL(s) de origem e `verified_at`.

## Correção que originou esta base

FC Porto 2–1 Moreirense, 04/09/2026: Moreirense fez 12 faltas, viu 2 amarelos e 1 vermelho direto (Guilherme Liberato). A infografia anterior mostrava 0 vermelhos para os adversários do Porto e estava errada.

## Estrutura

- `matches.json` — registo canónico jogo a jogo.
- `snapshot-2026-09-05.json` — fotografia atual calculada a partir dos jogos.
- `schema.json` — definição dos campos.
- `aggregate.py` — cálculo automático dos totais para cada grande e respetivos adversários.

## Convenção S360

Para a infografia, `cartões amarelos` = todos os amarelos efetivamente mostrados (`yellow_shown`). `cartões vermelhos` = todas as expulsões (`red_total`), distinguindo internamente `direct_red` de `second_yellow`.
