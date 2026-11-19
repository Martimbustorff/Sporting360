# Verificação final contra o Figma V7.1

Data: 19/11/2026.
Método: leitura do código de cada ecrã e componente contra `get_screenshot` (e `get_design_context` quando foi preciso um valor exato) do frame; sem build nem simulador.
Estado: verificação visual em dispositivo pendente.

## Grupo A

Legenda: "intencional" = decisão já tomada (não se muda); "corrigido" = diferença não intencional resolvida nesta tarefa; "pendente Martim" = precisa de decisão de produto.

| Frame | Ecrã/componente (ficheiro) | Diferença | Decisão |
|---|---|---|---|
| 01 Home · Próximo jogo | `app/(app)/index.tsx` | Logótipo S360 desenhado a 68 pt (estilo do ecrã de bloqueio); o frame usa 48 pt | corrigido (Text71 `brand48`) |
| 01 | `app/(app)/index.tsx` | Linha RANKING com ícone Feather "award"; o frame desenha o troféu (V7.1 Icon / Trophy) | corrigido (usa `assets/icons/trophy.svg`) |
| 01 | `NextMatchCard.tsx` | Chip do canal de TV (SPORT TV1) não aparece | intencional: o `Match` não tem canal de TV |
| 01 | `NextMatchCard.tsx` | Badge da ronda com raio 12 (frame 10) | intencional: 10 não existe nos tokens de raios (8, 12, 16, 28) |
| 01 | `HomeGameboxSheet.tsx` / `Sheet.tsx` | Folha recolhida 116 pt (frame 112) e título 5 pt mais acima | intencional: a linha do título é um alvo de 44 pt |
| 01 | `app/(app)/index.tsx` | Linha COMUNIDADE LEONINA (só com a flag) | intencional: fora do frame, escondida por omissão |
| 01b Sem jogo agendado | `NextMatchCard.tsx` | Sem diferenças (tira "PRÓXIMO JOGO", ícone a 40 %, "SEM JOGOS AGENDADOS", frase, "VER AGENDA →") | sem diferenças |
| 01b | `NextMatchCard.tsx` | Estado de erro "JOGO INDISPONÍVEL" / "TENTAR OUTRA VEZ" não existe no Figma | pendente Martim (copy) |
| 01c A carregar | `NextMatchCard.tsx` | Esqueleto com pulsar de opacidade em vez do degradé do frame | intencional: cores lisas, sem biblioteca de degradés |
| 07a Dia de jogo | `NextMatchCard.tsx` | Sem diferenças (HOJE · hora, contagem Title 32, chip PROGNÓSTICO) | sem diferenças |
| 07b Ao vivo | `NextMatchCard.tsx` | Sem diferenças (minuto a primary-on-dark, resultado Display 40, chip VER JOGO) | sem diferenças |
| 07c Depois do jogo | `NextMatchCard.tsx` | Sem diferenças (TERMINADO, FIM DO JOGO, VOTA NO MVP) | sem diferenças |
| 43 GameBox aberta | `HomeGameboxSheet.tsx`, `GameboxCard.tsx` | Número mostrado sem espaços ("001234567890"); o frame mostra "0012 3456 7890" | pendente Martim (agrupar de 4 em 4 só no ecrã; afeta o texto copiável) |
| 43b Sem GameBox | `HomeGameboxSheet.tsx` | Sem diferenças (câmara, texto com ligação "insere manualmente", botão DIGITALIZAR) | sem diferenças |
| 47 Estados do sistema | `PushBanner.tsx` | Faltava o emblema 26x30, o padding era 16/8 com espaço 4 e a sombra era a das folhas | corrigido (emblema, padding 14/12, espaço 12 e 2, sombra 0 6 18) |
| 47 | `EmptyState.tsx` | Ícone "info" a 122 pt em Feather, espaço 16; o frame tem o SVG Info a 64 pt e espaço 12 | corrigido (`assets/icons/info.svg`, 64 pt) |
| 47 | `OfflineBanner.tsx` | Raio 12 (frame 10) | intencional: 10 não existe nos tokens |
| 47 | `Skeleton.tsx` (novo) | Os ecrãs desenhavam o carregamento em branco; o frame define o esqueleto (círculo 32 + barra 12, 3 linhas) | corrigido (`SkeletonRows` nos separadores Estatísticas, Vídeos, Formações e Classificação; pulsar em vez de degradé, intencional) |
| 47 | Carregamento dos restantes ecrãs (Agenda, competição, perfil, etc.) | Continuam com os seus esqueletos próprios | pendente Martim (generalizar `SkeletonRows` fora do jogo) |
| 47 | `NextMatchCard.tsx`, separadores do jogo | Erro "Não foi possível carregar os dados." igual ao frame | sem diferenças |
| 48b Ativar Face ID | `BiometricGate.tsx`, `ModalSheet.tsx` | Ícone Ionicons "scan-outline" em vez do glifo Face ID do Figma | intencional: equivalente nativo; copy, botões Branco/Contorno e grabber à esquerda iguais ao frame |
| 49b Apagar Gamebox (alerta) | `app/(app)/gamebox/[id].tsx` | Sem diferenças (alerta nativo, título, frase, Cancelar e Apagar destrutivo) | sem diferenças |
| 06 Jogo · ao vivo | `GameHeader.tsx`, `MatchTimeline.tsx`, `PredictionSummary.tsx` | Chip do canal e sino não desenhados; caixas brancas lisas em vez de degradé | intencional (sem campo de TV, sem ação do sino, cores lisas) |
| 06 | `SummaryTab.tsx` | O frame mostra "Números do jogo" (posse, remates, xG) e cartões de lance com comentário no Sumário; a app tem as estatísticas no separador Estatísticas e a cronologia do frame 08 | pendente Martim (os frames 06 e 08 mostram Sumários diferentes) |
| 06 | `SummaryTab.tsx` | Segundo amarelo a vermelho e separadores de parte; a ordem cronológica era intencional | corrigido, mais recente primeiro (Martim); os separadores seguem a ordem invertida |
| 08 Sumário terminado | `SummaryTab.tsx` | Forma, Confrontos diretos e Ausências só apareciam antes do jogo; no frame aparecem por baixo da cronologia | corrigido (`MatchContext`: só no estado terminado, depois de os eventos carregarem, só com dados, sem Previsão nem avisos; ao vivo (06) não mostra contexto; testes novos) |
| 08 | `SummaryTab.tsx` | Cronologia com separadores de parte e resultado; a ordem de jogo era intencional | corrigido, mais recente primeiro (Martim); a última parte fica no topo |
| 09 MVP | `MvpTab.tsx` | Nota com vírgula, posições GR/DEF/MED/AV, lista alfabética, folha de confirmação, botão no fluxo do scroll, selo na segunda linha abaixo de 360 pt | intencional / pendente Martim (ordem alfabética), como decidido |
| 10 Classificação | `CompetitionStandings.tsx`, `StandingsTable.tsx` | Emblemas reais, setas em Views, colunas J, DG, PTS, legenda só com zonas presentes, Segmented, critério de desempate | intencional; desempate corrigido com confronto direto (regulamento da Liga Portugal, Martim 19/11) |
| 12 GameBox · modo bilhete | `app/(app)/gamebox/bilhete.tsx` | Ícone do brilho Feather "sun" em vez do desenho do Figma; QR gerado do número da GameBox | intencional: equivalente nativo; QR real |
| 29 Prognóstico | `PredictionTab.tsx`, `Stepper.tsx` | Chip do canal de TV não aparece; emblema escondido abaixo de 360 pt | intencional |
| 30 Partilha | `ShareCard.tsx`, `ModalSheet.tsx` | Folha escura em Modal sem título e grabber ao centro; QR escuro sobre branco com margem branca (bloco de 60 pt) | intencional |
| 31 Estatísticas | `StatsTab.tsx`, `StatRow.tsx` | Alternador Jogo / 1.ª parte / 2.ª parte escondido; conjunto de 10 estatísticas (xG e Faltas) em vez de "Passes certos" | intencional: o servidor não grava as partes (pendente Martim); a regra de negócio das estatísticas ganha |
| 32 Formações | `LineupsTab.tsx`, `Pitch.tsx` | Linha "Treinador" e textos de estado extra; resto igual | intencional (sem Figma) |
| 33 Vídeos | `VideosTab.tsx`, `VideoPlayer.tsx` | Rótulo do vídeo de golo era "Golo"; o frame diz "LANCE" | corrigido (teste atualizado) |
| 33 | `VideoPlayer.tsx` | Duração do vídeo escondida | intencional: o servidor não grava `duration`; decidido fora (Martim, 19/11) |
| 34 Outra modalidade | `GameHeader.tsx`, `app/(app)/jogo/[id].tsx` | Chip do canal de TV não aparece; sem separadores, como no frame | intencional |
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
| 22 | `perfil/index.tsx` | Título do histórico "data · Final x-y" em vez de "Sporting 2-1 FC Porto" | pendente Martim (os dados do prognóstico não guardam as equipas) |
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

Resumo do Grupo B: 6 correções (a8f339b, 393141c, 2b92dba, cd72fef, 186a308 e a linha Gameback), 1 pendente Martim (título do histórico com equipas); "Termos e privacidade" decidido: mantém-se. Verificação visual em dispositivo continua pendente.

## Grupo C

Frames: 11, 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 46. Método e legenda como nos grupos anteriores; correções em 74428ce.

| Frame | Ecrã/componente (ficheiro) | Diferença | Decisão |
|---|---|---|---|
| 11 Marcadores e assistências | `equipa/marcadores.tsx` | Foto do líder (56) em círculo; o frame usa quadrado de cantos de 20 (componente Foto do jogador escalado) | corrigido em 74428ce (`shape="rounded"`, teste novo) |
| 11 | `marcadores.tsx`, `squadLeaders.ts` | Chip "Champions" agrega as competições europeias; posições GR/DEF/MED/AV em vez de PL/EXT/DD; `byLeague` só depois da próxima sincronização | intencional (decidido na Tarefa 12) |
| 11 | `marcadores.tsx`, `LeaderRows.tsx` | Resto igual (chips, alternador, cartão em degradé, linhas com barra, nota de rodapé) | sem diferenças |
| 35 Calendário | `agenda.tsx`, `MatchRow.tsx` | Estrutura, pílulas, separadores e linhas iguais; pílulas a 24 pt e visíveis em carregamento e erro | intencional (decidido) |
| 35 | `agenda.tsx` | Ícone Users do cabeçalho em Feather em vez do vetor do frame | intencional: equivalente nativo, como nos grupos A e B |
| 35 | `agenda.tsx` | O frame mostra "Fonte: API-Football" por baixo da lista de futebol; a app só mostra "Fonte:" quando há fonte gratuita (teste existente exige a ausência no futebol) | pendente Martim (mostrar a atribuição da API-Football no futebol) |
| 35 | `NextMatchCard.tsx` | Chip do canal de TV (SPORT TV1) não aparece | intencional: o `Match` não tem canal (como no frame 01) |
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

Resumo do Grupo C: 9 correções (todas em 74428ce), 1 pendente Martim (atribuição API-Football no Calendário).

## Resumo

Método: leitura do código contra o frame, sem build nem simulador; a verificação visual em dispositivo continua pendente.

| | Frames verificados | Correções | Pendentes Martim |
|---|---|---|---|
| Grupo A | 22 | 8 | 6 |
| Grupo B | 22 | 6 | 1 |
| Grupo C | 12 | 9 | 1 |
| Total | 56 | 23 | 8 |

Diferenças intencionais registadas: 52 (decididas pelo Martim ou equivalentes nativos, não se mudam). Dois dos pendentes (09, 31) estão dentro de linhas marcadas como intencionais: a diferença é intencional hoje, mas a decisão de produto fica por tomar. Decididos a 19/11: 03 Gameback (corrigido), 02 "Termos e privacidade" (mantém-se como no design), 10 desempate (corrigido com confronto direto), 33 duração do vídeo (fora).

Testes finais: npx jest 133 suites, 2044 ok; tsc limpo; check:tokens ok.

### Pendentes Martim

1. Home sem jogo (01b): copy do estado de erro "JOGO INDISPONÍVEL" / "TENTAR OUTRA VEZ", que o Figma não tem.
2. GameBox aberta (43): número em grupos de 4 ("0012 3456 7890") só no ecrã, o que afeta o texto copiável.
3. Estados de carregamento (47): generalizar o `SkeletonRows` aos restantes ecrãs (Agenda, competição, perfil, etc.).
4. Sumário do jogo (06 e 08): os dois frames mostram Sumários diferentes ("Números do jogo" e lances com comentário contra a cronologia).
5. MVP (09): ordem alfabética da lista de jogadores.
6. Estatísticas do jogo (31): o servidor não grava as partes (alternador Jogo / 1.ª parte / 2.ª parte).
7. Perfil (22): título do histórico com as equipas ("Sporting 2-1 FC Porto"); o prognóstico não guarda as equipas.
8. Calendário (35): mostrar "Fonte: API-Football" por baixo da lista de futebol, como no frame.
