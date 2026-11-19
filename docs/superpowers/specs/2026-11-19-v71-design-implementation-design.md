# S360 V7.1: passar o design aprovado para o código

Data: 19/11/2026. Aprovado pelo Martim: lotes 1 a 7 do Figma (19/11, 07:24 a 11:05) e "podes passar o design 7.1 para o código" (11:10).

## Intenção

A V2027 funciona mas o aspeto ficou abaixo do esperado ("feio"). A V7.1 aplica o design aprovado no Figma a todos os ecrãs da app, junta os extras escolhidos pelo Martim e corrige a causa raiz dos estilos perdidos (Pressable com estilo em função sob NativeWind).

## Fonte de verdade visual

- Ficheiro Figma `R3IhhyNxNZuVINgUtJjZE3`, página **S360 V7.1** (`4912:5041`).
- Quadro de componentes `4918:5041`. Mapa de cobertura no topo da página e em `.superpowers/design-v71/06-cobertura-figma.md`.
- Cada frame tem uma nota ao lado com as decisões. As notas valem como requisitos.

| Frames | Ecrã |
|---|---|
| 01, 01b, 01c, 07a, 07b, 07c, 43, 43b, 48b | Home (cartão do jogo em 6 estados, folha GameBox, folha Face ID) |
| 02, 49 | Definições, alerta de terminar sessão |
| 03, 04, 05 | Sites, Estádio, consentimento de analítica |
| 06, 08, 09, 10, 29, 30, 31, 32, 33, 34 | Detalhe do jogo (todos os separadores e outras modalidades) |
| 12 | GameBox em modo bilhete (novo) |
| 13 a 21b | Entrada e conta |
| 22 a 27 | Perfil, editar, nome público, notificações, ranking, notícias |
| 35 a 42 | Calendário, competição, equipa, jogador |
| 11 | Marcadores e assistências do Sporting (novo) |
| 44, 45, 46, 49b | GameBox: lista, editar, leitor, alerta de apagar |
| 47, 48 | Estados do sistema, bloqueio com Face ID |

## Decisões fechadas

- Tipografia DIN real (licença do Martim): `DINCondensed-Regular.ttf` (peso visual bold condensado) para os estilos "DIN Condensed", `DINCondensed-Light.ttf` para o "MATCH" fino, `DIN-Bold.ttf` para os estilos "DIN" (Menu 15, Badge 11). Poppins para o corpo. Ficheiros em `/home/claude/v2src/SCP360_V2-master/src/assets/fonts/`. O Barlow provisório sai.
- Emblema do Sporting 2026 local (`assets/images/sporting-cp-2026.png`) em todo o lado.
- Fotos dos jogadores: campo `photo` que o servidor já guarda; silhueta quando falta. Nunca no cartão de partilha.
- Push: só lembrete de prognóstico e abertura do MVP (já feito, Plano 6).
- Extras V7.1: 1 Home pelo momento do jogo com contagem; 4 notas dos jogadores e selo "Melhor nota" no MVP; 5 classificação atual e ao vivo; 6 marcadores e assistências do Sporting; 7 Sumário melhorado; 8 GameBox em modo bilhete. O 3 (calendário do telemóvel) fica de fora.
- MVP: lista pela ordem do onze, nada pré-selecionado, a nota é só referência.
- Estádio: Museu só no mapa e na legenda, sem ligação.
- GameBox guarda porta, sector, fila e lugar (Estádio e Pavilhão).
- Separadores do jogo pela ordem atual da app: Sumário, Vídeos, Estatísticas, Formações, Classificação, Prognóstico, MVP.
- Cores como no Figma. O botão "Apagar conta" do ecrã de apagar é branco com texto verde; o resto do encarnado fica como está.
- Comunidade Leonina fora da V7.1 (continua escondida pela flag).

## Objetivos

- Cada ecrã da app igual ao seu frame (cores, tipografia, espaçamento, componentes, estados).
- Nenhum comportamento existente se perde: regras, mensagens, privacidade, analítica e testes atuais continuam.
- Os extras funcionam com os dados atuais. A classificação ao vivo é a única peça que pede dados novos ao servidor.

## Não objetivos

- Sem mudanças de regras de pontos, regras Firestore, push ou fluxo de conta.
- Sem Apple Wallet, widgets, Live Activities ou calendário do telemóvel.
- Sem deploy nem build nesta fase (precisa do OK do Martim).

## Anti-objetivos

- Estilos que desaparecem em runtime (o bug do Pressable). Nenhum `style={({ pressed }) => ...}` sob NativeWind.
- Cores ou fontes escritas à mão fora dos tokens.
- Pré-selecionar ou ordenar o MVP pela nota.

## Abordagens consideradas

1. **Fundação primeiro, depois ecrã a ecrã (escolhida).** Tokens V7.1, fontes DIN, componente táctil seguro e componentes base; depois cada grupo de ecrãs usa só esses componentes. Menos duplicação, cada tarefa revista contra os frames.
2. Ecrã a ecrã sem fundação: mais rápido no início, mas repetiria estilos e reintroduziria o bug do Pressable.
3. Reescrever com outra biblioteca de UI: risco alto e fora do pedido.

## Classificação ao vivo (dados)

A tabela oficial vem de `standings` (atualiza de hora a hora). A projeção ao vivo precisa dos resultados em curso da mesma liga. O servidor passa a guardar, só durante jogos do Sporting em ligas, os jogos ao vivo da liga (`fixtures?live=all&league=X`, 1 pedido por minuto, cerca de 120 por jogo, dentro da folga de cerca de 5.800 pedidos por dia). A app recalcula: 3 pontos por vitória, 1 por empate sobre a última tabela oficial; desempate por pontos, diferença de golos, golos marcados e, por fim, a ordem oficial. Os critérios oficiais da Liga Portugal ficam por confirmar e a nota do frame 10 diz que a projeção é indicativa.

## O que fica para o construtor

Organização interna dos componentes, nomes de ficheiros novos e testes concretos, desde que respeitem os frames, as notas e as decisões acima.
