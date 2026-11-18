// Task 27: termos de utilização e política de privacidade da S360 V2027. Responsável: Martim Bustorff, pessoa
// singular (decisão do Martim). Texto escrito a partir dos pontos decididos na proposta de termos e do plano 4;
// substitui o texto da V2 (QR de bilhetes, torniquetes, "voluntários" e "encriptadas de ponta a ponta" saíram).
// Região dos dados: spec §7 (Firestore eur3), ruling F15 do preflight. pt-PT, sem travessões.
// Depende do Plano 5: regras de users, gamebox, matchPredictions e mvpVotes só do dono antes de publicar.

export type TermsSection = { title: string; body: string };

/**
 * Pendentes para o Martim. Vazio: os prazos de conservação estão decididos. O Plano 5 bloqueia o build de produção
 * enquanto houver marcas por resolver em src/content (scripts/launchGate.js).
 */
export const TERMS_TODOS: readonly string[] = [];

export const TERMS: TermsSection[] = [
  {
    title: '1. ACEITAÇÃO DOS TERMOS E CONDIÇÕES',
    body: 'Ao criar conta ou utilizar a aplicação S360 (a "App"), o utilizador aceita estes Termos e Condições e a Política de Privacidade que se segue. Se não concordar, não deve utilizar a App.',
  },
  {
    title: '2. QUEM DISPONIBILIZA A APP',
    body: 'A App é desenvolvida e disponibilizada por Martim Bustorff, pessoa singular, a título pessoal e sem fins comerciais. Contacto: app.scp360@gmail.com.',
  },
  {
    title: '3. APP NÃO OFICIAL',
    body: 'A S360 é uma aplicação de adeptos, não oficial. Não tem qualquer ligação ao Sporting Clube de Portugal nem às sociedades do Clube, e não é patrocinada nem aprovada por estes. Os nomes, emblemas e marcas do Clube pertencem aos respetivos titulares e são usados apenas para identificar o Clube.',
  },
  {
    title: '4. O QUE A APP FAZ',
    body: 'A App mostra a agenda e os resultados do Sporting em várias modalidades; tem um jogo de prognósticos e de votação do MVP nos jogos de futebol, com um ranking entre utilizadores; mostra notícias de terceiros com título, imagem, resumo e ligação para o artigo na fonte original; e tem uma GameBox digital, onde o utilizador guarda o número e os lugares da sua GameBox para os ter à mão. A GameBox digital não substitui os bilhetes nem os sistemas de acesso oficiais do Clube.',
  },
  {
    title: '5. FONTES DOS DADOS DESPORTIVOS',
    body: 'Os jogos, classificações e estatísticas vêm de fornecedores externos (API-Football e API-Sports), os vídeos vêm da VSports e as notícias vêm de feeds RSS públicos de órgãos de comunicação social. Os conteúdos de terceiros mostram a fonte e a ligação para o original. A App não garante que estes dados estejam sempre completos, corretos ou atualizados.',
  },
  {
    title: '6. CONTA, CONDUTA E NOME PÚBLICO',
    body: 'O utilizador é responsável pela sua conta e pelo que faz com ela. O nome público aparece no ranking e nos cartões de partilha. Por defeito, é o primeiro nome seguido da inicial do último apelido (por exemplo, "Maria C.") e pode ser alterado no perfil. O nome público não pode ser ofensivo, enganador nem imitar outra pessoa. Um nome que viole estas regras pode ser alterado, e as contas usadas para abusos, fraude ou manipulação do jogo podem ser suspensas ou apagadas.',
  },
  {
    title: '7. PONTOS E RANKING',
    body: 'Os pontos do jogo de prognósticos e do MVP servem apenas para o ranking e não têm valor monetário. Não podem ser trocados, vendidos nem convertidos em dinheiro, prémios ou bilhetes. As regras de pontuação podem ser ajustadas e os pontos atribuídos por erro podem ser corrigidos.',
  },
  {
    title: '8. LIGAÇÕES EXTERNAS',
    body: 'A App tem ligações para sites de terceiros, como os sites do Clube, lojas e órgãos de comunicação social. Esses sites não são controlados pela App, que não é responsável pelo seu conteúdo nem pelas suas políticas de privacidade. O utilizador deve ler os termos e a política de privacidade de cada site antes de o utilizar.',
  },
  {
    title: '9. EXONERAÇÃO DE RESPONSABILIDADE',
    body: 'A App é fornecida "tal como está" e "conforme disponível", sem garantias de funcionamento contínuo ou sem erros. Na medida permitida por lei, o responsável pela App não responde por danos resultantes da sua utilização, da indisponibilidade do serviço ou de dados de terceiros incorretos. A App pode ser alterada, suspensa ou terminada a qualquer momento.',
  },
  {
    title: '10. ALTERAÇÕES AOS TERMOS',
    body: 'Estes Termos podem ser alterados. A versão em vigor é sempre a publicada na App. A utilização continuada depois de uma alteração significa a aceitação dos novos Termos.',
  },
  {
    title: '11. LEI APLICÁVEL E FORO',
    body: 'Estes Termos regem-se pela lei portuguesa. Qualquer litígio é resolvido nos tribunais portugueses, sem prejuízo dos direitos que a lei reconhece aos consumidores.',
  },
  {
    title: 'POLÍTICA DE PRIVACIDADE',
    body: '',
  },
  {
    title: '1. RESPONSÁVEL PELO TRATAMENTO',
    body: 'O responsável pelo tratamento dos dados pessoais é Martim Bustorff, pessoa singular. Para qualquer questão sobre privacidade ou para exercer os seus direitos, o utilizador pode escrever para app.scp360@gmail.com.',
  },
  {
    title: '2. DADOS QUE RECOLHEMOS',
    body: 'Conta: nome, email e método de entrada (email e password, Google ou Apple). A password é gerida pelo Firebase Authentication e a App nunca a vê. Nome público: o nome mostrado no ranking. Perfil, se o utilizador quiser preencher: número de sócio, sócio desde, lugar anual, modalidade e jogador favoritos. GameBox: nome, número e lugares; o número é guardado de forma ofuscada, para não ficar em texto simples na base de dados. Jogo: prognósticos, votos no MVP e pontos. Preferências: notificações e escolha sobre a análise de utilização. Dados técnicos: relatórios de erros (Crashlytics), com o modelo do telemóvel, a versão do sistema e a versão da App, sem identificador da conta; cada relatório usa apenas um identificador da instalação da App, que não está ligado à conta. Utilização da App (Firebase Analytics): só com consentimento, com um identificador da instância da App que, com consentimento, fica associado ao identificador interno da conta.',
  },
  {
    title: '3. FINALIDADES E FUNDAMENTOS',
    body: 'Os dados da conta, do perfil, da GameBox e do jogo são tratados para prestar o serviço pedido pelo utilizador (execução do contrato, artigo 6.º, n.º 1, alínea b) do RGPD). Os relatórios de erros servem para manter a App segura e a funcionar (interesse legítimo, artigo 6.º, n.º 1, alínea f) do RGPD). A análise de utilização serve para perceber como a App é usada e melhorá-la, e só acontece com o consentimento do utilizador.',
  },
  {
    title: '4. O QUE É PÚBLICO',
    body: 'Os outros utilizadores veem apenas o nome público, o avatar, os pontos e a posição no ranking. O email nunca é mostrado a outros utilizadores. Os restantes dados do perfil e a GameBox só podem ser lidos pelo próprio utilizador.',
  },
  {
    title: '5. ANÁLISE DE UTILIZAÇÃO',
    body: 'O Firebase Analytics fica desligado até o utilizador aceitar. Com consentimento, a conta é identificada apenas pelo identificador interno, nunca pelo email nem pelo nome, e o Analytics usa ainda o identificador da instância da App. O consentimento pode ser retirado a qualquer momento nas Definições, em "Análise de utilização".',
  },
  {
    title: '6. SUBCONTRATANTES E PARTILHA',
    body: 'A App usa a Google, através do Firebase (Authentication, Firestore, Cloud Functions, Analytics e Crashlytics), como subcontratante para guardar e tratar os dados. Quando o utilizador escolhe entrar com a Apple ou com a Google, esse serviço trata os dados de início de sessão. Os fornecedores de dados desportivos, de notícias e de vídeo não recebem dados da conta; quando as imagens das notícias e o leitor da VSports carregam, recebem dados técnicos, como o endereço IP, tal como acontece com qualquer site. Não vendemos dados pessoais nem os partilhamos para publicidade.',
  },
  {
    title: '7. ONDE FICAM OS DADOS',
    body: 'Os dados da conta e da App ficam guardados na União Europeia (Firestore multirregião eur3). Alguns serviços da Google, como o Firebase Authentication, o Analytics e o Crashlytics, podem tratar dados fora da União Europeia, com as garantias previstas no RGPD, como as cláusulas contratuais-tipo.',
  },
  {
    title: '8. CONSERVAÇÃO',
    body: 'Conta, perfil, GameBox e dados do jogo (prognósticos, votos e pontos): enquanto a conta existir; são apagados com "Apagar conta". Relatórios de erros (Crashlytics): 90 dias. Estatísticas de utilização (Firebase Analytics, só com consentimento): 2 meses. Cópias de segurança: 30 dias.',
  },
  {
    title: '9. APAGAR CONTA',
    body: 'O utilizador pode apagar a conta a qualquer momento nas Definições, em "Apagar conta". Isto remove a conta e os dados pessoais associados, incluindo o perfil, a GameBox, os prognósticos, os votos e a presença no ranking.',
  },
  {
    title: '10. OS SEUS DIREITOS',
    body: 'Nos termos do RGPD, o utilizador tem direito de acesso, retificação (pode editar o perfil na App), apagamento (com "Apagar conta"), limitação, portabilidade e oposição, e pode retirar o consentimento da análise de utilização nas Definições. Para exercer estes direitos, basta escrever para app.scp360@gmail.com. Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), em www.cnpd.pt.',
  },
  {
    title: '11. ALTERAÇÕES A ESTA POLÍTICA',
    body: 'Esta Política pode ser atualizada para refletir alterações na App ou na lei. A versão em vigor é sempre a publicada na App.',
  },
];
