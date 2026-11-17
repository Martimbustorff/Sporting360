// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:6926 (05_SignUp, "Nova Conta").
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { signUpEmail } from '@/services/auth';
import { layout, type } from '@/theme/tokens';

export default function CriarConta() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
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
    setLoading(true);
    try {
      // Sucesso: a sessão passa a signedIn e a guarda de (auth) leva para a app.
      await signUpEmail(name, normalized, password);
    } catch (e) {
      // R18: o registo pode dizer que o email já tem conta.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Nova Conta"
      footer={
        <>
          {error ? <FormMessage text={error} /> : null}
          <PrimaryButton label="Criar conta" onPress={() => void submit()} loading={loading} />
          {/* Figma 564:6929: o texto inteiro é a ligação para os termos. */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Termos e condições"
            onPress={() => router.push('/termos')}
            style={{ alignSelf: 'center', width: layout.authNoteWidth }}
          >
            <Text style={type.authNote}>
              <Text style={{ opacity: layout.authMutedOpacity }}>Ao clicar em criar conta aceita os nossos </Text>
              <Text style={type.authLinkAction}>Termos e condições</Text>
            </Text>
          </Pressable>
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
    </AuthScaffold>
  );
}
