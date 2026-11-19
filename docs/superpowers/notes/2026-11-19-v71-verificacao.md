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
| 06 | `SummaryTab.tsx` | Segundo amarelo a vermelho e ordem cronológica com separadores de parte | intencional |
| 08 Sumário terminado | `SummaryTab.tsx` | Forma, Confrontos diretos e Ausências só apareciam antes do jogo; no frame aparecem por baixo da cronologia | corrigido (`MatchContext`: só com dados, sem Previsão nem avisos; testes novos) |
| 08 | `SummaryTab.tsx` | Cronologia com separadores de parte e resultado, em ordem de jogo | intencional |
| 09 MVP | `MvpTab.tsx` | Nota com vírgula, posições GR/DEF/MED/AV, lista alfabética, folha de confirmação, botão no fluxo do scroll, selo na segunda linha abaixo de 360 pt | intencional / pendente Martim (ordem alfabética), como decidido |
| 10 Classificação | `CompetitionStandings.tsx`, `StandingsTable.tsx` | Emblemas reais, setas em Views, colunas J, DG, PTS, legenda só com zonas presentes, Segmented, critério de desempate | intencional / pendente Martim (desempate), como decidido |
| 12 GameBox · modo bilhete | `app/(app)/gamebox/bilhete.tsx` | Ícone do brilho Feather "sun" em vez do desenho do Figma; QR gerado do número da GameBox | intencional: equivalente nativo; QR real |
| 29 Prognóstico | `PredictionTab.tsx`, `Stepper.tsx` | Chip do canal de TV não aparece; emblema escondido abaixo de 360 pt | intencional |
| 30 Partilha | `ShareCard.tsx`, `ModalSheet.tsx` | Folha escura em Modal sem título e grabber ao centro; QR escuro sobre branco com margem branca (bloco de 60 pt) | intencional |
| 31 Estatísticas | `StatsTab.tsx`, `StatRow.tsx` | Alternador Jogo / 1.ª parte / 2.ª parte escondido; conjunto de 10 estatísticas (xG e Faltas) em vez de "Passes certos" | intencional: o servidor não grava as partes (pendente Martim); a regra de negócio das estatísticas ganha |
| 32 Formações | `LineupsTab.tsx`, `Pitch.tsx` | Linha "Treinador" e textos de estado extra; resto igual | intencional (sem Figma) |
| 33 Vídeos | `VideosTab.tsx`, `VideoPlayer.tsx` | Rótulo do vídeo de golo era "Golo"; o frame diz "LANCE" | corrigido (teste atualizado) |
| 33 | `VideoPlayer.tsx` | Duração do vídeo escondida | intencional: o servidor não grava `duration` (pendente Martim) |
| 34 Outra modalidade | `GameHeader.tsx`, `app/(app)/jogo/[id].tsx` | Chip do canal de TV não aparece; sem separadores, como no frame | intencional |
| (todos do jogo) | `GameHeader.tsx` | `headerScoreRing` #1AB27D | intencional: é o valor do Figma |
