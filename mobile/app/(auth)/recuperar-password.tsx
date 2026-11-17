// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:6956 (05_Lost Pass, "Recuperar Pass").
import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { sendReset } from '@/services/auth';
import { layout, type } from '@/theme/tokens';

// R18: sucesso e email inexistente dão a mesma mensagem.
const SENT = 'Se existir uma conta com este email, vais receber um link para mudar a password.';

function codeOf(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

export default function RecuperarPassword() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  // Guarda síncrona contra toques duplos (o estado `loading` só desativa o botão no próximo render).
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    const normalized = email.trim().toLowerCase();
    setError(null);
    setSent(false);
    if (!normalized) {
      setFieldError('Indica o teu email.');
      return;
    }
    setFieldError(undefined);
    busy.current = true;
    setLoading(true);
    try {
      await sendReset(normalized);
      setSent(true);
    } catch (e) {
      if (codeOf(e) === 'auth/user-not-found') setSent(true);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Recuperar Pass"
      contentTop={layout.authIntroTop}
      bottom={layout.authRecoverBottom}
      footer={
        <>
          {error ? <FormMessage text={error} /> : null}
          {sent ? <FormMessage text={SENT} tone="info" /> : null}
          <PrimaryButton label="Enviar" onPress={() => void submit()} loading={loading} />
        </>
      }
    >
      <Text style={type.authIntro}>Indica o teu email para receberes uma nova password.</Text>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
    </AuthScaffold>
  );
}
