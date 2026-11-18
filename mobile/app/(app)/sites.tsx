// Figma: nó 348:44569 (Sites do clube: fundo "image 2" desfocado 348:44570, texto 348:44577 em corpo leve 14/22,
// quatro linhas ícone 24 + gap 16 + etiqueta DIN 18 maiúsculas + seta diagonal, separadas por linha). Linhas com MenuRow external.
// O título do frame diz "Sites do Cube" (gralha): usa-se "Sites do clube". "directas" passa a "diretas" (pt-PT atual).
// Os ícones do carrinho e do bilhete são os do mapa do estádio, desenhados a 24 (vetor, sem perda).
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { LionBackdrop } from '@/components/LionBackdrop';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { CLUB_SITES, type ClubSite } from '@/content/clubLinks';
import { openLink } from '@/lib/openLink';
import { Body } from '@/theme/typography';
import { layout, spacing, type } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const ICONS: Record<ClubSite['id'], number> = {
  sporting: require('../../assets/icons/globe.svg'), // 302:4143 Navigation / Globe
  minuto: require('../../assets/icons/user-card.svg'), // 7:2933 User / User_Card_ID
  loja: require('../../assets/icons/cart.svg'), // 7:2921 Interface / Shopping_Cart_02
  bilheteira: require('../../assets/icons/ticket.svg'), // 7:2917 Interface / Ticket_Voucher
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const SITES_INTRO = 'Aqui podes encontrar ligações diretas para os sites oficiais do clube.';
const iconStyle = { width: layout.menuRowIcon, height: layout.menuRowIcon };

export default function Sites() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen padded="none">
      <LionBackdrop blurred />
      <Header title="Sites do clube" onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenXWide, paddingTop: spacing.sm }}>
        <Body variant="body" style={type.authIntro}>{SITES_INTRO}</Body>
        <View style={{ marginTop: layout.sitesListTop, gap: layout.sitesRowGap }}>
          {CLUB_SITES.map((s) => (
            <MenuRow
              key={s.id}
              external
              label={s.label}
              icon={<Image source={ICONS[s.id]} style={iconStyle} accessible={false} />}
              onPress={() => void openLink(s.url)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
