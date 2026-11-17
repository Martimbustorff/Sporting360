# Inputs para o Plano 2 e o Plano 4 (Martim, 17/11/2026)

- Manter a VSports (apism.vsports.pt, canal Sporting "scp"; embeds iframe com bigpicture e minuto). Liga, Taça e Taça da Liga; sem Champions.
- Leitor de vídeo novo: miniatura, toque toca logo, ecrã total com rotação para horizontal, fechar volta a vertical sem bloquear (iOS e Android). Carregar só o src do embed, não o HTML com script.
- Fim do jogo: usar o estado real da API-Football (status, elapsed) em vez de endTime = início + 150 min.
- Live: servidor faz polling no máximo a cada 15 s durante o jogo, grava uma vez no Firestore, a app ouve em tempo real (onSnapshot). Fora de jogo, chamadas raras.
- Extras escolhidos: lances ao minuto e estatísticas (incl. xG); onzes, tática e notas dos jogadores; lesionados e suspensos; pré-jogo (confrontos, forma, previsão da API).
- Martim quer ver o resto do catálogo da API-Football antes de escolher mais.
