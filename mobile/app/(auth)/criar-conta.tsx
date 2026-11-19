// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4940:7380 (15 Criar conta). "Criar conta" em Branco, Google e Apple por baixo;
// o texto dos termos é todo uma ligação. O erro geral aparece por baixo do campo da password.
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthScaffold } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SocialButtons } from '@/components/SocialButtons';
import { Touchable } from '@/components/Touchable';
import { TextField } from '@/components/TextField';
import { MIN_PASSWORD_LENGTH } from '@/services/account';
import { signUpEmail } from '@/services/auth';
import { Text71 } from '@/theme/typography';

export default function CriarConta() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Guarda síncrona contra toques duplos (o estado `loading` só desativa o botão no próximo render).
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    const normalized = email.trim().toLowerCase();
    setError(null);
    if (!name.trim()) {
      setNameError('Indica o teu nome.');
      return;
    }
    setNameError(undefined);
    if (!normalized || !password) {
      setError('Indica o email e a password.');
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      // Sucesso: a sessão passa a signedIn e a guarda de (auth) leva para a app.
      await signUpEmail(name, normalized, password);
    } catch (e) {
      // R18: o registo pode dizer que o email já tem conta.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Nova Conta"
      footer={
        <>
          <PrimaryButton label="Criar conta" variant="white" onPress={() => void submit()} loading={loading} />
          <SocialButtons />
          {/* Figma 4940:7461: o texto inteiro é a ligação para os termos. */}
          <Touchable
            accessibilityRole="link"
            accessibilityLabel="Termos e condições"
            accessibilityHint="Abre os termos e condições"
            onPress={() => router.push('/termos')}
            style={{ alignSelf: 'center' }}
          >
            <Text71 variant="caption12" color="textMuted" style={{ textAlign: 'center' }}>
              {'Ao clicar em criar conta aceita os nossos '}
              <Text71 variant="captionStrong12" color="primaryOnDark">
                Termos e condições
              </Text71>
            </Text71>
          </Touchable>
        </>
      }
    >
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        error={nameError}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        error={error ?? undefined}
        helper={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
        autoComplete="new-password"
        textContentType="newPassword"
      />
    </AuthScaffold>
  );
}
