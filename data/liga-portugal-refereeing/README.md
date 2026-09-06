# S360 — Liga Portugal 2026/27 Refereeing Decision Panel

Braço paralelo da base disciplinar S360 para mapear decisões de arbitragem com potencial benefício/prejuízo para FC Porto, SL Benfica e Sporting CP.

## Âmbito

Apenas **Liga Portugal 2026/27**. Não entram Taça, Supertaça, competições UEFA ou amigáveis.

## Objetivo

Medir decisões concretas e documentadas. O sistema **não parte da conclusão de que existe favorecimento intencional**. Regista erros/decisões controversas de forma simétrica e deixa os padrões emergirem dos dados.

## Duas camadas

### 1. Decisões-chave
Entram no painel principal: penáltis incorretos ou omitidos, golos validados/invalidados incorretamente, vermelhos diretos incorretos ou por mostrar, segundos amarelos que deveriam provocar expulsão, erros de fora de jogo diretamente ligados a golo e erros VAR materialmente relevantes.

### 2. Disciplina secundária
Amarelos por mostrar, amarelos incorretos e outras decisões disciplinares sem impacto material imediato. Esta camada é armazenada e agregada separadamente para não dar o mesmo peso a um amarelo e a uma expulsão/penálti.

## Classificação por clube

Cada decisão pode ser `favor`, `against`, `neutral`, `disputed` ou `not_applicable`. Só decisões `confirmed` entram nos totais públicos. `candidate` e `disputed` ficam visíveis para auditoria, mas fora da contagem.

## Regra de verdade / publicação

Uma decisão só fica `confirmed` se cumprir uma destas condições:

1. fonte oficial (FPF / Conselho de Arbitragem / áudio VAR oficial) reconhece o erro; ou
2. dois antigos árbitros independentes e identificados concordam; ou
3. um antigo árbitro identificado + evidência clara do lance/aplicação da Lei do Jogo, sem opinião especializada credível em sentido contrário.

Se houver divergência séria, fica `disputed`. O painel não escolhe silenciosamente um lado.

## Hierarquia de fontes

- `A_OFFICIAL`: FPF / Conselho de Arbitragem / VAR oficial.
- `B_EX_REFEREE`: análise assinada por antigo árbitro reconhecido.
- `C_MATCH_EVIDENCE`: relato, vídeo, ficha de jogo ou agregador de análises usado para rastreabilidade e evidência do evento.

## Regras de integridade

1. Registar sempre jornada, minuto, jogo, árbitro, decisão em campo e decisão correta segundo a fonte.
2. Guardar URL e identidade da fonte.
3. Nunca usar comentários de adeptos ou contas partidárias como fonte de verdade.
4. Pesquisar erros a favor e contra de forma simétrica nos jogos dos três clubes.
5. Ausência de análise não significa zero erros: significa revisão pendente.
6. Não inferir pontos ganhos/perdidos como facto.
7. Antes de publicar, todos os jogos realizados dos três clubes no universo temporal da infografia têm de estar `reviewed`.

## Backfill jornadas 1–5

O backfill inicial cobre todos os jogos já realizados das jornadas 1–5. O Moreirense–SL Benfica da jornada 3 está `not_played`, por ter sido adiado para 09/09/2026.

À hora de fecho do backfill (06/09/2026 00:44 Lisboa), **Marítimo–SL Benfica** e **Sporting CP–CD Nacional** já tinham terminado, mas ainda não existia cobertura completa de antigos árbitros suficiente para fechar a revisão. Permanecem `awaiting_full_expert_review` e bloqueiam uma publicação definitiva da radiografia de erros até serem fechados.

O Porto–Moreirense da jornada 5 está totalmente incorporado. O sistema distingue erros confirmados, candidatos e lances disputados.

## Pipeline semanal

1. Adicionar/confirmar os jogos em `match_reviews.json`.
2. Após o jogo, recolher lances candidatos em fontes match-level e análises de antigos árbitros.
3. Criar/atualizar as linhas em `decisions.json`.
4. `candidate` nunca entra nos totais.
5. `disputed` nunca entra nos totais.
6. Só `confirmed` entra em `aggregate.py`.
7. Correr `validate.py` durante a manutenção normal.
8. Antes de divulgar uma infografia, correr `validate.py --publish`.
9. Se `--publish` falhar, **não publicar a radiografia como definitiva**.
10. `build_review_queue.py` lista os jogos que ainda exigem pesquisa e gera queries de pesquisa.
11. `new_match_template.py` cria o esqueleto canónico de um novo jogo.
12. Os totais da infografia vêm sempre do agregador; nunca são digitados à mão.

## Controlos anti-regressão

`validate.py` inclui âncoras de sanidade para as quatro primeiras jornadas, confrontadas com totais de uma fonte agregadora independente: FC Porto 3 erros a favor / 4 contra; SL Benfica 3 / 2; Sporting CP 5 / 5. Alterações retroativas que quebrem estas âncoras obrigam a investigar a origem antes de aceitar os novos números.

## Métricas da futura infografia

Por clube:
- erros confirmados a favor;
- erros confirmados contra;
- saldo;
- separação entre decisões-chave e disciplina secundária;
- decomposição por penáltis, golos, expulsões e VAR;
- lances disputados mostrados separadamente, sem entrarem no saldo.

## Regra visual Sporting CP

Em **todas as infografias S360** deve ser usado o **novo símbolo do Sporting Clube de Portugal fornecido pelo proprietário do projeto nesta conversa**, nunca o emblema clássico anterior. O símbolo deve ser tratado como asset canónico e não deve ser redesenhado ou substituído automaticamente por geração de imagem.

## Estrutura

- `decisions.json` — registo canónico lance a lance.
- `match_reviews.json` — manifesto de jogos e estado de revisão.
- `snapshot-round5.json` — fotografia do backfill atual.
- `sources.json` — fontes e antigos árbitros aceites.
- `schema.json` e `match_reviews.schema.json` — contratos dos dados.
- `aggregate.py` — totais por clube e categoria.
- `validate.py` — validação e publication gate.
- `build_review_queue.py` — fila automática de investigação pendente.
- `new_match_template.py` — gerador de esqueleto para futuras jornadas.

## Convenção editorial

A base mede decisões documentadas. Um eventual padrão estatístico pode ser mostrado, mas não é por si só prova de intenção, favorecimento deliberado ou corrupção.
