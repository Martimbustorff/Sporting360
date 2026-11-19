// Figma: nós 1561:5056 (Home), 1561:5307 (menu), 500:28796 (cartão do próximo jogo, topo da Agenda), 564:6981 (folha GameBox).
// Logótipo e definições 1561:5137; nome 1561:5135; "Sócio desde" 1561:5136; fundo em LionBackdrop.
// SEM FIGMA: o cartão do próximo jogo não está no 1561:5056 (fica entre o nome e o menu, GameHeader sem tabs);
// as linhas RANKING (ícone Feather "award") e COMUNIDADE LEONINA (Feather "users") não estão no menu 1561:5307;
// "News" do Figma passa a "NOTÍCIAS" (pt-PT). O ecrã faz scroll quando não cabe; o menu fica encostado à folha.
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Image } from 'expo-image';
import { Link, router, type Href } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameHeader } from '@/components/GameHeader';
import { HomeGameboxSheet, useGameboxSheetCollapsedHeight } from '@/components/HomeGameboxSheet';
import { LionBackdrop } from '@/components/LionBackdrop';
import { MenuRow } from '@/components/MenuRow';
import { useNow } from '@/data/clock';
import { useAppConfig, useMyUser, usePublicProfile } from '@/data/hooks';
import { useNextFootballMatch } from '@/data/sports';
import { toGameHeaderVM } from '@/lib/matchVM';
import { publicName } from '@/lib/publicName';
import { useSession } from '@/providers/SessionProvider';
import { colors, layout, spacing, type } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const ICONS = {
  settings: require('../../assets/icons/settings-future.svg'), // 4:1727 Interface / Settings_Future
  news: require('../../assets/icons/news.svg'), // 1561:5409 news_icon_with_photo 7
  calendar: require('../../assets/icons/calendar.svg'), // 239:16220 Calendar / Calendar
  compass: require('../../assets/icons/compass.svg'), // 307:6615 Navigation / Compass
  globe: require('../../assets/icons/globe.svg'), // 302:4143 Navigation / Globe
};
/* eslint-enable @typescript-eslint/no-require-imports */

const iconStyle = { width: layout.menuRowIcon, height: layout.menuRowIcon };
const svgIcon = (source: number) => <Image source={source} style={iconStyle} accessible={false} />;
const featherIcon = (name: 'award' | 'users') => <Feather name={name} size={layout.menuRowIcon} color={colors.white} />;

type MenuItem = { label: string; href: Href; icon: ReactNode };

function menuItems(comunidade: boolean): MenuItem[] {
  return [
    { label: 'NOTÍCIAS', href: '/noticias', icon: svgIcon(ICONS.news) },
    { label: 'AGENDA', href: '/agenda', icon: svgIcon(ICONS.calendar) },
    { label: 'RANKING', href: '/ranking', icon: featherIcon('award') },
    { label: 'MAPA DO ESTÁDIO', href: '/estadio', icon: svgIcon(ICONS.compass) },
    // Só com config/app features.comunidadeLeonina === true (omissão: false). Não apagar.
    ...(comunidade ? [{ label: 'COMUNIDADE LEONINA', href: '/comunidade' as Href, icon: featherIcon('users') }] : []),
    { label: 'SITES DO CLUBE', href: '/sites', icon: svgIcon(ICONS.globe) },
  ];
}

/** O nome guardado pelo próprio, nunca um email. */
function ownName(name: string | null | undefined): string {
  const v = (name ?? '').trim();
  return v.includes('@') ? '' : v;
}

export default function Home() {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
  const profile = usePublicProfile(uid);
  const config = useAppConfig();
  // Home fica montada como raiz da Stack: o relógio anda (blocos de 10 min e ao voltar à app).
  const now = useNow();
  const next = useNextFootballMatch(now);
  const { top } = useSafeAreaInsets();
  const sheetHeight = useGameboxSheetCollapsedHeight();

  const own = user.status === 'ready' ? ownName(user.data.name) : '';
  const name =
    own ||
    (!uid || user.status === 'loading' || profile.status === 'loading'
      ? ''
      : publicName({ displayName: profile.status === 'ready' ? profile.data.displayName : null }, uid));
  const since = user.status === 'ready' && user.data.partnerNumber != null ? String(user.data.partnerNumber).trim() : '';
  const comunidade = config.status === 'ready' && config.data.features.comunidadeLeonina === true;
  const match = next.status === 'ready' ? next.data : null;

  return (
    <View testID="home" style={{ flex: 1, backgroundColor: colors.black }}>
      <LionBackdrop />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(top, layout.statusBarHeight) + (layout.homeLogoTop - layout.statusBarHeight),
          paddingHorizontal: spacing.screenXWide,
          paddingBottom: sheetHeight + layout.homeMenuSheetGap,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.lockLogo} accessibilityRole="header" accessibilityLabel="S360">
            <Text style={{ color: colors.primary }}>S</Text>360
          </Text>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Definições"
            hitSlop={(layout.minTouch - layout.menuRowIcon) / 2}
            onPress={() => router.push('/definicoes')}
          >
            {svgIcon(ICONS.settings)}
          </Touchable>
        </View>

        <Touchable
          accessibilityRole="button"
          accessibilityHint="Abre o perfil"
          onPress={() => router.push('/perfil')}
          style={{ marginTop: layout.homeNameGap }}
        >
          <Text style={type.homeName} numberOfLines={1}>
            {name}
          </Text>
          {since ? (
            <View style={{ marginTop: layout.homeSinceGap }}>
              <Text style={[type.homeSinceLabel, { opacity: layout.homeSinceLabelOpacity }]}>Sócio desde</Text>
              <Text style={type.homeSinceValue}>{since}</Text>
            </View>
          ) : null}
        </Touchable>

        {match ? (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Próximo jogo"
            onPress={() => router.push(`/jogo/${match.id}`)}
            style={{
              marginTop: layout.homeBlockGap,
              marginHorizontal: spacing.screenX - spacing.screenXWide,
            }}
          >
            <GameHeader game={toGameHeaderVM(match)} now={now} />
          </Touchable>
        ) : null}

        <View style={{ flexGrow: 1, minHeight: layout.homeBlockGap }} />

        <View testID="home-menu">
          {menuItems(comunidade).map((item) => (
            <MenuRow key={item.label} label={item.label} icon={item.icon} onPress={() => router.push(item.href)} />
          ))}
        </View>
        {__DEV__ ? (
          <Link href="/dev/galeria" style={[type.authLink, { marginTop: spacing.md }]}>
            Galeria
          </Link>
        ) : null}
      </ScrollView>
      {uid ? <HomeGameboxSheet uid={uid} /> : null}
    </View>
  );
}
