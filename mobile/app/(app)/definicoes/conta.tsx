// Figma V7.1: nó 4941:7546 (19 Conta S360): fundo bg, campos a 24 (etiqueta Eyebrow 13 text-subtle, valor Body 14, linha),
// "Nome público" abre o ecrã do nome (seta à direita, linha de 2 pt primary-on-dark), "Email" só de leitura (linha de 1 pt
// separator) e "Mudar password" em Caption Strong sublinhado, só com o provider `password`. Único ecrã onde o email aparece.
// Diferença ao frame: sem fundo de leão desfocado (o frame é bg liso).
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { useMyUser, usePublicProfile } from '@/data/hooks';
import { publicName } from '@/lib/publicName';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const CONTA_TEXT = {
  noEmail: 'Sem email',
  loading: 'A carregar…',
  nameError: 'Não foi possível carregar o nome.',
} as const;

function Field({ label, value, onPress, a11y }: { label: string; value: string; onPress?: () => void; a11y?: string }) {
  const body = (
    <View style={{ gap: space.s8 }}>
      <Text71 variant="eyebrow13" color="textSubtle" numberOfLines={1}>
        {label}
      </Text71>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
        <Text71 variant="body14" style={{ flex: 1, minWidth: 0 }} numberOfLines={1} selectable={!onPress}>
          {value}
        </Text71>
        {onPress ? (
          <Feather name="chevron-right" size={layout.settingsChevron} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
        ) : null}
      </View>
      <View
        style={{
          height: onPress ? layout.fieldLineWidthActive : layout.fieldLineWidth,
          borderRadius: radii.r8,
          backgroundColor: onPress ? colors.primaryOnDark : colors.separator,
        }}
      />
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={`${label}: ${value}`}>{body}</View>;
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? `${label}: ${value}`}
      onPress={onPress}
      style={{ minHeight: layout.minTouch }}
    >
      {body}
    </Touchable>
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
  else if (profile.status === 'missing' && uid && doc.status === 'ready') {
    name = publicName({ displayName: doc.data.displayName ?? null, name: doc.data.name ?? null }, uid);
  } else if (profile.status === 'missing' && uid && doc.status !== 'loading') {
    // users/{uid} por ler (erro ou sem documento): erro da secção, nunca um nome inventado.
    name = CONTA_TEXT.nameError;
  }

  return (
    <Screen padded="none">
      <Header title="Conta S360" onBack={back} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: layout.authContentTop, gap: layout.settingsFieldGap }}
      >
        <Field label="Nome público" value={name} a11y={`Nome público: ${name}. Mudar`} onPress={() => router.push('/perfil/nome')} />
        <Field label="Email" value={user?.email ?? CONTA_TEXT.noEmail} />
        {user?.providers.includes('password') ? (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Mudar password"
            onPress={() => router.push('/definicoes/password')}
            style={{ alignSelf: 'flex-start', minHeight: layout.minTouch, minWidth: layout.minTouch, justifyContent: 'center' }}
          >
            <Text71 variant="captionStrong12" style={{ textDecorationLine: 'underline' }}>
              Mudar password
            </Text71>
          </Touchable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
