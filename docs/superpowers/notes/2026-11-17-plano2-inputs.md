# Inputs para o Plano 2 e o Plano 4 (Martim, 17/11/2026)

- Manter a VSports (apism.vsports.pt, canal Sporting "scp"; embeds iframe com bigpicture e minuto). Liga, Taça e Taça da Liga; sem Champions.
- Leitor de vídeo novo: miniatura, toque toca logo, ecrã total com rotação para horizontal, fechar volta a vertical sem bloquear (iOS e Android). Carregar só o src do embed, não o HTML com script.
- Fim do jogo: usar o estado real da API-Football (status, elapsed) em vez de endTime = início + 150 min.
- Live: servidor faz polling no máximo a cada 15 s durante o jogo, grava uma vez no Firestore, a app ouve em tempo real (onSnapshot). Fora de jogo, chamadas raras.
- Extras escolhidos: lances ao minuto e estatísticas (incl. xG); onzes, tática e notas dos jogadores; lesionados e suspensos; pré-jogo (confrontos, forma, previsão da API).
- Martim quer ver o resto do catálogo da API-Football antes de escolher mais.

## Extras adicionais escolhidos (17/11, 21:02)
- Época e competição: classificação ao vivo de cada competição; melhores marcadores, assistências e cartões; jornadas e calendário completo de cada competição.
- Equipa e jogadores: plantel com fotos, números, posições e treinador; estatísticas da época por jogador (golos, assistências, minutos, nota média); estatísticas da época da equipa (forma, golos por período, marcados e sofridos em casa e fora); transferências; troféus; histórico de lesões por jogador.
- Jogo: estádio com foto e capacidade; árbitro.
- Outras modalidades: API-Sports de andebol, voleibol e basquetebol (calendário, resultados, classificações). Futsal e hóquei com outras fontes.
- Odds: não (excluído).

## Cartão de prognóstico partilhável (17/11, 21:07)
- Recuperar o cartão "S360 MATCHDAY" (competição, jornada, data, emblemas, prognóstico, #JogoAJogoLadoALado, "Partilha o teu prognóstico") com o design do Figma.
- Partilha = imagem + texto com link. A V2 atual só partilha a imagem (expo-sharing não leva texto); usar react-native-share (imagem e mensagem juntas).
- Link único (ex.: página no Firebase Hosting) que deteta o sistema e abre a App Store ou a Google Play; se a app já estiver instalada, abre o jogo (universal links / app links). Firebase Dynamic Links já não existe.
- Link ou QR curto também desenhado no próprio cartão, porque algumas apps (ex. Instagram stories, WhatsApp em certos casos) largam o texto.
- Medir: parâmetro de origem no link (ex. ?src=share&game=...) para saber quantos downloads vêm das partilhas.
