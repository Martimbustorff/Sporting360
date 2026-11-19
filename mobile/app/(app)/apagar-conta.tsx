// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nós 4941:7664 (21 Apagar conta) e 4941:7718 (21b Confirmar password).
// Compõe AuthScaffold (Header + rodapé acima do teclado), TextField, PrimaryButton e a ModalSheet escura.
// "Apagar conta" é o botão Branco (texto primary sobre branco, contraste 4,8:1), nunca encarnado (decisão do Martim).
// Task 16: apaga a conta (App Store: apagar dentro da app + revogar o token Apple, R9 em services/account.ts).
// Confirmação: escrever APAGAR exatamente (maiúsculas, sem aparar espaços). R17: depois de apagar a sessão termina
// e a guarda de (app) leva ao Welcome com "Conta apagada.".
// 21b: em contas que entram só com password, a folha "Confirma a tua password" aparece SEMPRE antes de apagar (antes só
// aparecia se o servidor pedisse login recente). Google e Apple (e contas com os dois) mantêm a reautenticação de sempre.
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { deleteMyAccount, providerReauth, reauthenticateWithPassword, type ReauthOutcome } from '@/services/account';
import { signOut } from '@/services/auth';
import { authInstance } from '@/services/firebase';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { layout } from '@/theme/tokens';

const CONFIRM_WORD = 'APAGAR';

/** Textos da folha 21b (aprovados pelo Martim, 19/11). */
export const APAGAR_TEXT = {
  sheetTitle: 'Confirma a tua password',
  sheetBody: 'Por segurança, indica a password antes de apagarmos a conta.',
} as const;

export default function ApagarConta() {
  const router = useRouter();
  const session = useSession();
  const providers = session.status === 'signedIn' ? session.user.providers : [];
  // Só password (sem Google nem Apple): a folha da password abre sempre antes de apagar. Lê session.user.providers (o que o
  // ecrã já tem); o serviço lê providerData do utilizador do Firebase. Se divergirem, o pior caso é aparecer uma folha a mais
  // (nunca uma a menos: o serviço continua a reautenticar pelo seu lado).
  const passwordOnly = providers.includes('password') && !providers.includes('google.com') && !providers.includes('apple.com');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  // Folha da password: a promessa do reauth fica pendente até "Confirmar" (com sucesso) ou "Cancelar".
  const pending = useRef<((r: ReauthOutcome) => void) | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const askPassword = () =>
    new Promise<ReauthOutcome>((resolve) => {
      pending.current = resolve;
      setSheetOpen(true);
    });
  const finishSheet = (r: ReauthOutcome) => {
    setSheetOpen(false);
    const resolve = pending.current;
    pending.current = null;
    resolve?.(r);
  };

  const enabled = confirm === CONFIRM_WORD;

  const submit = async () => {
    if (busy.current || !enabled) return;
    busy.current = true;
    setError(null);
    setLoading(true);
    try {
      if (passwordOnly && (await askPassword()) === 'cancelled') {
        // Sem password confirmada não se apaga nada: cancelar volta ao ecrã tal como estava.
        busy.current = false;
        setLoading(false);
        return;
      }
      const r = await deleteMyAccount(providerReauth(askPassword));
      // 'deleted' com a sessão terminada: a guarda de (app) já está a sair deste ecrã; não mexer no estado.
      // currentUser é a fonte síncrona (o estado React da sessão só muda no próximo render).
      if (r === 'deleted' && !authInstance().currentUser) return;
      if (r === 'deleted') {
        // O signOut dentro de deleteMyAccount falhou: mais uma tentativa e Welcome com o aviso na mesma.
        try {
          await signOut();
        } catch {
          // a conta já não existe; o próximo refresh do token termina a sessão
        }
        router.replace('/welcome?aviso=conta-apagada');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    busy.current = false;
    setLoading(false);
  };

  return (
    <>
      <AuthScaffold
        title="Apagar conta"
        fallbackHref="/"
        contentTop={layout.authIntroTop}
        fieldsGap={layout.authStackGap}
        footer={
          <>
            {error ? <FormMessage text={error} /> : null}
            <PrimaryButton label="Apagar conta" variant="white" onPress={() => void submit()} loading={loading} disabled={!enabled} />
          </>
        }
      >
        <Text71 variant="bodyLight14">
          Ao apagar a conta, apagamos o teu perfil, GameBox, prognósticos, votos e pontos. Não é possível recuperá-los.
        </Text71>
        <Text71 variant="bodyLight14">{`Para confirmar, escreve ${CONFIRM_WORD}.`}</Text71>
        <TextField
          label={`Escreve ${CONFIRM_WORD}`}
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            setError(null);
          }}
          autoCapitalize="characters"
        />
      </AuthScaffold>
      {sheetOpen ? <PasswordSheet onDone={finishSheet} /> : null}
    </>
  );
}

function PasswordSheet({ onDone }: { onDone: (r: ReauthOutcome) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  const confirm = async () => {
    if (busy.current || !password) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      await reauthenticateWithPassword(password);
      onDone('ok');
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    busy.current = false;
    setLoading(false);
  };

  return (
    <ModalSheet gap="loose" onClose={() => onDone('cancelled')}>
      <Text71 variant="titleS20" accessibilityRole="header">
        {APAGAR_TEXT.sheetTitle}
      </Text71>
      <Text71 variant="bodyLight14" color="textMuted">
        {APAGAR_TEXT.sheetBody}
      </Text71>
      <TextField
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        secure
        error={error ?? undefined}
        autoComplete="current-password"
        textContentType="password"
      />
      <PrimaryButton label="Confirmar" variant="white" onPress={() => void confirm()} loading={loading} disabled={!password} />
      <PrimaryButton label="Cancelar" variant="outline" onPress={() => onDone('cancelled')} />
    </ModalSheet>
  );
}
