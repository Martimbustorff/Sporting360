// SEM FIGMA: ecrã e folha da password não desenhados. Compõe AuthScaffold (Header + rodapé acima do teclado),
// TextField, PrimaryButton e FormMessage; a folha segue o modal "Ativar Face ID?" do BiometricGate (tokens).
// Não há token de cor "destrutivo": o botão é o PrimaryButton normal (a validar pelo Martim).
// Task 16: apaga a conta (App Store: apagar dentro da app + revogar o token Apple, R9 em services/account.ts).
// Confirmação: escrever APAGAR exatamente (maiúsculas, sem aparar espaços). R17: depois de apagar a sessão termina
// e a guarda de (app) leva ao Welcome com "Conta apagada.".
import { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { deleteMyAccount, providerReauth, reauthenticateWithPassword, type ReauthOutcome } from '@/services/account';
import { signOut } from '@/services/auth';
import { authInstance } from '@/services/firebase';
import { colors, layout, radius, type } from '@/theme/tokens';

const CONFIRM_WORD = 'APAGAR';

export default function ApagarConta() {
  const router = useRouter();
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
        footer={
          <>
            {error ? <FormMessage text={error} /> : null}
            <PrimaryButton label="Apagar conta" onPress={() => void submit()} loading={loading} disabled={!enabled} />
          </>
        }
      >
        <Text style={type.authIntro}>
          Ao apagar a conta, apagamos o teu perfil, GameBox, prognósticos, votos e pontos. Não é possível recuperá-los.
        </Text>
        <Text style={type.authIntro}>{`Para confirmar, escreve ${CONFIRM_WORD}.`}</Text>
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
  const { bottom } = useSafeAreaInsets();
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
    <Modal transparent animationType="fade" visible onRequestClose={() => onDone('cancelled')}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: layout.lockScrim }}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            padding: layout.lockModalPad,
            paddingBottom: Math.max(bottom, layout.homeIndicator) + layout.lockBottom,
            gap: layout.lockModalGap,
          }}
        >
          <Text style={type.screenTitle} accessibilityRole="header">
            Confirma a password
          </Text>
          <Text style={type.authIntro}>Por segurança, escreve a tua password para apagar a conta.</Text>
          <TextField
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            secure
            autoComplete="current-password"
            textContentType="password"
          />
          {error ? <FormMessage text={error} /> : null}
          <PrimaryButton label="Confirmar" onPress={() => void confirm()} loading={loading} disabled={!password} />
          <PrimaryButton label="Cancelar" variant="secondary" onPress={() => onDone('cancelled')} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
