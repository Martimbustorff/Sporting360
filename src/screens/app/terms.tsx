import React from "react";
import { Platform, SafeAreaView, Text } from "react-native";
import Header from "../../components/Header";
import { ScrollView } from "react-native-gesture-handler";

const Terms = () => {
  return (
    <SafeAreaView className="bg-bgauth flex-1 justify-center items-center">
      <Header title="TERMOS E SERVIÇOS"></Header>
      <ScrollView className={`flex-1 pl-4 pr-4 mb-10`}>
      <Text className="text-white_gray font-dinBold leading-10  text-md">
        1. ACEITAÇÃO DOS TERMOS E CONDIÇÕES
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Ao descarregar ou utilizar a Aplicação S360, o utilizador concorda em ficar vinculado aos
        termos e disposições do presente Acordo. Se não concordar, não deve utilizar a Aplicação
        S360
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        2. DIREITOS DE PROPRIEDADE INTELECTUAL
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      A Aplicação S360 e todo
        o seu conteúdo, incluindo o design, o texto e os gráficos, estão
        protegidos por direitos de propriedade intelectual. Estes direitos pertencem aos voluntários que
        desenvolveram a aplicação
        -
        Martim, José, João, Felipe e Pedro.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        3. UTILIZAÇÃO DA APLICAÇÃO
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
              A
        aplicação S360 é fornecida para uso não comercial. A aplicação permite aos utilizadores
        digitalizar o QR code do Bilhete de época ou de Bilhetes Individuais, aceder por via de
        reencaminhamento para os websites do Clube e oferece outras funcionalidades d
        escritas na
        aplicação. A equipa do S360 não se responsabiliza por qualquer falha no mau funcionamento
        dos torniquetes do Estádio de Alvalade. Somos uma app não oficial e não temos
        responsabilidade sobre os sistemas informáticos do Clube.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        4. HIPERLIGAÇÕES
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
              A aplicação S360 pode conter links para websites operados pelo Clube. No entanto, a equipa
        do S360 não tem qualquer controlo sobre esses sites e não é responsável pelo seu conteúdo
        ou política de privacidade. O utilizador deve ler os termos de utili
        zação e a política de
        privacidade desses sites antes de os utilizar. A nossa intenção é reencaminhar via mobile os
        utilizadores para os serviços do Clube, para desta forma ajudar a aumentar o tráfego online e
        aumento de receitas em favor do Clube.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        5. DADOS DO UTILIZADOR
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Quando se regista na aplicação, é apenas requerido que o utilizador forneça o seu nome,
endereço de correio eletrónico e defina uma password de acesso. Adicionalmente e de livre e
espontânea vontade, pode também fornecer a data de quando s
e iniciou como sócio, data de
nascimento, sexo e digitalizar ou introduzir manualmente o número do seu bilhete de época ou
bilhete individual. Estes dados serão utilizados exclusivamente para a gestão da conta de
utilizador e não para qualquer outro fim se
m o consentimento expresso do utilizador. Os
utilizadores podem a qualquer momento apagar a conta, bastando para isso ir à sua conta e
clicar em "Apagar Conta".
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        6. PRIVACIDADE E SEGURANÇA DOS DADOS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      A aplicação S360 utiliza o Firestore da Firebase para
armazenar e gerir os dados do utilizador.
As informações são encriptadas de ponta a ponta e implementámos regras adicionais no
Firestore para garantir a máxima segurança dos dados. Além disso, as informações do bilhete
de época e/ou bilhetes individuais sã
o encriptadas antes de serem enviadas para o Firestore,
utilizando uma chave única gerada a partir dos dados do utilizador. Este nível garante um
elevadíssimo grau de segurança, no caso de alguém tentar o acesso não autorizado às
informações, garantindo as
sim a privacidade e a segurança dos dados do utilizador.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        7. EXONERAÇÃO DE RESPONSABILIDADE
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      A aplicação S360 é fornecida "tal como está" e "conforme disponível". Os criadores não dão
quaisquer garantias ou declarações relativamente à aplicação ou ao seu
conteúdo
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        8. TERMINAÇÃO
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        A equipa do S360 reserva-se o direito de terminar a aplicação em qualquer altura. Em caso de rescisão, a equipa do S360 eliminará todos os dados do utilizador.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        9. CONTACTO
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        Os utilizadores podem enviar quaisquer questões relativas a estes Termos e Condições para app.scp360@gmail.com.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        10. ALTERAÇÕES AOS TERMOS E CONDIÇÕES
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        A equipa da S360 reserva-se o direito de alterar estes Termos e Condições em qualquer altura. As alterações entrarão em vigor imediatamente após a sua publicação na aplicação. A utilização continuada da aplicação após tais modificações constituirá a aceitação dos novos Termos e Condições.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        11. LEI APLICÁVEL E JURISDIÇÃO
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        Estes Termos e Condições serão regidos e interpretados de acordo com as leis de Portugal. Como condição para a sua utilização da Aplicação S360, concorda em submeter-se à jurisdição dos tribunais de Portugal relativamente a qualquer litígio resultante destes Termos e Condições ou da sua utilização da Aplicação S360.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        12. SEVERABILIDADE
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        Se qualquer disposição destes Termos e Condições for considerada inválida ou inexequível por um tribunal de jurisdição competente, as restantes disposições manter-se-ão em pleno vigor e efeito.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        13. ACORDO INTEGRAL
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        Estes Termos e Condições, a Política de Privacidade e quaisquer alterações e quaisquer acordos adicionais que possa celebrar com a equipa do S360 em relação à aplicação constituem a totalidade do Acordo entre si e a equipa do S360 relativamente à aplicação.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        14. RENÚNCIA
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        Nenhuma renúncia a qualquer termo destes Termos e Condições será considerada uma renúncia adicional ou contínua a esse termo ou a qualquer outro termo, e a falha da equipa do S360 em fazer valer qualquer direito ou disposição ao abrigo destes Termos e Condições não constituirá uma renúncia a esse direito ou disposição.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        POLÍTICA DE PRIVACIDADE DA APLICAÇÃO S360
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
         1. INFORMAÇÕES PESSOAIS QUE RECOLHEMOS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Quando se regista na aplicação, é apenas requerido que o utilizador forneça o se
          u nome,
          endereço de correio eletrónico e defina uma password de acesso. Adicionalmente e de livre e
          espontânea vontade, pode também fornecer a data de quando se iniciou como sócio, data de
          nascimento, sexo e digitalizar ou introduzir manualmente o número d
          o seu bilhete de época ou
          bilhete individual. Estes dados serão utilizados exclusivamente para a gestão da conta de
          utilizador e não para qualquer outro fim sem o consentimento expresso do utilizador. Os
          utilizadores podem a qualquer momento apagar a conta
          , bastando para isso ir à sua conta e
          clicar em "Apagar Conta".
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        2. COMO UTILIZAMOS AS SUAS INFORMAÇÕES PESSOAIS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Utilizamos as informações que recolhemos do utilizador para: 2.1. Fornecer a Aplicação S360
e as suas funcionalidades. 2.2. Gerir a sua cont
a de utilizador. 2.3. Melhorar a aplicação S360
e desenvolver novas funcionalidades. Não utilizamos os seus dados pessoais para qualquer
outro fim sem o seu consentimento expresso. A aplicação S360 não tem fins comerciais
comercial
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        3. PARTILHA DOS SEUS DADOS PESSOAIS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Não partilhamos as suas informações pessoais com terceiros, exceto quando necessário para
      fornecer a Aplicação S360 e os seus serviços, incluindo a partilha de informações com o
      Firestore da Firebase, que utilizamos para armazenar e ge
      rir os dados do utilizador.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        4. SEGURANÇA DOS DADOS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Levamos a sério a segurança das suas informações pessoais. Utilizamos o Firebase's Firestore
        para armazenar e gerir os dados dos utilizadores. As informações são encriptadas de ponta a
        ponta e implementá
        mos regras adicionais no Firestore para garantir que apenas o proprietário
        dos dados os pode visualizar. Além disso, as informações dos QR codes são encriptadas antes
        de serem enviadas para o Firestore, utilizando uma chave única gerada a partir dos dados
        do
        utilizador.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        5. OS SEUS DIREITOS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      O utilizador tem o direito de aceder às informações pessoais que possuímos sobre si e de
solicitar a correção, atualização ou eliminação das suas informações pessoais. Se pretender
exercer este direito, basta editar os
seus dados na sua conta, ou solicitar a eliminação na conta
carregando no botão "Apagar Conta".
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        6. ALTERAÇÕES A ESTA POLÍTICA DE PRIVACIDADE
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
        PPodemos atualizar ocasionalmente esta política de privacidade para refletir, por exemplo,
alterações às nossas práticas ou por outras razões operacionais, legais ou regulamentares,
sempre respeitan
d
o
aos princ
ípios mais básicos
da privacidade dos dados.
      </Text>

      <Text className="text-white_gray font-dinBold leading-10  text-md">
        7. CONTACTE-NOS
      </Text>
      <Text className="text-white_gray font-dinRegular text-md mb-3">
      Para obter mais informações sobre as nossas práticas de privacidade, se tiver dúvidas ou quiser
apresentar uma reclamação, contacte
-
nos por e
-
mail para
app.scp360@gmail.com.
Ao utilizar
a Aplicação S360, o utilizador concorda com os termos
desta Política de Privacidade. Não
deve utilizar a Aplicação S360 se não concordar com estes termos.
      </Text>

      </ScrollView>
    </SafeAreaView>
  );
};

export default Terms;
