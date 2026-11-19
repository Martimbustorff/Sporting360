// Figma V7.1 24 Nome público (4942:7843): texto Body Light 70 % (copy aprovada), campo "Novo nome" e botão Branco logo
// por baixo (AuthScaffold com `footerInline`, espaço de 20). Mantém o bloco "Nome atual" (não está no frame).
// Task 16: mostra o nome público atual (ou o automático "Sportinguista #<fim do uid>") e grava um novo pela
// callable updateProfile. A validação é a do servidor (displayName.ts reexporta a cópia de functions).
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { usePublicProfile } from '@/data/hooks';
import { displayNameErrorMessage, displayNameMessage, validateDisplayName } from '@/lib/displayName';
import { publicName } from '@/lib/publicName';
import { useSession } from '@/providers/SessionProvider';
import { updateDisplayName } from '@/services/profile';
import { Text71 } from '@/theme/typography';
import { layout, space } from '@/theme/tokens';

export const NOME_HELPER = 'É o nome que aparece no Ranking. O nome completo e o email nunca aparecem.';

type Message = { text: string; tone: 'error' | 'info' };

export default function Nome() {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const profile = usePublicProfile(uid);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  const current =
    saved ??
    (profile.status === 'ready'
      ? profile.data.displayName
      : profile.status === 'loading' || !uid
        ? ''
        : publicName({}, uid));

  const check = validateDisplayName(name);
  const fieldError = name.length > 0 && !check.ok ? displayNameMessage(check.error) : undefined;

  const submit = async () => {
    if (busy.current || !check.ok) return;
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      const stored = await updateDisplayName(check.value);
      setSaved(stored);
      setName('');
      setMessage({ text: 'Nome guardado.', tone: 'info' });
    } catch (e) {
      setMessage({ text: displayNameErrorMessage(e), tone: 'error' });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Nome público"
      fallbackHref="/"
      fieldsGap={layout.authStackGap}
      footerInline
      footer={
        <>
          {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
          <PrimaryButton variant="white" label="Guardar" onPress={() => void submit()} loading={loading} disabled={!check.ok} />
        </>
      }
    >
      <Text71 variant="bodyLight14" color="textMuted">
        {NOME_HELPER}
      </Text71>
      <View style={{ gap: space.s8 }}>
        <Text71 variant="eyebrow13" color="textSubtle">Nome atual</Text71>
        <Text71 variant="strong14" testID="current-name">
          {current}
        </Text71>
      </View>
      <TextField
        label="Novo nome"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setMessage(null);
        }}
        error={fieldError}
        autoCapitalize="words"
        textContentType="nickname"
      />
    </AuthScaffold>
  );
}
