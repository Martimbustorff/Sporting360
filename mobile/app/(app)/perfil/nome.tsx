// SEM FIGMA: ecrã não desenhado. Compõe AuthScaffold (Header + rodapé acima do teclado), TextField, PrimaryButton
// e FormMessage, só com tokens.
// Task 16: mostra o nome público atual (ou o automático "Sportinguista #<fim do uid>") e grava um novo pela
// callable updateProfile. A validação é a do servidor (displayName.ts reexporta a cópia de functions).
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { usePublicProfile } from '@/data/hooks';
import { displayNameErrorMessage, displayNameMessage, validateDisplayName } from '@/lib/displayName';
import { publicName } from '@/lib/publicName';
import { useSession } from '@/providers/SessionProvider';
import { updateDisplayName } from '@/services/profile';
import { layout, spacing, type } from '@/theme/tokens';

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
      footer={
        <>
          {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
          <PrimaryButton label="Guardar" onPress={() => void submit()} loading={loading} disabled={!check.ok} />
        </>
      }
    >
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.fieldLabel, { opacity: layout.fieldLabelOpacity }]}>Nome atual</Text>
        <Text style={type.fieldValue} testID="current-name">
          {current}
        </Text>
        <Text style={[type.authNote, { textAlign: 'left', opacity: layout.authMutedOpacity }]}>
          É o nome que aparece nos rankings. Nunca mostramos o teu email.
        </Text>
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
