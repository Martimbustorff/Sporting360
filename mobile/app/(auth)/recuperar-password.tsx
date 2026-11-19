// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4941:7389 (16 Recuperar password). Texto Body Light a 70 %, campo,
// mensagem em caixa (surface-06) e "Enviar" em Branco em baixo. Erro de validação por baixo do campo.
import { useRef, useState } from 'react';
import { AuthScaffold, NoticeBox } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { sendReset } from '@/services/auth';
import { Text71 } from '@/theme/typography';
import { layout } from '@/theme/tokens';

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
      title="Recuperar Password"
      contentTop={layout.authIntroTop}
      fieldsGap={layout.authIntroGap}
      footer={<PrimaryButton label="Enviar" variant="white" onPress={() => void submit()} loading={loading} />}
    >
      <Text71 variant="bodyLight14" color="textMuted">
        Indica o email da tua conta. Enviamos um link para criares uma password nova.
      </Text71>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldError ?? error ?? undefined}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      {sent ? <NoticeBox text={SENT} /> : null}
    </AuthScaffold>
  );
}
