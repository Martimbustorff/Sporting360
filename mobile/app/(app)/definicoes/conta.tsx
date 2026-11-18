// Figma: nó 323:11694 (Conta: fundo desfocado como nas Definições; campos a 128 com 16 entre si, cada um etiqueta DIN 14
// a 50%, valor em corpo 16 e linha 2px primary; "Mudar Password" em corpo semibold 12 sublinhado, branco).
// Diferenças ao frame (Plano 4, Task 26): o nome é o nome público e abre /perfil/nome (seta à direita, SEM FIGMA); o
// email é só de leitura; "Sócio desde" fica no Perfil (editado em /perfil/editar); sem "Guardar" (nada se edita aqui)
// e "Apagar conta" está nas Definições. "Mudar password" só aparece com o provider `password`.
// Este é o único ecrã onde o email aparece.
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Header } from '@/components/Header';
import { LionBackdrop } from '@/components/LionBackdrop';
import { Screen } from '@/components/Screen';
import { useMyUser, usePublicProfile } from '@/data/hooks';
import { publicName } from '@/lib/publicName';
import { useSession } from '@/providers/SessionProvider';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

export const CONTA_TEXT = {
  noEmail: 'Sem email',
  loading: 'A carregar…',
  nameError: 'Não foi possível carregar o nome.',
} as const;

function Field({ label, value, onPress, a11y }: { label: string; value: string; onPress?: () => void; a11y?: string }) {
  const body = (
    <>
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.fieldLabel, { opacity: layout.fieldLabelOpacity }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text style={[type.fieldValue, { flexShrink: 1 }]} numberOfLines={1} selectable={!onPress}>
            {value}
          </Text>
          {onPress ? (
            <Feather name="arrow-right" size={layout.menuRowIcon} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
        </View>
      </View>
      <View style={{ marginTop: spacing.sm, height: layout.fieldLineWidthActive, borderRadius: radius.line, backgroundColor: colors.primary }} />
    </>
  );
  if (!onPress) return <View accessible accessibilityLabel={`${label}: ${value}`}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? `${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: layout.minTouch, opacity: pressed ? layout.pressedOpacity : 1 })}
    >
      {body}
    </Pressable>
  );
}

export default function Conta() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const user = session.status === 'signedIn' ? session.user : null;
  const uid = user?.uid ?? null;
  const profile = usePublicProfile(uid);
  const doc = useMyUser(uid);

  // Nome público: o de publicProfiles; sem ele, a regra do servidor ("Maria C."), como no Perfil.
  let name: string = CONTA_TEXT.loading;
  if (profile.status === 'ready') name = profile.data.displayName;
  else if (profile.status === 'error') name = CONTA_TEXT.nameError;
  else if (profile.status === 'missing' && uid && doc.status !== 'loading') {
    const u = doc.status === 'ready' ? doc.data : {};
    name = publicName({ displayName: u.displayName ?? null, name: u.name ?? null }, uid);
  }

  return (
    <Screen padded="none">
      <LionBackdrop blurred />
      <Header title="Conta S360" onBack={back} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.screenXWide, paddingTop: layout.settingsListTop, gap: spacing.md }}
      >
        <Field label="Nome" value={name} a11y={`Nome público: ${name}. Mudar`} onPress={() => router.push('/perfil/nome')} />
        <Field label="Email" value={user?.email ?? CONTA_TEXT.noEmail} />
        {user?.providers.includes('password') ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mudar password"
            onPress={() => router.push('/definicoes/password')}
            hitSlop={spacing.sm}
            style={({ pressed }) => ({ minHeight: layout.minTouch, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? layout.pressedOpacity : 1 })}
          >
            <Body variant="badgeSmall" style={{ textDecorationLine: 'underline' }}>Mudar password</Body>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
