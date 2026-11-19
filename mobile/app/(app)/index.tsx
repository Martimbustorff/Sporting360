// Figma V7.1: frames 01 (4921:5155), 01b (4921:5415), 01c (4921:5436), 07a (4932:6421), 07b (4932:6633), 07c (4932:6845),
// 43 (4951:8434) e 43b (4951:8951); componentes "V7.1 / Next match card" 4920:5140 e "V7.1 / Home backdrop" 4920:5141.
// Layout da produção (leão, logótipo S360, nome, sócio desde, cartão do jogo, menu, folha GameBox), margem única de 24 pt.
// O cartão tem sempre 192 pt (o menu não salta) e muda com o momento do jogo (lib/homeMatchMoment); a contagem do
// "Dia de jogo" anda ao segundo só com a Home visível e a app em primeiro plano.
// SEM FIGMA: as linhas RANKING (ícone Feather "award": o Figma desenha um troféu) e COMUNIDADE LEONINA (Feather "users")
// não são do menu de 5 linhas do Figma; "News" do Figma passa a "NOTÍCIAS" (pt-PT). O ecrã faz scroll quando não cabe.
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, router, useIsFocused, type Href } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeGameboxSheet, useGameboxSheetCollapsedHeight } from '@/components/HomeGameboxSheet';
import { LionBackdrop } from '@/components/LionBackdrop';
import { MenuRow } from '@/components/MenuRow';
import { NextMatchCard } from '@/components/NextMatchCard';
import { Touchable } from '@/components/Touchable';
import { useNow, useSecondNow } from '@/data/clock';
import { useAppConfig, useMyUser, usePublicProfile } from '@/data/hooks';
import { useHomeMatches } from '@/data/sports';
import { useMyMvpVote } from '@/data/user';
import { mvpWindow, predictionOpen } from '@/lib/gameWindows';
import { homeMatchMoment, pickHomeMatch } from '@/lib/homeMatchMoment';
import { publicName } from '@/lib/publicName';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, space, type } from '@/theme/tokens';

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
  // Home fica montada como raiz da Stack: o relógio anda ao minuto (dia de jogo e meia-noite de Lisboa) e ao voltar à app.
  const minute = useNow(60_000);
  const focused = useIsFocused();
  const [attempt, setAttempt] = useState(0);
  const matches = useHomeMatches(minute, attempt);
  const match = useMemo(() => (matches.status === 'ready' ? pickHomeMatch(matches.data, minute) : null), [matches, minute]);
  const loading = matches.status === 'loading';
  // O mesmo documento de votos que o separador MVP lê; só para jogos que já começaram.
  const started = match !== null && match.status !== 'NS' && match.status !== 'PST' && match.status !== 'CANC';
  const vote = useMyMvpVote(match?.id ?? '', started ? uid : null);
  const votedMvp = vote.status === 'ready';
  const coarse = homeMatchMoment({ match, now: minute, predictionOpen: false, mvpOpen: false, votedMvp, loading });
  const now = useSecondNow(focused && coarse.state === 'matchday', minute);
  const moment = homeMatchMoment({
    match,
    now,
    predictionOpen: match ? predictionOpen(match, now) : false,
    mvpOpen: match ? mvpWindow(match, now).state === 'open' : false,
    votedMvp,
    loading,
  });
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
  const items = menuItems(comunidade);

  return (
    <View testID="home" style={{ flex: 1, backgroundColor: colors.bg }}>
      <LionBackdrop />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(top, layout.statusBarHeight),
          paddingHorizontal: space.s24,
          paddingBottom: sheetHeight + layout.homeMenuSheetGap,
        }}
      >
        <View style={{ height: layout.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.lockLogo} accessibilityRole="header" accessibilityLabel="S360">
            <Text style={{ color: colors.primary }}>S</Text>360
          </Text>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Definições"
            onPress={() => router.push('/definicoes')}
            style={{ width: layout.minTouch, height: layout.minTouch, alignItems: 'flex-end', justifyContent: 'center' }}
          >
            {svgIcon(ICONS.settings)}
          </Touchable>
        </View>

        <Touchable
          accessibilityRole="button"
          accessibilityHint="Abre o perfil"
          onPress={() => router.push('/perfil')}
          style={{ paddingTop: space.s16, paddingBottom: space.s24 }}
        >
          <Text71 variant="titleL28" numberOfLines={1}>{name}</Text71>
          {since ? (
            <View style={{ paddingTop: space.s12, gap: layout.gameboxTextGap }}>
              <Text71 variant="eyebrow13" color="textSubtle">Sócio desde</Text71>
              <Text71 variant="titleS20">{since}</Text71>
            </View>
          ) : null}
        </Touchable>

        <NextMatchCard
          moment={moment}
          match={match}
          now={now}
          error={matches.status === 'error'}
          onOpenMatch={(id) => router.push(`/jogo/${id}`)}
          onAction={(href) => router.push(href as Href)}
          onOpenAgenda={() => router.push('/agenda')}
          onRetry={() => setAttempt((n) => n + 1)}
        />

        <View testID="home-menu" style={{ paddingTop: space.s12 }}>
          {items.map((item, i) => (
            <MenuRow
              key={item.label}
              label={item.label}
              icon={item.icon}
              separator={i < items.length - 1}
              onPress={() => router.push(item.href)}
            />
          ))}
        </View>
        {__DEV__ ? (
          <Link href="/dev/galeria" style={[type.authLink, { marginTop: space.s16 }]}>
            Galeria
          </Link>
        ) : null}
      </ScrollView>
      {uid ? <HomeGameboxSheet uid={uid} /> : null}
    </View>
  );
}
