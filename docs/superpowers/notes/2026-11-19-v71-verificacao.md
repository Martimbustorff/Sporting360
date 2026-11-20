# Verificação final contra o Figma V7.1

Data: 19/11/2026.
Método: leitura do código de cada ecrã e componente contra `get_screenshot` (e `get_design_context` quando foi preciso um valor exato) do frame; sem build nem simulador.
Estado: verificação visual em dispositivo pendente.

## Grupo A

Legenda: "intencional" = decisão já tomada (não se muda); "corrigido" = diferença não intencional resolvida nesta tarefa; "pendente Martim" = precisa de decisão de produto (nenhum em aberto).

| Frame | Ecrã/componente (ficheiro) | Diferença | Decisão |
|---|---|---|---|
| 01 Home · Próximo jogo | `app/(app)/index.tsx` | Logótipo S360 desenhado a 68 pt (estilo do ecrã de bloqueio); o frame usa 48 pt | corrigido (Text71 `brand48`) |
| 01 | `app/(app)/index.tsx` | Linha RANKING com ícone Feather "award"; o frame desenha o troféu (V7.1 Icon / Trophy) | corrigido (usa `assets/icons/trophy.svg`) |
| 01 | `NextMatchCard.tsx`, `TvChip.tsx` | Chip do canal de TV ("SPORT TV") | corrigido no plano 9 (32cface): `TvChip` com o canal de `config/tvChannels`, só no estado "próximo jogo" e só quando há canal |
| 01 | `NextMatchCard.tsx` | Badge da ronda com raio 12 (frame 10) | intencional: 10 não existe nos tokens de raios (8, 12, 16, 28) |
| 01 | `HomeGameboxSheet.tsx` / `Sheet.tsx` | Folha recolhida 116 pt (frame 112) e título 5 pt mais acima | intencional: a linha do título é um alvo de 44 pt |
| 01 | `app/(app)/index.tsx` | Linha COMUNIDADE LEONINA (só com a flag) | intencional: fora do frame, escondida por omissão |
| 01b Sem jogo agendado | `NextMatchCard.tsx` | Sem diferenças (tira "PRÓXIMO JOGO", ícone a 40 %, "SEM JOGOS AGENDADOS", frase, "VER AGENDA →") | sem diferenças |
| 01b | `NextMatchCard.tsx` | Estado de erro "JOGO INDISPONÍVEL" / "TENTAR OUTRA VEZ" não existe no Figma | corrigido no plano 9: frame 01e "Home · Erro" (4971:9784) com a copy do código |
| 01c A carregar | `NextMatchCard.tsx` | Esqueleto com pulsar de opacidade em vez do degradé do frame | intencional: cores lisas, sem biblioteca de degradés |
| 07a Dia de jogo | `NextMatchCard.tsx` | Sem diferenças (HOJE · hora, contagem Title 32, chip PROGNÓSTICO) | sem diferenças |
| 07b Ao vivo | `NextMatchCard.tsx` | Sem diferenças (minuto a primary-on-dark, resultado Display 40, chip VER JOGO) | sem diferenças |
| 07c Depois do jogo | `NextMatchCard.tsx` | Sem diferenças (TERMINADO, FIM DO JOGO, VOTA NO MVP) | sem diferenças |
| 43 GameBox aberta | `HomeGameboxSheet.tsx`, `GameboxCard.tsx` | Número mostrado sem espaços ("001234567890"); o frame mostra "0012 3456 7890" | corrigido no plano 9 (32cface, 1dd04d2): `formatGameboxNumber` só para ver; o QR, a validação e o rótulo de acessibilidade usam os algarismos sem espaços |
| 43b Sem GameBox | `HomeGameboxSheet.tsx` | Sem diferenças (câmara, texto com ligação "insere manualmente", botão DIGITALIZAR) | sem diferenças |
| 47 Estados do sistema | `PushBanner.tsx` | Faltava o emblema 26x30, o padding era 16/8 com espaço 4 e a sombra era a das folhas | corrigido (emblema, padding 14/12, espaço 12 e 2, sombra 0 6 18) |
| 47 | `EmptyState.tsx` | Ícone "info" a 122 pt em Feather, espaço 16; o frame tem o SVG Info a 64 pt e espaço 12 | corrigido (`assets/icons/info.svg`, 64 pt) |
| 47 | `OfflineBanner.tsx` | Raio 12 (frame 10) | intencional: 10 não existe nos tokens |
| 47 | `Skeleton.tsx` (novo) | Os ecrãs desenhavam o carregamento em branco; o frame define o esqueleto (círculo 32 + barra 12, 3 linhas) | corrigido (`SkeletonRows` nos separadores Estatísticas, Vídeos, Formações e Classificação; pulsar em vez de degradé, intencional) |
| 47 | Carregamento dos restantes ecrãs (Agenda, competição, perfil, etc.) | Continuam com os seus esqueletos próprios | corrigido no plano 9 (2cff8a6, 3b58b21): `SkeletonRows` / `ScreenSkeleton` em Agenda, competição, perfil, jogador, comunidade e (via `TeamRows`) Equipa e Marcadores; frames 35c, 36c, 22c, 38c, 42c e 11c |
| 47 | `NextMatchCard.tsx`, separadores do jogo | Erro "Não foi possível carregar os dados." igual ao frame | sem diferenças |
| 48b Ativar Face ID | `BiometricGate.tsx`, `ModalSheet.tsx` | Ícone Ionicons "scan-outline" em vez do glifo Face ID do Figma | intencional: equivalente nativo; copy, botões Branco/Contorno e grabber à esquerda iguais ao frame |
| 49b Apagar Gamebox (alerta) | `app/(app)/gamebox/[id].tsx` | Sem diferenças (alerta nativo, título, frase, Cancelar e Apagar destrutivo) | sem diferenças |
| 06 Jogo · ao vivo | `GameHeader.tsx`, `MatchTimeline.tsx`, `PredictionSummary.tsx` | Chip do canal e sino não desenhados; caixas brancas lisas em vez de degradé | intencional (sem ação do sino, cores lisas); o canal de TV passou a existir no plano 9 e o frame ao vivo não o mostra |
| 06 | `SummaryTab.tsx` | O frame mostra "Números do jogo" (posse, remates, xG) e cartões de lance com comentário no Sumário; a app tem as estatísticas no separador Estatísticas e a cronologia do frame 08 | corrigido no plano 9 (2cff8a6): ao vivo o Sumário mostra "Números do jogo" (Posse de bola, Remates, Golos esperados (xG)) e lances com segunda linha tirada dos dados (`LiveSummary.tsx`); terminado mantém o frame 08 |
| 06 | `SummaryTab.tsx` | Segundo amarelo a vermelho e separadores de parte; a ordem cronológica era intencional | corrigido, mais recente primeiro (Martim); os separadores seguem a ordem invertida |
| 08 Sumário terminado | `SummaryTab.tsx` | Forma, Confrontos diretos e Ausências só apareciam antes do jogo; no frame aparecem por baixo da cronologia | corrigido (`MatchContext`: só no estado terminado, depois de os eventos carregarem, só com dados, sem Previsão nem avisos; ao vivo (06) não mostra contexto; testes novos) |
| 08 | `SummaryTab.tsx` | Cronologia com separadores de parte e resultado; a ordem de jogo era intencional | corrigido, mais recente primeiro (Martim); a última parte fica no topo |
| 09 MVP | `MvpTab.tsx` | Nota com vírgula, posições GR/DEF/MED/AV, lista alfabética, folha de confirmação, botão no fluxo do scroll, selo na segunda linha abaixo de 360 pt | intencional; a lista segue a ordem do onze (`mvpCandidatesInLineupOrder`), decidido antes do plano 9 |
| 10 Classificação | `CompetitionStandings.tsx`, `StandingsTable.tsx` | Emblemas reais, setas em Views, colunas J, DG, PTS, legenda só com zonas presentes, Segmented, critério de desempate | intencional; desempate corrigido com confronto direto (regulamento da Liga Portugal, Martim 19/11) |
| 12 GameBox · modo bilhete | `app/(app)/gamebox/bilhete.tsx` | Ícone do brilho Feather "sun" em vez do desenho do Figma; QR gerado do número da GameBox | intencional: equivalente nativo; QR real |
| 12 | `app/(app)/gamebox/bilhete.tsx` | Deslizar entre as GameBox do utilizador (pela ordem guardada, a abrir na do `id`) com pontos de página; o frame não os tem | acrescentado: pontos de página, pedido do Martim; frame por desenhar |
| 29 Prognóstico | `PredictionTab.tsx`, `Stepper.tsx`, `GameHeader.tsx` | Chip do canal de TV: o `GameHeader` mostra-o com o jogo agendado e canal (32cface); emblema escondido abaixo de 360 pt | corrigido (chip) / intencional (emblema) |
| 30 Partilha | `ShareCard.tsx`, `ModalSheet.tsx` | Folha escura em Modal sem título e grabber ao centro; QR escuro sobre branco com margem branca (bloco de 60 pt) | intencional |
| 31 Estatísticas | `StatsTab.tsx`, `StatRow.tsx` | Alternador Jogo / 1.ª parte / 2.ª parte escondido; conjunto de 10 estatísticas (xG e Faltas) em vez de "Passes certos" | corrigido (Martim), sem pedido extra à API: alternador Total / 1.ª parte / 2.ª parte a partir do instantâneo do intervalo (`firstHalf`, gravado pelo ticker em HT); só com `firstHalf`; "2.ª parte" = total menos 1.ª nas contagens, sem posse, e escondida no intervalo e com prolongamento. O conjunto de 10 estatísticas mantém-se (a regra de negócio ganha) |
| 32 Formações | `LineupsTab.tsx`, `Pitch.tsx` | Linha "Treinador" e textos de estado extra; resto igual | intencional (sem Figma) |
| 33 Vídeos | `VideosTab.tsx`, `VideoPlayer.tsx` | Rótulo do vídeo de golo era "Golo"; o frame diz "LANCE" | corrigido (teste atualizado) |
| 33 | `VideoPlayer.tsx` | Duração do vídeo escondida | intencional: o servidor não grava `duration`; decidido fora (Martim, 19/11) |
| 34 Outra modalidade | `GameHeader.tsx`, `app/(app)/jogo/[id].tsx` | Chip do canal de TV só com canal gravado em `config/tvChannels` (32cface); sem separadores, como no frame | corrigido (chip) / intencional (separadores) |
| (todos do jogo) | `GameHeader.tsx` | `headerScoreRing` #1AB27D | intencional: é o valor do Figma |

## Grupo B

Frames: 02, 03, 04, 05, 13 a 27 (com 21b), 48 e 49. Método e legenda como no Grupo A. Ícones Feather/Ionicons onde o frame usa vetores próprios são aproximações decididas (não repetidas linha a linha).

| Frame | Ecrã/componente (ficheiro) | Diferença | Decisão |
|---|---|---|---|
| 02 Definições | `app/(app)/definicoes/index.tsx` | Rodapé da versão com espaço de 4 (frame 2) | corrigido em 393141c (token `settingsFooterGap`) |
| 02 | `definicoes/index.tsx` | Linha "Ligar conta Apple" só em iOS sem conta Apple ligada; o frame mostra-a sempre | intencional: sem conta por ligar ou fora do iOS a linha não tem função |
| 02 | `definicoes/index.tsx` | "Apagar conta" com texto e ícone danger, sem destaque extra | intencional: encarnado fica fora do botão Branco do ecrã de apagar; frases de ajuda mantêm-se |
| 02 | `definicoes/index.tsx` | "Termos e privacidade" com seta externa mas abre `/definicoes/termos` dentro da app | intencional: Martim decidiu manter como no design (seta externa) |
| 02 | `definicoes/index.tsx` | Ícones Feather (link, bar-chart-2, file-text, log-out, trash-2) em vez dos vetores do frame | intencional: equivalentes nativos |
| 03 Sites do clube | `app/(app)/sites.tsx` | Linha "Gameback" do frame não existia | corrigido (5.ª linha, https://gamebox.sporting.pt/estadio/gameback, ícone de partilha do frame) |
| 03 | `sites.tsx` | Resto igual (intro Body Light, linhas L externas, nota com seta 14) | sem diferenças |
| 04 Estádio | `app/(app)/estadio.tsx` | Legenda "Portas 1 a 12": círculo branco vazio; o frame tem círculo primary 20 com "1" em Badge 11 | corrigido em a8f339b |
| 04 | `estadio.tsx` | Marcador do Museu desenhado no PNG do mapa e entrada "Museu" na legenda, sem ligação; zoom mantém o mapa inteiro | intencional (decisão do Martim) |
| 04 | `estadio.tsx` | Legenda em linha que quebra em ecrãs estreitos; luz do relvado e mapa iguais | intencional: 320 pt |
| 05 Consentimento | `AnalyticsConsentSheet.tsx` | Vistos dos 3 pontos em círculo primary com visto branco e espaço 12; o frame tem o visto primary de 20 sem círculo, espaço 8, alinhado ao topo | corrigido em 2b92dba (`tintColor` primary no mesmo `check-big.svg`) |
| 05 | `AnalyticsConsentSheet.tsx` | Ícone do círculo Feather bar-chart-2 em vez do vetor do frame | intencional: equivalente nativo |
| 05 | `AnalyticsConsentSheet.tsx` | Ligação "Ler a política de privacidade" com alvo de 44 pt | intencional: alvo mínimo |
| 13 Welcome | `app/(auth)/welcome.tsx` | Grupo S360 + frase centrado no espaço livre (no frame fica a 280 pt fixos) | intencional: evita sobrepor os botões no iPhone SE |
| 13 | `welcome.tsx`, `SocialButtons.tsx` | Resto igual (anéis a 22 %, Title L 28, Branco, Contorno, Google e Apple a 12) | sem diferenças |
| 14 Entrar | `app/(auth)/entrar.tsx` | Sem diferenças (Branco, Google/Apple, ligações Caption 12, erro por baixo da password) | sem diferenças |
| 14 | `AuthForm.tsx`, `entrar.tsx` | As duas ligações empilhadas ficam a `AUTH_LINK_ROWS_GAP` (44 menos a linha de texto, cerca de 27 pt) e não aos 12 pt do frame | intencional: 44 pt de toque prevalece sobre os 12 pt do frame |
| 15 Criar conta | `app/(auth)/criar-conta.tsx` | Sem diferenças (botões Google/Apple e "Pelo menos 6 caracteres." presentes; nota dos termos toda ligação) | sem diferenças (decisão do Martim) |
| 16 Recuperar password | `app/(auth)/recuperar-password.tsx` | Título abreviado "Recuperar Pass"; o frame diz "RECUPERAR PASSWORD" | corrigido em cd72fef |
| 17 Termos e condições | `TermsView.tsx`, `definicoes/termos.tsx`, `(auth)/termos.tsx` | Sem diferenças de estilo (Label 16 primary-on-dark, Body Light 14); o corpo vem de `content/termos.ts` (o frame tem texto de exemplo) | sem diferenças |
| 18 Ligar Apple | `app/(app)/ligar-apple.tsx` | Sem diferenças (texto, botão oficial, caixa com visto "Conta Apple ligada.") | sem diferenças |
| 19 Conta S360 | `app/(app)/definicoes/conta.tsx` | Sem diferenças (Nome público com chevron e linha 2 pt, Email 1 pt, "Mudar password" sublinhado) | sem diferenças |
| 20 Mudar password | `app/(app)/definicoes/password.tsx` | Sem diferenças (campos a 32, Guardar Branco logo por baixo) | sem diferenças |
| 21 Apagar conta | `app/(app)/apagar-conta.tsx` | Botão Branco com texto primary (frame tem esse estilo) | intencional (decisão do Martim; encarnado só noutros sítios) |
| 21b Confirmar password | `apagar-conta.tsx`, `ModalSheet.tsx` | Copy igual ao frame; contas só com password veem sempre a folha | intencional (copy aprovada; reautenticação mantida) |
| 22 Perfil | `app/(app)/perfil/index.tsx` | Histórico: pontos a zero apareciam como "+0 PTS"; o frame mostra "0 PTS" | corrigido em 186a308 (teste novo) |
| 22 | `perfil/index.tsx` | Título do histórico "data · Final x-y" em vez de "Sporting 2-1 FC Porto" | corrigido no plano 9 (32cface): título com as equipas lidas do jogo liquidado (`useMatchOnce`); sem jogo carregado fica o título antigo |
| 22 | `perfil/index.tsx` | Acerto como "75 %" (espaço, PT-PT) e o frame "62%" | intencional: formato PT-PT já testado |
| 22 | `perfil/index.tsx` | Ícones Feather (bell, trash-2) nas duas linhas finais | intencional: equivalentes nativos |
| 23 Editar perfil | `app/(app)/perfil/editar.tsx` | Sem diferenças de estrutura (campos, pílulas, jogador com PlayerPhoto, Guardar Branco) | sem diferenças |
| 24 Nome público | `app/(app)/perfil/nome.tsx` | Bloco "Nome atual" que o frame não tem; etiqueta "Novo nome" igual | intencional (Tarefa 14: mostra o nome automático quando não há nome escolhido); copy aprovada verbatim |
| 25 Notificações | `app/(app)/perfil/notificacoes.tsx` | Sem diferenças (2 interruptores, nota, caixa de permissão com "Abrir definições") | intencional: só 2 interruptores (push só para prognóstico e MVP) |
| 26 Ranking | `ranking.tsx`, `RankingRow.tsx` | Nota extra "Contam os pontos de prognósticos e votos MVP, na data do jogo." que o frame não tem | intencional: texto de regra existente mantido |
| 26 | `RankingRow.tsx` | Sem avatar, só nome público | intencional (decisão) |
| 27 Notícias | `noticias.tsx`, `NewsCard.tsx` | Sem diferenças (Tabs sem linha, imagem 96x72, título 2 linhas, "fonte · quando") | sem diferenças |
| 48 Bloqueio | `BiometricGate.tsx`, `LionBackdrop.tsx` | Sem diferenças (logótipo, "A S360 está bloqueada.", Branco e Contorno); estado de falha reutiliza a mesma frase | sem diferenças (estado de falha sem Figma) |
| 49 Terminar sessão (alerta) | `definicoes/index.tsx` | Alerta nativo, título, frase, Cancelar e Terminar sessão destrutivo iguais | sem diferenças |

Resumo do Grupo B: 6 correções (a8f339b, 393141c, 2b92dba, cd72fef, 186a308 e a linha Gameback), o pendente do título do histórico com equipas fechado no plano 9 (32cface); "Termos e privacidade" decidido: mantém-se. Verificação visual em dispositivo continua pendente.

## Grupo C

Frames: 11, 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 46. Método e legenda como nos grupos anteriores; correções em 74428ce.

| Frame | Ecrã/componente (ficheiro) | Diferença | Decisão |
|---|---|---|---|
| 11 Marcadores e assistências | `equipa/marcadores.tsx` | Foto do líder (56) em círculo; o frame usa quadrado de cantos de 20 (componente Foto do jogador escalado) | corrigido em 74428ce (`shape="rounded"`, teste novo) |
| 11 | `marcadores.tsx`, `squadLeaders.ts` | Chip "Champions" agrega as competições europeias; posições GR/DEF/MED/AV em vez de PL/EXT/DD; `byLeague` só depois da próxima sincronização | intencional (decidido na Tarefa 12) |
| 11 | `marcadores.tsx`, `LeaderRows.tsx` | Resto igual (chips, alternador, cartão em degradé, linhas com barra, nota de rodapé) | sem diferenças |
| 35 Calendário | `agenda.tsx`, `MatchRow.tsx` | Estrutura, pílulas, separadores e linhas iguais; pílulas a 24 pt e visíveis em carregamento e erro | intencional (decidido) |
| 35 | `agenda.tsx` | Ícone Users do cabeçalho em Feather em vez do vetor do frame | intencional: equivalente nativo, como nos grupos A e B |
| 35 | `agenda.tsx` | O frame mostra "Fonte: API-Football" por baixo da lista de futebol; a app só mostra "Fonte:" quando há fonte gratuita (teste existente exige a ausência no futebol) | corrigido no plano 9 (32cface): o futebol mostra sempre "Fonte: API-Football" por baixo da lista |
| 35 | `NextMatchCard.tsx` | Chip do canal de TV ("SPORT TV") | corrigido no plano 9 (32cface), como no frame 01 |
| 36 Competição · Jornadas | `competicao/[key].tsx` | Setas do seletor de jornada centradas a 34 pt do bordo; o frame centra-as a 46 pt (margem de 24) | corrigido em 74428ce (margem de 24) |
| 36 | `competicao/[key].tsx`, `MatchRow.tsx` | Resto igual (separadores com scroll, rótulo Title S 20, linhas de jogo, só os jogos do Sporting abrem) | sem diferenças |
| 37 Taça (quadro) | `BracketView.tsx`, `competicao/[key].tsx` | Sem diferenças (separador "Quadro", pílulas por ronda, cartão do Sporting com contorno, penáltis "1 (4-2 g.p.)"); duas mãos e agregado são extra sem frame | sem diferenças |
| 38 Equipa · Plantel | `equipa/index.tsx` | Os indisponíveis não levavam o número no distintivo (o frame mostra 8 e 3) | corrigido em 74428ce (número vindo do plantel) |
| 38 | `equipa/index.tsx` | Linha do treinador sem seta; texto "desde {data}" em vez de "desde 2024-25" | intencional: não há ecrã do treinador; a data vem do documento |
| 39 Equipa · Estatísticas | `equipa/index.tsx` | Terceira linha do cartão "Jogos sem sofrer"; o frame diz "Sem sofrer" | corrigido em 74428ce (teste atualizado) |
| 39 | `equipa/index.tsx` | Título "Jogadores, época 2026/27"; o frame diz "Jogadores da época" | corrigido em 74428ce |
| 39 | `equipa/index.tsx` | Ligação "Ver marcadores" por cima da tabela, que o frame não tem | intencional: é a entrada para o ecrã do frame 11 |
| 39 | `equipa/index.tsx` | Golos sofridos por período só no rótulo de acessibilidade | intencional (como no frame, só marcados) |
| 40 Equipa · Transferências | `equipa/index.tsx` | Sem diferenças (etiqueta Entrada/Saída, nome, "de/para", data e tipo); sem emblema do outro clube | intencional (decidido: o frame não tem emblema) |
| 41 Equipa · Troféus | `equipa/index.tsx`, `TeamRows.tsx` | Título da secção "Treinador, {nome}"; o frame diz só "Treinador" | corrigido em 74428ce |
| 41 | `equipa/index.tsx` | Contagem "N troféus" mais etiqueta com o número, como no frame | intencional (decidido) |
| 41 | `TeamRows.tsx` | Troféu do treinador com "Vencedor/Finalista" à direita, que o frame não mostra | intencional: informação do documento |
| 42 Jogador | `equipa/jogador/[id].tsx` | Título "Época 2026/27" antes dos quatro quadrados; o frame não tem | corrigido em 74428ce (teste atualizado) |
| 42 | `jogador/[id].tsx` | Foto de 84 em quadrado arredondado (já como no frame) | intencional (decidido; a foto do jogador usa `shape="rounded"`) |
| 42 | `jogador/[id].tsx` | Sem remates à baliza, passes-chave, dribles certos e nacionalidade; cartões amarelos e vermelhos em duas linhas | intencional (sem dados) |
| 44 Gestão de Gamebox | `gamebox/index.tsx` | Sem diferenças (pega a 24, nome Title S 20, seta 20, "+" branco de 60); reordenar com arrastar | intencional (decidido: arrastar) |
| 44 | `gamebox/index.tsx` | Bloco "Principal" da GameBox antiga da V2 | intencional: sem frame, regra de dados existente |
| 45 Editar Gamebox | `gamebox/[id].tsx` | Sem diferenças (número com botão de ler 48, nome, cartão com Estádio/Pavilhão e Porta, Sector, Fila, Lugar, "Apagar Gamebox" a danger); folha de criação "Nova Gamebox" | intencional (decidido: porta, sector, fila e lugar; vermelho fica) |
| 46 Ler código | `gamebox/ler.tsx` | Título do cabeçalho "Ler GameBox"; o frame diz "LER CÓDIGO" | corrigido em 74428ce (teste novo) |
| 46 | `gamebox/ler.tsx` | Com o número lido ainda aparecia "Inserir manualmente" por baixo de Corrigir; o frame só tem Confirmar e Corrigir | corrigido em 74428ce (só antes da leitura; teste novo) |
| 46 | `gamebox/ler.tsx` | Estado antes da leitura (dica e "Inserir manualmente") e ecrã sem acesso à câmara | intencional: sem frame (nota 46); número agrupado de 4 em 4 como no frame |

Resumo do Grupo C: 9 correções (todas em 74428ce), o pendente da atribuição API-Football no Calendário fechado no plano 9 (32cface).

## Empréstimo

Plan 8, 19/11. Frames 45La a 45Le, 44L, 12L, 50, 50b e 50c (Task 1) verificados contra o código, mais seis estados que só existiam no código e foram desenhados nesta tarefa (ids entre parênteses na tabela, cada um com nota a +426 do frame). Mesma legenda do Grupo A.

| Frame | Ecrã/componente (ficheiro) | Diferença | Decisão |
|---|---|---|---|
| 45La Editar GameBox · Emprestar | `gamebox/[id].tsx` (LoanSection) | Sem diferenças (botão "Emprestar para o próximo jogo", ajuda "O link só abre na app S360 e expira no fim deste jogo." em caption 12 textMuted) | sem diferenças |
| 45Lb Emprestar · Próximo jogo | `LoanConfirmSheet.tsx` | Cartão do jogo com o emblema real do adversário (o frame tem um escudo genérico neutro) | intencional: o emblema vem dos dados do jogo |
| 45Lb | `LoanConfirmSheet.tsx`, `ModalSheet.tsx` | Folha com espaço de 16 entre elementos e título 5 pt mais abaixo (grabber em fluxo); o frame tem espaço de 14 e título a 28 pt | corrigido no plano 9 (2cff8a6): `ModalSheet` com `gap="tight"` (14, título a 28), só nas folhas de empréstimo; 48b e 21b mantêm o seu espaçamento |
| 45Lb | `LoanConfirmSheet.tsx` | Cartão (surface-10, raio 16, padding 14/12, espaço 12, Label 16 e Caption 12) e botão "Emprestar" iguais; a app acrescenta a linha do recinto, que o frame também tem | sem diferenças |
| 45Lbv Sem jogos em casa | `LoanConfirmSheet.tsx` | Sem diferenças (título, "Sem jogos em casa marcados para esta GameBox.", "Fechar" a contorno) | sem diferenças |
| 45Lc Emprestada · Ainda não aberto | `gamebox/[id].tsx` | Texto "Ainda não aberto" em textMuted; o frame usa branco (Caption Strong 12) | corrigido (branco; aberto continua a primary-on-dark como em 45Ld) |
| 45Lc | `gamebox/[id].tsx` | Ponto de estado é uma View de 8 pt (o frame usa o SVG Ponto) | intencional: equivalente nativo, mesma cor e tamanho |
| 45Lc | `gamebox/[id].tsx` | Botão "Partilhar link outra vez" (contorno) por cima de "Cancelar empréstimo", sem frame | corrigido no Figma: 45Lc passou a mostrá-lo (botão novo 4989:11988 e nota); 45Ld fica sem ele |
| 45Ld Emprestada · Aberto | `gamebox/[id].tsx` | Sem diferenças ("Aberto por {nome} às {HH:MM}" a primary-on-dark, só "Cancelar empréstimo") | sem diferenças |
| 45Le Cancelar empréstimo | `LoanConfirmSheet.tsx` (CancelLoanSheet) | Mesmo espaçamento da folha que em 45Lb (16 contra 14, título 5 pt abaixo); copy, Primário e Contorno iguais | corrigido no plano 9 (2cff8a6), como 45Lb |
| 45Lbc Emprestar · A carregar (novo) | `LoanConfirmSheet.tsx` | Estado sem frame: a folha espera por todas as listas de jogos do recinto; só título e "Fechar". Desenhado agora (4990:11989) a partir de 45Lbv, sem o texto | corrigido no Figma (frame novo, copy igual ao código) |
| 45Lbe Emprestar · Erro ao carregar (novo) | `LoanConfirmSheet.tsx` | Estado sem frame: lista em erro. "Não foi possível concluir. Tenta outra vez." a vermelho (body 14, centrado) e "Fechar". Desenhado agora (4990:12085) | corrigido no Figma (frame novo) |
| 45Lbm Emprestar · Erro ao emprestar (novo) | `LoanConfirmSheet.tsx` | Estado sem frame: a mensagem do dono depois de "Emprestar" (por exemplo "Já tens um empréstimo ativo para este jogo.") aparece a vermelho, centrada, entre o cartão e o botão. Desenhado agora (4990:12181); a nota lista as outras mensagens | corrigido no Figma (frame novo) |
| 44L Gestão de GameBox · Emprestada a mim | `gamebox/index.tsx` (LentRow) | Sem diferenças (padding 14, Title S 20, "Emprestada por {nome}" a primary-on-dark Caption Strong 12, seta de 20, sem pega) | sem diferenças |
| 44L | `gamebox/index.tsx` | As linhas emprestadas ficam a seguir às GameBox e antes do bloco "Principal" próprio da app; no frame "Principal" é uma linha normal | intencional: o bloco "Principal" já existia e não se mexe |
| 12L Modo bilhete · Emprestada | `gamebox/bilhete.tsx` | Sem diferenças (bloco do QR com padding 32/24, Title 24 ink e Caption 12 ink-muted, espaço 8, botão "Cancelar empréstimo" a contorno) | sem diferenças |
| 12L | `gamebox/bilhete.tsx` | O bloco "Sócio" mantém nome e número de sócio da app; o frame mostra um nome de exemplo | intencional: dados reais do utilizador |
| 12Lc Modo bilhete · A carregar empréstimo (novo) | `gamebox/bilhete.tsx` | Estado sem frame: enquanto o estado do empréstimo não chega, nem QR nem aviso, só o espaço de 220 pt; o aviso de brilho mantém-se. Desenhado agora (4990:12676) | corrigido no Figma (frame novo) |
| 50 Empréstimo · Ecrã do destinatário | `emprestimo/[id].tsx`, `MatchCard.tsx` | O destinatário nunca vê o número, só o QR (o frame também não o mostra); QR real em vez do ilustrativo; sem selo nem rodapé do frame 30 | intencional (decisão do Martim de 19/11) |
| 50 | `emprestimo/[id].tsx` | Colunas do lugar com `flex:1` e só as preenchidas (o frame tem 4 colunas de 64 pt) | intencional: a 320 pt as 4 colunas de 64 não cabem |
| 50 | `emprestimo/[id].tsx` | Brilho máximo e ecrã sempre ligado só enquanto o cartão está à vista; o aviso do frame mantém-se sempre no cartão | intencional (decisão do Martim) |
| 50 | `emprestimo/[id].tsx` | Barra de estado e indicador de início são do sistema | intencional |
| 50b Já aberto noutra conta | `emprestimo/[id].tsx` (Notice), `EmptyState.tsx` | `EmptyState` com padding vertical 32; o frame tem 8 em cima e 24 até ao botão | corrigido no plano 9 (2cff8a6): `EmptyState compact` (ícone a 8 do topo, sem folga por baixo), só no ecrã do empréstimo |
| 50c Já não está ativo | `emprestimo/[id].tsx` | Mesmo layout e a mesma diferença que 50b, com o outro texto | corrigido no plano 9 (2cff8a6), como 50b |
| 50d Empréstimo · A abrir (novo) | `emprestimo/[id].tsx` | Estado sem frame: enquanto o claim corre, só o cabeçalho "GameBox", sem texto nem cartão. Desenhado agora (4990:12290) | corrigido no Figma (frame novo) |
| 50e Empréstimo · Sem ligação (novo) | `emprestimo/[id].tsx` | Estado sem frame: "Sem ligação. Tenta outra vez quando houver rede.", "Tentar outra vez" (primário) e "Fechar". O erro desconhecido usa o mesmo desenho com "Não foi possível concluir. Tenta outra vez.". Desenhado agora (4990:12638) | corrigido no Figma (frame novo) |
| Novos 45Lc, 45Lbc, 45Lbe, 45Lbm, 50d, 50e, 12Lc | Figma | Copy acrescentado pelo código: "Partilhar link outra vez", "Tentar outra vez", as mensagens de erro e o estado a carregar | aprovado pelo Martim a 19/11 21:52 |
| Todos | Folha de partilha | A folha de partilha é a nativa do sistema (o texto está na nota do 45La) | intencional |

Resumo do Empréstimo: 17 frames verificados (11 do Task 1 e 6 novos), 1 correção no código (45Lc), 6 frames novos e 1 atualizado no Figma; os 3 pendentes Martim fechados no plano 9 (2cff8a6 e aprovação de 19/11 21:52).

## Resumo

Método: leitura do código contra o frame, sem build nem simulador; a verificação visual em dispositivo continua pendente. Contagem: uma linha é um frame; uma linha com duas decisões conta na primeira, por isso os totais são aproximados.

| | Frames verificados | Correções | Pendentes Martim |
|---|---|---|---|
| Grupo A | 22 | 13 | 0 |
| Grupo B | 22 | 7 | 0 |
| Grupo C | 12 | 10 | 0 |
| Empréstimo | 17 | 3 | 0 |
| Plano 9 (frames novos) | 11 | 1 | 0 |
| Total | 84 | 34 | 0 |

Diferenças intencionais registadas: 57 (decididas pelo Martim ou equivalentes nativos, não se mudam). Os 11 pendentes Martim foram todos fechados no plano 9 (ver "Pendentes fechados (plano 9)"). Decididos a 19/11: 03 Gameback (corrigido), 02 "Termos e privacidade" (mantém-se como no design), 10 desempate (corrigido com confronto direto), 31 alternador de partes (corrigido com o instantâneo do intervalo), 33 duração do vídeo (fora).

Testes finais (plano 9): mobile npx jest 149 suites, 2353 ok; tsc limpo; check:tokens ok (176 ficheiros); npm run lint (ESLint) sem erros nem avisos; functions npm test 33 suites, 614 ok; lint e build limpos; emulador 26 suites, 841 ok.

### Pendentes Martim

Todos fechados no plano 9 (19/11).

1. Home sem jogo (01b): fechado, o estado de erro tem o frame 01e (4971:9784) com a copy do código.
2. GameBox aberta (43): fechado, número em grupos de 4 só no ecrã (32cface, 1dd04d2).
3. Estados de carregamento (47): fechado, `SkeletonRows` generalizado aos restantes ecrãs (2cff8a6, 3b58b21).
4. Sumário do jogo (06 e 08): fechado, ao vivo tem "Números do jogo" e segundas linhas tiradas dos dados; terminado mantém o frame 08 (2cff8a6).
5. MVP (09): fechado, a lista segue a ordem do onze (decidido antes, já no código).
6. Estatísticas do jogo (31): fechado, alternador Total / 1.ª parte / 2.ª parte já no código (c8ed7c4, d16fd0e).
7. Perfil (22): fechado, título do histórico com as equipas (32cface).
8. Calendário (35): fechado, "Fonte: API-Football" no futebol (32cface).
9. Empréstimo (45Lb, 45Le): fechado, `ModalSheet` por família de frame com a variante `tight` (2cff8a6).
10. Empréstimo (50b, 50c): fechado, `EmptyState` compacto (2cff8a6).
11. Empréstimo (frames novos): fechado, frames e copy aprovados pelo Martim a 19/11 21:52.

## Pendentes fechados (plano 9)

Verificação a 19/11 com `get_screenshot` de cada frame contra o código. Frames e código coincidem nos valores medidos (espaços 14 e título a 28 nas folhas de empréstimo, `EmptyState` com 8 em cima e 0 por baixo, cores das pílulas).

| Frame | Ecrã/ficheiro | Diferença | Decisão |
|---|---|---|---|
| 12s 4994:12254 | `gamebox/bilhete.tsx` | Pontos de página (ativo branco) | sem diferenças |
| 35c 4994:12606, 36c 4994:12713, 22c 4994:12835, 38c 4994:12960, 42c 4994:13069, 11c 4994:13150 | `agenda.tsx`, `competicao/[key].tsx`, `perfil/index.tsx`, `equipa/index.tsx`, `equipa/jogador/[id].tsx`, `equipa/marcadores.tsx` (`Skeleton.tsx`) | Esqueleto de 3 linhas (círculo 32 e barra 12) por baixo do cabeçalho; os seis frames estão completos e corretos | sem diferenças (nada partido no Figma) |
| 45Lr 4994:13276 | `gamebox/[id].tsx` | Aviso ao dono "Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado." com botão de fechar | sem diferenças |
| 06 4924:6268 | `LiveSummary.tsx` | "Números do jogo" (Posse de bola, Remates, Golos esperados (xG)) e lances com segunda linha | sem diferenças |
| 01 4921:5155, 35 4948:8199 | `TvChip.tsx`, `NextMatchCard.tsx`, `agenda.tsx` | Chip "SPORT TV" e "Fonte: API-Football" | sem diferenças |
| 43 4951:8434 | `GameboxCard.tsx` | Número "0012 3456 7890" | sem diferenças |
| 22 4942:7608 | `perfil/index.tsx` | Títulos do histórico com as equipas | sem diferenças |
| 10 4935:7111, 10b 4997:12493, 10c 4997:12673 | `StandingsTable.tsx`, `CompetitionStandings.tsx` | Vistas Resumida, Completa e Forma; nota "Com os resultados dos jogos a decorrer."; pílula D do Figma com color/danger (#F74C66), o código usa `formLetterBg` com `colors.formLoss` (#E53836) | corrigido no Figma: variante D de "Classificação / Pill forma" (4997:12490) passou a #E53836, sem variável (não existe uma com este valor); as instâncias herdam. V (color/primary) e E (color/surface-20, 20 %) já coincidiam |
| 45Lb 4984:11545, 45Le 4985:11932 | `LoanConfirmSheet.tsx`, `ModalSheet.tsx` | Espaço 14 e título a 28 | sem diferenças (`gap="tight"`) |
| 50b 4984:13376, 50c 4984:13411 | `emprestimo/[id].tsx`, `EmptyState.tsx` | Ícone a 8 do topo, sem folga por baixo | sem diferenças (`compact`) |
| 10 4935:7111 (ponto ao vivo), 45L (ecrã do empréstimo), 12s 4994:12254 (Ticket) | `CompetitionStandings.tsx`, `StandingsTable.tsx`, `emprestimo/[id].tsx`, `gamebox/bilhete.tsx` | Revisão final: ponto "a jogar agora" só em jogos a decorrer (não nos terminados ainda no documento ao vivo) e rótulo da Forma com "a jogar agora" antes dos resultados; brilho do cartão do empréstimo só com o QR desenhado; Ticket com espaço de carregamento até as listas e os empréstimos responderem (um erro conta como resposta e o QR aparece); canal de TV mantém o valor guardado quando `config/tvChannels` não se lê | corrigido no código, sem alterações nos frames |
| 10b 4997:12493 (tabela ao vivo) | `StandingsTable.tsx` | Jogos já terminados na tabela ao vivo: sem etiqueta, só os números atualizados (Martim 19/11 23:43) | corrigido no código, sem alterações nos frames |

Pendentes Martim neste plano: nenhum.

## Home: fundo revisto depois do TestFlight (20/11)

Pedido do Martim ao testar o build 9 (7.0.0): duas arestas no fundo da Home, mais verde em cima, leão e anéis mais abaixo, bem dimensionado em todos os telemóveis. Sem build só para isto.

| Frame | Ecrã ou ficheiro | Diferença | Decisão |
|---|---|---|---|
| Componente "V7.1 / Home backdrop" 4920:5141 (usado em 01, 01b, 01c, 01e, 05, 07a, 07b, 07c, 43, 43b, 43e, 48, 48b, 48e) | `mobile/src/components/LionBackdrop.tsx`, `mobile/src/lib/homeBackdrop.ts` | Os anéis eram cortados numa caixa fixa de 402 pt (aresta vertical à direita em ecrãs mais largos). O esbatido de baixo saía opaco, porque o react-native-svg ignora a transparência de uma cor no `stopColor` (aresta horizontal a 220 pt do fundo). Leão e anéis tinham medidas fixas do frame de 402 x 874. | corrigido: geometria em proporções do ecrã (leão alinhado pelo fundo e pelo olho a 80 % da largura; anéis com 1,5 larguras centrados no olho; véu verde opaco em cima que tapa a aresta de cima do leão; transparências em `stopOpacity`). Componente do Figma redesenhado com as mesmas fórmulas. Testes em 10 tamanhos, de 320 x 568 a tablet e paisagem. |
