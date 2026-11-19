// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4940:7302 (14 Entrar). "Entrar" em Branco, Google e Apple por baixo,
// ligações Caption 12. O erro aparece por baixo do campo da password (Caption 12, danger), como na nota do frame.
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AUTH_LINK_ROWS_GAP, AuthLinkRow, AuthScaffold } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SocialButtons } from '@/components/SocialButtons';
import { TextField } from '@/components/TextField';
import { signInEmail } from '@/services/auth';

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Guarda síncrona contra toques duplos (o estado `loading` só desativa o botão no próximo render).
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      setError('Indica o email e a password.');
      return;
    }
    setError(null);
    busy.current = true;
    setLoading(true);
    try {
      // Sucesso: a sessão passa a signedIn e a guarda de (auth) leva para a app.
      await signInEmail(normalized, password);
    } catch (e) {
      // R18: a mensagem nunca revela se o email existe (authErrors junta os três códigos).
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Acesso"
      footer={
        <>
          <PrimaryButton label="Entrar" variant="white" onPress={() => void submit()} loading={loading} />
          <SocialButtons />
          <View style={{ gap: AUTH_LINK_ROWS_GAP }}>
            <AuthLinkRow
              text="Esqueceste-te da password?"
              action="Recupera-a"
              onPress={() => router.push('/recuperar-password')}
            />
            <AuthLinkRow text="Novo utilizador?" action="Cria uma conta" onPress={() => router.push('/criar-conta')} />
          </View>
        </>
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        error={error ?? undefined}
        autoComplete="current-password"
        textContentType="password"
      />
    </AuthScaffold>
  );
}
