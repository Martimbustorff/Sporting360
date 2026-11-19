// Figma V7.1: nó 4941:7604 (20 Mudar password): campos "Password atual" e "Nova password" com o olho, a 32 entre si, e
// "Guardar" em Branco logo por baixo (a 32). SEM FIGMA: as mensagens e a conta sem password.
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useSession } from '@/providers/SessionProvider';
import { CHANGE_PASSWORD_TEXT, MIN_PASSWORD_LENGTH, changePassword } from '@/services/account';
import { layout, space } from '@/theme/tokens';

export const PASSWORD_TEXT = {
  tooShort: CHANGE_PASSWORD_TEXT.tooShort,
  done: 'Password alterada.',
  noPassword: 'Esta conta entra sem password (Google ou Apple).',
  generic: 'Algo correu mal. Tenta outra vez.',
} as const;

type Message = { text: string; tone: 'error' | 'info' };

export default function Password() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const hasPassword = session.status === 'signedIn' && session.user.providers.includes('password');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    if (next.length < MIN_PASSWORD_LENGTH) {
      setMessage({ text: PASSWORD_TEXT.tooShort, tone: 'error' });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setMessage({ text: PASSWORD_TEXT.done, tone: 'info' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : PASSWORD_TEXT.generic, tone: 'error' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen padded="none">
      <Header title="Mudar password" onBack={back} />
      {!hasPassword ? (
        <EmptyState icon="info" text={PASSWORD_TEXT.noPassword} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: layout.authContentTop }}
        >
          <View style={{ gap: layout.settingsFormGap }}>
            <TextField
              label="Password atual"
              value={current}
              onChangeText={setCurrent}
              secure
              autoComplete="current-password"
              textContentType="password"
            />
            <TextField
              label="Nova password"
              value={next}
              onChangeText={setNext}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>
          <View style={{ marginTop: layout.settingsFormGap, gap: space.s16 }}>
            {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
            <PrimaryButton
              label="Guardar"
              variant="white"
              onPress={() => void submit()}
              loading={busy}
              disabled={current.length === 0 || next.length === 0}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
