// Figma V7.1: 03 Sites 4922:5959. Fundo liso (sem leão), intro Body Light 14, 5 linhas L externas (a última, "Gameback",
// sem separador) e nota com seta externa "Abre no navegador, fora da app.". Texto da intro e nota mantidos.
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { CLUB_SITES, type ClubSite } from '@/content/clubLinks';
import { openLink } from '@/lib/openLink';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';
import Feather from '@expo/vector-icons/Feather';

/* eslint-disable @typescript-eslint/no-require-imports */
const ICONS: Record<ClubSite['id'], number> = {
  sporting: require('../../assets/icons/globe.svg'), // 302:4143 Navigation / Globe
  minuto: require('../../assets/icons/user-card.svg'), // 7:2933 User / User_Card_ID
  loja: require('../../assets/icons/cart.svg'), // 7:2921 Interface / Shopping_Cart_02
  bilheteira: require('../../assets/icons/ticket.svg'), // 7:2917 Interface / Ticket_Voucher
  gameback: require('../../assets/icons/share.svg'), // 4922:6027 Ícone (partilha)
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const SITES_NOTE = 'Abre no navegador, fora da app.';
export const SITES_INTRO = 'Aqui podes encontrar ligações diretas para os sites oficiais do clube.';
const iconStyle = { width: layout.menuRowIcon, height: layout.menuRowIcon };

export default function Sites() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen padded="none">
      <Header title="Sites do clube" onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: space.s8, paddingBottom: space.s24, gap: space.s16 }}>
        <Text71 variant="bodyLight14" color="textMuted">{SITES_INTRO}</Text71>
        <View>
          {CLUB_SITES.map((s, i) => (
            <MenuRow
              key={s.id}
              external
              label={s.label}
              separator={i < CLUB_SITES.length - 1}
              icon={<Image source={ICONS[s.id]} style={iconStyle} accessible={false} />}
              onPress={() => void openLink(s.url)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.linkNoteGap }}>
          <Feather name="arrow-up-right" size={layout.linkNoteIcon} color={colors.textSubtle} accessibilityElementsHidden importantForAccessibility="no" />
          <Text71 variant="caption12" color="textSubtle">{SITES_NOTE}</Text71>
        </View>
      </ScrollView>
    </Screen>
  );
}
