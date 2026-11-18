# Respostas de privacidade para as lojas

Derivadas dos Termos e da Política de Privacidade (`mobile/src/content/termos.ts`). Se o texto dos Termos mudar, estas respostas mudam com ele.

Base legal de cada tratamento: execução do contrato (conta, perfil, GameBox, jogo), interesse legítimo (relatórios de erros) e consentimento (análise de utilização).

## App Store Connect: App Privacy

Rastreio: não. Publicidade: não. Venda de dados: não. Nenhum dado é usado para seguir o utilizador entre apps ou sites de outras empresas.

| Categoria Apple | Tipo de dado | Ligado ao utilizador | Finalidade | Notas |
|---|---|---|---|---|
| Informações de contacto | Nome | Sim | Funcionalidade da app | Nome da conta e nome público do ranking |
| Informações de contacto | Endereço de email | Sim | Funcionalidade da app | Nunca mostrado a outros utilizadores |
| Identificadores | ID do utilizador | Sim | Funcionalidade da app e Análise | Para a Análise, só com consentimento (ver abaixo) |
| Identificadores | ID do dispositivo (identificador da instalação do Crashlytics) | Não | Funcionalidade da app (diagnóstico) | Sem consentimento; não ligado ao utilizador; não usado para rastreio |
| Identificadores | ID do dispositivo (identificador da instância da app do Firebase Analytics) | Sim | Análise | Só com consentimento; associado ao ID do utilizador |
| Conteúdo do utilizador | Outro conteúdo do utilizador | Sim | Funcionalidade da app | Prognósticos, votos no MVP, pontos, número e lugares da GameBox, campos opcionais do perfil (número de sócio, sócio desde, lugar anual, favoritos) |
| Dados de utilização | Interação com o produto | Sim | Análise | Opcional: só com consentimento, desligado por omissão |
| Diagnóstico | Dados de falhas | Não | Funcionalidade da app | Crashlytics, sem identificador da conta; interesse legítimo |
| Diagnóstico | Outros dados de diagnóstico | Não | Funcionalidade da app | Modelo do telemóvel, versão do sistema e da app; interesse legítimo |

Análise de utilização (Firebase Analytics): só com consentimento. Com consentimento, a conta é identificada apenas pelo identificador interno, nunca pelo email nem pelo nome, e o Analytics usa ainda o identificador da instância da app. Sem consentimento, a recolha fica desligada.

Diagnóstico (Crashlytics): não ligado ao utilizador. O Crashlytics nunca recebe o identificador da conta.

Dados cifrados em trânsito: sim.

Firebase App Check (App Attest no iOS, Play Integrity no Android): verifica que os pedidos vêm da app autêntica. Segundo a documentação do Firebase, o App Check não guarda o material de atestação e não acrescenta um identificador do utilizador, por isso não leva linha própria nas tabelas.

Fontes consultadas (Firebase e Google Analytics, na data deste ficheiro): https://firebase.google.com/docs/ios/app-store-data-collection, https://support.google.com/analytics/answer/10285841 (Apple), https://support.google.com/analytics/answer/11582702 (Play), https://firebase.google.com/support/privacy.

Eliminação de dados: o utilizador apaga a conta na app (Definições, Apagar conta) e também pela página web.

## Google Play: Segurança dos dados

Recolha de dados: sim. Partilha de dados com terceiros: não (a Google, através do Firebase, atua como subcontratante). Dados cifrados em trânsito: sim. O utilizador pode pedir a eliminação dos dados: sim.

| Categoria Play | Tipo de dado | Recolhido | Partilhado | Obrigatório ou opcional | Finalidade |
|---|---|---|---|---|---|
| Informações pessoais | Nome | Sim | Não | Obrigatório | Funcionalidade da app, gestão de contas |
| Informações pessoais | Endereço de email | Sim | Não | Obrigatório | Funcionalidade da app, gestão de contas |
| Informações pessoais | IDs de utilizador | Sim | Não | Obrigatório | Funcionalidade da app, gestão de contas; Análise só com consentimento |
| Identificadores do dispositivo ou outros | ID da instalação do Crashlytics | Sim | Não | Obrigatório | Funcionalidade da app (diagnóstico); não ligado ao utilizador |
| Identificadores do dispositivo ou outros | ID da instância da app do Firebase Analytics | Sim | Não | Opcional (só com consentimento) | Análise; associado ao ID do utilizador |
| Atividade na app | Interações com a app | Sim | Não | Opcional (só com consentimento) | Análise |
| Atividade na app | Outro conteúdo gerado pelo utilizador | Sim | Não | Obrigatório | Funcionalidade da app (prognósticos, votos no MVP, GameBox, perfil) |
| Informações e desempenho da app | Registos de falhas | Sim | Não | Obrigatório | Funcionalidade da app; sem identificador da conta |
| Informações e desempenho da app | Diagnósticos | Sim | Não | Obrigatório | Funcionalidade da app; sem identificador da conta |

URL para pedir a eliminação da conta e dos dados: https://s360-prognostico-download.web.app/apagar-conta

URL da política de privacidade: https://s360-prognostico-download.web.app/privacidade

## Conservação

| Dados | Prazo |
|---|---|
| Conta, perfil, GameBox e dados do jogo (prognósticos, votos e pontos) | enquanto a conta existir; apagados com "Apagar conta" |
| Relatórios de erros (Crashlytics) | 90 dias |
| Estatísticas de utilização (Firebase Analytics, só com consentimento) | 2 meses |
| Cópias de segurança | 30 dias |
