// Figma: nó 406:13212 (Comunidade Leonina: texto 406:13220, por entrada uma linha, o nome em DIN 24 maiúsculas e uma linha
// por ligação com ícone 24 + gap 16 + corpo leve 14 + seta diagonal); ícones sociais 406:11998 (Twitter, Patreon, Youtube).
// ESCONDIDA: só abre com config/app features.comunidadeLeonina === true (a mesma flag da entrada do menu da Home); com a
// flag a false, em erro de leitura ou sem ela, vai para a Home. Enquanto a config carrega: Header com voltar e o estado a
// carregar (SEM FIGMA), sem redirecionar. Não apagar.
// Uma ligação ausente ou que não seja https não gera linha. `description` e `image` da entrada não existem no frame.
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { LionBackdrop } from '@/components/LionBackdrop';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { isHttps } from '@/content/clubLinks';
import { openLink } from '@/lib/openLink';
import { useAppConfig } from '@/data/hooks';
import type { CommunityEntry } from '@/data/schemas';
import { colors, layout, spacing, type } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const CHANNELS = [
  { key: 'twitter', label: 'Twitter', icon: require('../../assets/icons/twitter.svg') },
  { key: 'patreon', label: 'Patreon', icon: require('../../assets/icons/patreon.svg') },
  { key: 'youtube', label: 'Youtube', icon: require('../../assets/icons/youtube.svg') },
] as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export const COMUNIDADE_INTRO = 'Aqui podes encontrar onde na web se fala sobre o Sporting';

function Entry({ entry }: { entry: CommunityEntry }) {
  const links = CHANNELS.flatMap((c) => {
    const url = entry.links[c.key];
    return isHttps(url) ? [{ ...c, url }] : [];
  });
  return (
    <View style={{ gap: layout.communityGap }}>
      <View style={{ height: layout.separator, backgroundColor: colors.divider }} />
      <Text style={type.communityName}>{entry.name}</Text>
      {links.map((l) => (
        <Touchable
          key={l.key}
          accessibilityRole="link"
          accessibilityLabel={l.label}
          onPress={() => void openLink(l.url)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.menuRowGap }}>
            <Image source={l.icon} style={{ width: layout.menuRowIcon, height: layout.menuRowIcon }} accessible={false} />
            <Text style={type.authIntro}>{l.label}</Text>
          </View>
          <Feather name="arrow-up-right" size={layout.menuRowIcon} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
        </Touchable>
      ))}
    </View>
  );
}

export default function Comunidade() {
  const router = useRouter();
  const config = useAppConfig();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (config.status === 'loading') {
    return (
      <Screen padded="none">
        <LionBackdrop blurred />
        <Header title="Comunidade Leonina" onBack={back} />
        <View
          testID="comunidade-loading"
          accessible
          accessibilityLabel="A carregar"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.white} />
        </View>
      </Screen>
    );
  }
  if (config.status !== 'ready' || config.data.features.comunidadeLeonina !== true) return <Redirect href="/" />;

  const entries = config.data.comunidadeLeonina;
  return (
    <Screen padded="none">
      <LionBackdrop blurred />
      <Header title="Comunidade Leonina" onBack={back} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.screenXWide,
          paddingTop: spacing.sm,
          paddingBottom: layout.communityBottom,
          gap: layout.communityGap,
        }}
      >
        <Text style={type.authIntro}>{COMUNIDADE_INTRO}</Text>
        {entries.map((e, i) => (
          <Entry key={`${i}-${e.name}`} entry={e} />
        ))}
      </ScrollView>
    </Screen>
  );
}
