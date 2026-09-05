# S360 — Liga Portugal 2026/27 Refereeing Decision Panel

Braço paralelo da base disciplinar S360 para mapear decisões de arbitragem com potencial benefício/prejuízo para FC Porto, SL Benfica e Sporting CP.

## Âmbito

Apenas **Liga Portugal 2026/27**. Não entram Taça, Supertaça, competições UEFA ou amigáveis.

## Objetivo

Medir decisões concretas e documentadas. O sistema **não parte da conclusão de que existe favorecimento intencional**. Regista erros/decisões controversas de forma simétrica e deixa os padrões emergirem dos dados.

## Duas camadas

### 1. Decisões-chave
Entram no painel principal:
- penálti assinalado incorretamente;
- penálti claro não assinalado;
- golo validado incorretamente;
- golo invalidado incorretamente;
- vermelho direto incorreto ou vermelho direto por mostrar;
- segundo amarelo incorreto ou segundo amarelo por mostrar quando teria provocado expulsão;
- erro de fora de jogo que cria/anula diretamente um golo;
- intervenção VAR incorreta ou ausência de intervenção em erro claro e óbvio.

### 2. Disciplina secundária
Guardada separadamente:
- amarelo por mostrar;
- amarelo mostrado incorretamente;
- faltas técnicas/recomeços com relevância mas sem impacto material imediato.

Um amarelo omitido não tem o mesmo peso factual de um penálti ou expulsão. Por isso não é misturado no total principal.

## Classificação por clube

Cada decisão aceite pode ser:
- `favor`: erro beneficiou o clube analisado;
- `against`: erro prejudicou o clube analisado;
- `neutral`: erro existiu, mas sem benefício/prejuízo atribuível aos três grandes;
- `disputed`: especialistas/fontes relevantes divergem; **não entra no total público**.

A métrica principal da futura infografia será contagem simples, não um score subjetivo:
- decisões erradas a favor;
- decisões erradas contra;
- saldo = a favor - contra;
- separação adicional por tipo (penálti, golo, expulsão, VAR, disciplina).

## Regra de verdade / publicação

Uma decisão só fica `confirmed` e entra no painel público se cumprir **uma** destas condições:

1. **Fonte oficial** (Conselho de Arbitragem/FPF, áudio VAR oficial, avaliação oficial publicada) reconhece a decisão/erro; ou
2. **Dois analistas independentes, antigos árbitros identificados, concordam** sobre o erro; ou
3. Um antigo árbitro identificado + evidência oficial inequívoca sobre a aplicação da Lei do Jogo, sem fonte especializada credível em sentido contrário.

Se houver divergência séria entre especialistas, fica `disputed`. O painel público não escolhe silenciosamente um lado.

## Hierarquia de fontes

- `A_OFFICIAL`: FPF / Conselho de Arbitragem / VAR oficial / documentos disciplinares oficiais.
- `B_EX_REFEREE`: análise assinada por antigo árbitro reconhecido (ex.: Pedro Henriques em A BOLA; Iturralde González no Record).
- `C_MATCH_EVIDENCE`: relato, vídeo, ficha de jogo, cronologia ou estatística que comprova o evento, mas não substitui opinião técnica quando a interpretação da lei é discutível.

## Regras de integridade

1. Sempre registar minuto, jogo, árbitro, decisão em campo e decisão correta segundo a fonte.
2. Guardar o texto/paráfrase da conclusão do analista e URL.
3. Nunca usar comentários de adeptos ou contas partidárias como fonte de verdade.
4. Clubes são tratados de forma simétrica: pesquisamos erros a favor e contra em **todos** os jogos dos três.
5. Uma ausência de artigo/análise não significa “zero erros”. Significa `not_reviewed` até revisão.
6. Não inferir pontos ganhos/perdidos como facto. Qualquer cenário contrafactual de pontos fica separado e identificado como estimativa.
7. Antes de publicar uma jornada, todos os jogos dos três clubes dessa jornada têm de estar `reviewed` ou explicitamente `no_major_error` com fontes.

## Infografia paralela proposta

Título: **LIGA PORTUGAL 26/27 — RADIOGRAFIA DAS DECISÕES DE ARBITRAGEM**

Por clube:
- ERROS A FAVOR
- ERROS CONTRA
- SALDO
- PENÁLTIS
- GOLOS
- EXPULSÕES
- VAR

Rodapé: `Fonte: análises de ex-árbitros + fontes oficiais | S360 - iOS e Android`.

## Estrutura

- `decisions.json` — registo canónico lance a lance.
- `sources.json` — registo dos analistas/fontes aceites.
- `schema.json` — contrato dos dados.
- `aggregate.py` — totais por clube e categoria.
- `validate.py` — bloqueia publicação sem evidência/proveniência suficiente.
