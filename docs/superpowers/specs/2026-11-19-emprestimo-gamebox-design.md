# Empréstimo de GameBox por link (S360 V2027)

Data: 19/11/2026. Pedido e decisões do Martim (19:45, 19:59, 20:04).

## Intenção

Quem tem GameBox quer emprestá-la a alguém para um jogo sem que o QR fique a circular. Hoje a única forma é enviar uma captura do QR, que fica válida para sempre e pode ser reencaminhada. O objetivo é aumentar a segurança de quem empresta.

## Objetivos

- Partilhar a GameBox por WhatsApp (ou outra app) como um link.
- O empréstimo vale só para um jogo e expira no fim desse jogo.
- Só abre na app S360, com sessão iniciada, e fica preso à conta de quem o abre primeiro.
- Dentro da app, o ecrã do empréstimo bloqueia capturas e gravações de ecrã.
- O cartão mostra as equipas do jogo correspondente, com o layout do cartão de prognóstico (frame 30), o lugar (porta, sector, fila, lugar) e o QR.
- Quem empresta pode cancelar a qualquer momento e vê se o link já foi aberto e quando.

## Não objetivos

- Abrir o empréstimo numa página web. Não há página: quem não tem a app é reencaminhado para a App Store ou para a Play Store (decisão do Martim, 19/11 20:24).
- Empréstimos para vários jogos, para jogos que não sejam o próximo em casa, ou por tempo.
- Notificações push (regra do Martim: push só para prognóstico e MVP). O estado do empréstimo vê-se dentro da app.
- Ceder o lugar de forma oficial junto do clube. Isto é só a partilha do código que o dono já tem.

## Anti-objetivos (falha mesmo que funcione)

- O QR ou o número da GameBox ficarem acessíveis a quem não é o dono nem o destinatário preso.
- O link reencaminhado funcionar noutra conta.
- O empréstimo continuar válido depois do jogo.
- A V2 deixar de funcionar.

## Limites conhecidos

- Uma fotografia do ecrã com outro telemóvel nunca se consegue impedir.
- Bloqueio de capturas: expo-screen-capture no SDK 58 bloqueia capturas e gravações em iOS 13+ e no Android. Em iOS mais antigo só a gravação.
- Hoje a coleção `gamebox` tem leitura pública (regras da fase 2, por causa da V2). As regras finais (`firestore.final.rules`, passo L5 do lançamento da 7.0.0) já a fecham ao dono. O empréstimo depende dessas regras finais estarem publicadas.
- Martim aceitou (19/11, 22:03) que o empréstimo fique ativo desde o lançamento, mesmo antes de as regras finais fecharem a leitura pública das GameBox.
- Sem rede, o destinatário já com o empréstimo em cache vê o cartão; um cancelamento do dono só chega quando voltar a ter ligação (aceite).
- `/e/{id}` (links universais e intent filter) e `expo-screen-capture` precisam de um binário nativo novo: não seguem por atualização OTA.

## Abordagens consideradas

1. **Link que só abre na app (escolhida pelo Martim).** O dono gera um link; o destinatário abre-o na S360; o empréstimo prende-se à conta dele; o ecrã bloqueia capturas; expira no fim do jogo; o dono pode cancelar. Mais seguro; obriga quem recebe a ter a app e conta.
2. Link com página web de recurso. Funciona sem app, mas na web o QR fica exposto a capturas. Contraria o pedido.
3. Enviar a imagem do QR. Não expira nem se cancela. Excluída.

## Desenho (decidido)

### Fluxo do dono
1. Em GameBox (frame 45), botão "Emprestar para um jogo".
2. Confirma o jogo: só se pode emprestar para o próximo jogo em casa do recinto dessa GameBox (mesma lógica do modo bilhete: equipa 228 em casa, não terminado), porque o QR é sempre o mesmo (decisão do Martim, 19/11 20:38). Sem jogos futuros nem escolha.
3. A app cria o empréstimo no servidor e abre a folha de partilha do sistema com o link e uma frase curta, por exemplo: "Empresto-te a minha GameBox para o Sporting CP - FC Porto. Abre na app S360: <link>".
4. No detalhe da GameBox fica o estado: "Emprestada para Sporting CP - FC Porto", "Ainda não aberto" ou "Aberto às 18:42", e o botão "Cancelar empréstimo".

### Fluxo de quem recebe
1. Toca no link. Se tiver a app, abre-a (link universal no caminho `/e/{token}`, tal como `/j*` hoje). Sem app, o link reencaminha logo para a loja do telemóvel (App Store no iPhone, Play Store no Android), sem página.
2. Sem sessão: entra ou cria conta e volta ao empréstimo.
3. Primeira abertura: o empréstimo prende-se a esta conta. Outra conta que abra o mesmo link vê "Este empréstimo já foi aberto noutra conta."
4. Ecrã do empréstimo, layout do cartão do frame 30: emblemas e nomes das equipas, competição, data e hora, recinto e o bloco com porta, sector, fila, lugar e QR. O número da GameBox nunca aparece em texto, só a imagem do QR (decisão do Martim, 19/11 21:03), nem no rótulo de acessibilidade. Brilho no máximo e ecrã sempre ligado, como o modo bilhete. Capturas bloqueadas enquanto o ecrã está aberto.
5. Também aparece na lista de GameBox de quem recebe, marcada "Emprestada por {nome público}", até expirar.
6. Expirado ou cancelado: "Este empréstimo já não está ativo." sem QR.

### Validade
- Começa quando é criado.
- Expira 2 horas depois do fim do jogo, segundo o estado da API (FT, AET, PEN). Adiado ou cancelado: expira na hora marcada mais 2 horas e o dono pode criar outro.
- O servidor apaga o número do empréstimo quando expira.

### Servidor (Functions, codebase v2027)
- Coleção `loans/{loanId}`, com `loanId` aleatório de 128 bits (é o token do link).
- Campos: `ownerUid`, `gameboxId`, `matchId`, `sport`, `createdAt`, `expiresAt`, `recipientUid|null`, `openedAt|null`, `cancelledAt|null`, `seat` (porta, sector, fila, lugar) e `number` (o número da GameBox em claro, só no servidor e para o destinatário preso).
- Callables:
  - `createLoan({ gameboxId, matchId })`: o dono confirma que a GameBox é dele, decifra-se no cliente e envia-se o número por HTTPS, o servidor calcula `expiresAt` a partir do jogo. Uma GameBox tem no máximo um empréstimo ativo por jogo.
  - `claimLoan({ loanId })`: prende a conta se `recipientUid` estiver vazio e o empréstimo ativo; recusa se já estiver preso a outra conta, se for o próprio dono, expirado ou cancelado. Grava `openedAt`.
  - `cancelLoan({ loanId })`: só o dono.
- Regras: o cliente nunca escreve em `loans`. Leitura só pelo dono (sem o campo `number`, servido por outra via se preciso) e pelo destinatário preso enquanto ativo. Isto obriga a separar o número num subdocumento `loans/{id}/secret/number` lido só pelo destinatário ativo.
- Tarefa agendada que apaga `secret/number` dos empréstimos expirados.
- Sem pedidos novos à API desportiva.

### App
- Rota `(app)/emprestimo/[id].tsx` e caminho de link `/e/{id}` (associação de links do iOS e intent filter do Android). Sem app, `/e/{id}` no Hosting reescreve para uma função HTTP que responde 302 para a loja conforme o telemóvel.
- Componente do cartão partilhado com o cartão de prognóstico do frame 30 (extrair o layout comum em vez de copiar).
- `usePreventScreenCapture` só neste ecrã.
- Frames novos no Figma: botão e escolha do jogo no detalhe da GameBox, folha de partilha, estado no detalhe, ecrã do empréstimo, estados já aberto noutra conta, expirado e cancelado.

## Detalhes resolvidos na revisão do desenho (decisões minhas)

- **Validade enquanto o jogo não acaba:** `expiresAt` começa em início marcado + 4 h. Enquanto o jogo não começa, segue a hora marcada se for remarcado. Quando a API dá FT, AET ou PEN, o servidor muda para fim + 2 h. Se o jogo ficar preso num estado não final, vale o início + 4 h. Adiado sem nova data: expira na hora original + 2 h.
- **Quem atualiza:** o caminho que já trata o fim do jogo no servidor (o mesmo que fecha prognósticos e MVP) atualiza os empréstimos desse jogo. A tarefa agendada só limpa os que ficaram para trás.
- **Cancelar:** `cancelLoan` apaga logo `secret/number`. As regras verificam também `cancelledAt == null` e `expiresAt > agora` no momento da leitura, por isso a tarefa agendada não é a única barreira.
- **GameBox apagada ou conta apagada:** os empréstimos dessa GameBox ou desse dono são cancelados e o número apagado (também no `deleteAccount`). O lugar e o número ficam congelados no momento em que o empréstimo é criado.
- **Lugar no cartão:** escolhe-se pela modalidade do jogo, como o `ticketVenue` do modo bilhete. Se o lugar dessa modalidade estiver vazio, o cartão mostra só o QR e o recinto.
- **App por instalar (opção A do Martim, 19/11 20:25):** Android: o reencaminhamento para a Play Store leva `referrer=loan%3D{token}`; na primeira abertura a app lê o referrer (`expo-application` `getInstallReferrerAsync`), uma só vez, e abre o empréstimo depois de entrar. iPhone: a App Store não passa nada à app; depois de instalar e entrar, a pessoa toca outra vez no link e a app abre o empréstimo. Sem serviços externos nem correspondência por IP. Sem sessão: a app guarda o link durante a entrada e abre o empréstimo a seguir.
- **O dono abre o próprio link:** vê o estado do empréstimo (o mesmo do detalhe da GameBox).
- **Estado do dono:** lê-se dos `loans` com consulta por `ownerUid` (índice composto). Nunca se escreve nada novo nos documentos `gamebox`, para não mexer na V2. Um empréstimo cancelado pode ser substituído por outro para o mesmo jogo.
- **O que o dono vê:** "Aberto por {nome público} às 18:42". Quem recebe vê "Emprestada por {nome público}". Nunca nome completo nem email.

## Decisões minhas (para o Martim confirmar ao ler)

- Expira 2 h depois do fim do jogo, para cobrir saídas e atrasos na API.
- Enquanto a GameBox está emprestada, o modo bilhete do dono mostra "Emprestada para este jogo" em vez do QR, para não entrarem duas pessoas com o mesmo lugar. O dono pode cancelar e voltar a usá-la.
- O destinatário precisa de conta S360. É isso que permite prender o empréstimo a uma pessoa.
- O nome mostrado ao destinatário é o nome público do Ranking, nunca o nome completo nem o email.

## Como ficou construído (19/11, plano 8 fechado)

Onde este texto e as secções acima divergem, vale esta secção.

- Botão "Emprestar para o próximo jogo"; folha de confirmação com um só jogo; um empréstimo ativo no máximo por GameBox; mensagem "Esta GameBox já está emprestada."
- "Próximo jogo" igual na app e no servidor: jogos em casa do recinto (Estádio: futebol; Pavilhão: as outras), com início há menos de 4 h, em curso ou por começar.
- A validade é recalculada por uma tarefa a cada 10 minutos, que também copia a nova hora de um jogo remarcado para o cartão. Cancelado: hora marcada + 2 h.
- `createLoan` recebe o número já decifrado pela app. O servidor só valida o formato.
- Botão "Partilhar link outra vez" enquanto o empréstimo não foi aberto.
- Editar o número ou o lugar de uma GameBox emprestada cancela o empréstimo (aviso por baixo do empréstimo ativo). Mudar só o nome ou a ordem não cancela.
- Apagar a conta apaga o nome e o identificador dessa pessoa em todos os empréstimos em que entrou.
- Brilho no máximo só enquanto o cartão com o QR está no ecrã. O bloqueio de capturas cobre o ecrã todo.
- Um cancelamento ou expiração normais não vão para os relatórios de erro, e o código do empréstimo nunca entra num relatório nem nos registos da app. Os registos de pedidos da plataforma (Google) guardam o endereço `/e/{id}`: exclusão a criar no deploy.
- Android sem Play Store: a app desiste de ler o código de instalação ao fim de 3 falhas.
- Consultas aos empréstimos só por igualdade; sem índices compostos.
- Frames: 45La a 45Le, 45Lbv, 45Lbc, 45Lbe, 45Lbm, 44L, 12L, 12Lc, 50, 50b, 50c, 50d, 50e.
- Ordem do deploy e o que falha se a app sair primeiro: no plano 8, secção "Depois do plano".

## Acrescentos do plano 9 (19/11, pendentes fechados)

- Cada cancelamento grava o motivo (`cancelReason`): dono, GameBox editada, GameBox apagada, conta de quem recebeu apagada, conta do dono apagada.
- Quando quem recebeu apaga a conta, o dono vê no detalhe da GameBox "Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado.", com X para fechar (frame 45Lr).
- O documento do empréstimo e o número são apagados 7 dias depois de expirar ou de ser cancelado. Um link antigo mostra "Este empréstimo já não está ativo."
- O botão "Emprestar para o próximo jogo" já não depende do separador aberto: usa o próximo jogo em casa mais próximo entre os recintos com lugar preenchido.
- Brilho e ecrã ligado só começam quando o QR está desenhado e nunca por trás do bloqueio biométrico, no modo bilhete e no ecrã de quem recebe.
- No modo bilhete, uma GameBox emprestada nunca mostra o QR ao dono, nem enquanto os jogos carregam.
- Os erros dos gatilhos de GameBox saem para o registo só com função e código.

## Fica para quem constrói

- Formato exato do texto de partilha, dentro do tom da app.
- Como a lista de jogos lida com GameBox de modalidades sem calendário carregado.
- Testes de regras: dono, destinatário preso, outra conta, sem sessão, expirado.
- Fechar a leitura pública de `gamebox` fica fora deste trabalho e depende da saída da V2.
