# Liga Portugal 2026/27 — Discipline Database

Fonte de verdade versionada para a radiografia disciplinar S360 dos três grandes: FC Porto, SL Benfica e Sporting CP.

## Âmbito

Apenas jogos da **Liga Portugal 2026/27**. Não entram Supertaça, Taça de Portugal, Taça da Liga, competições UEFA, amigáveis ou qualquer outra competição.

## Princípio

Nunca usar um total de época como fonte primária isolada. A base é **jogo a jogo**; os totais da infografia são sempre derivados da soma dos jogos já realizados. Totais agregados servem como controlo de sanidade.

## Escopo disciplinar

A infografia mede o critério disciplinar aplicado aos **jogadores**.

Para cada equipa em cada jogo guardamos:

- `fouls`: faltas cometidas pela equipa.
- `yellow_first`: amarelos mostrados a jogadores que não são o segundo amarelo da expulsão.
- `second_yellow`: segundo amarelo mostrado a um jogador e que origina expulsão.
- `direct_red`: vermelho direto mostrado a um jogador.
- `staff_yellow`: amarelos a treinador/staff. São guardados para auditoria, mas **não entram** na infografia.
- `staff_red`: vermelhos a treinador/staff. São guardados para auditoria, mas **não entram** na infografia.
- `yellow_shown`: `yellow_first + second_yellow` — número de amarelos mostrado na infografia.
- `red_total`: `second_yellow + direct_red` — todas as expulsões de jogadores contam, independentemente de serem por segundo amarelo ou vermelho direto.

### Regra essencial

**Uma expulsão conta sempre como expulsão.** Se resultar de segundo amarelo, o segundo amarelo conta também no total de amarelos mostrados.

**Cartões a treinadores ou outros elementos do staff nunca entram nos totais de jogadores.** Este foi o erro que fez o FC Porto aparecer indevidamente com 3 amarelos: no Rio Ave–FC Porto, o cartão de 81' foi mostrado a Francesco Farioli, não a um jogador.

## Regra de publicação

1. A fonte canónica é sempre o registo **match-level**.
2. Cada jogo deve ser cruzado com pelo menos duas fontes independentes sempre que possível.
3. Se fontes divergirem, o jogo fica `disputed` até a identidade do evento ser resolvida. Quando a divergência é resolvida com evidência explícita, fica `resolved_dispute` e a decisão é documentada em `notes`.
4. Nunca inferir um cartão de jogador a partir de um total de equipa sem verificar quem recebeu o cartão.
5. Cartões de staff são armazenados separadamente e excluídos dos cálculos públicos.
6. Os totais e médias da infografia são gerados por `aggregate.py`; não são editados à mão.
7. Antes de publicar, executar `validate.py`. Qualquer erro bloqueia publicação.
8. Guardar sempre URL(s), estado de verificação e `verified_at`.
9. Totais agregados de fornecedores são apenas uma verificação secundária; se não baterem com a soma jogo a jogo, investigar antes de publicar.

## Métricas da infografia

Para **EQUIPA** e **ADVERSÁRIOS**:

- jogos realizados;
- faltas totais;
- média de faltas por jogo;
- cartões amarelos de jogadores;
- expulsões de jogadores;
- `1 amarelo a cada X faltas` = faltas totais / amarelos de jogadores.

Não usar `saldo vs equipa`: é menos intuitivo e não ajuda a leitura do critério disciplinar.

## Correções que originaram/reforçaram esta base

- **FC Porto 2–1 Moreirense, 04/09/2026:** Moreirense fez 12 faltas, viu 2 amarelos e teve 1 jogador expulso por vermelho direto. A infografia anterior mostrava 0 expulsões para os adversários do Porto.
- **Rio Ave 0–2 FC Porto, 15/08/2026:** um fornecedor agregou 1 amarelo ao FC Porto, mas o evento corresponde a Francesco Farioli. Como é staff, o total de amarelos de jogadores do FC Porto nesse jogo é 0.
- **Sporting CP 2–0 Nacional, 05/09/2026:** uma página de jogo apresentou 8 faltas do Sporting, mas o total de época e uma segunda fonte de jogo fecham em 10. O valor canónico é 10, levando o Sporting a 63 faltas após 5 jogos.

## Estrutura

- `matches.json` — registo canónico jogo a jogo.
- `snapshot-2026-09-05.json` — fotografia atual calculada a partir dos jogos.
- `schema.json` — definição dos campos.
- `aggregate.py` — cálculo automático dos totais para cada grande e respetivos adversários.
- `validate.py` — validações de sanidade e regras de publicação.

## Convenção S360

Para a infografia:

- `cartões amarelos` = todos os amarelos efetivamente mostrados a **jogadores** (`yellow_first + second_yellow`);
- `cartões vermelhos` = todas as **expulsões de jogadores** (`direct_red + second_yellow`);
- cartões de staff não entram nestes números.
