// Figma V7.1: 04 Estádio 4923:5983. Mapa sobre a "luz do relvado" (estadio-luz.svg), legenda (Portas 1 a 12 / Sectores A e B /
// Museu) e linhas L externas (Loja Verde, Bilheteira; a última sem separador). Botão Expandir/Reduzir no Header.
// Museu (decisão do Martim): só o marcador no mapa (já vem desenhado no PNG estadio-mapa.png) e a entrada "Museu" na
// legenda; sem ligação e sem linha a ligar. Mapa exportado do nó 445:4511; a animação de zoom (escala em `layout.stadiumZoomMs`)
// é SEM FIGMA. Usa o `Animated` do React Native (não o Reanimated) para as rotas continuarem a montar no teste de rotas.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { STADIUM_LINKS, type StadiumLink } from '@/content/clubLinks';
import { openLink } from '@/lib/openLink';
import { colors, layout, space } from '@/theme/tokens';
import { Text71 } from '@/theme/typography';

/* eslint-disable @typescript-eslint/no-require-imports */
const MAP = require('../../assets/images/estadio-mapa.png'); // nó 445:4511
const LUZ = require('../../assets/images/estadio-luz.svg'); // 4923:5984
const ICONS: Record<StadiumLink['id'] | 'expand' | 'shrink' | 'museum', number> = {
  loja: require('../../assets/icons/cart.svg'),
  bilheteira: require('../../assets/icons/ticket.svg'),
  expand: require('../../assets/icons/expand.svg'),
  shrink: require('../../assets/icons/shrink.svg'),
  museum: require('../../assets/icons/museum.svg'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const MAP_A11Y = 'Mapa do estádio com os sectores, a Loja Verde, o Museu e a Bilheteira';

function Legend() {
  const item = { flexDirection: 'row', alignItems: 'center', gap: layout.stadiumLegendGap } as const;
  return (
    <View testID="estadio-legenda" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.s16, rowGap: space.s8 }}>
      <View style={item}>
        <View
          style={{
            width: layout.stadiumLegendDoor,
            height: layout.stadiumLegendDoor,
            borderRadius: layout.stadiumLegendDoor / 2,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text71 variant="badge11">1</Text71>
        </View>
        <Text71 variant="caption12" color="textMuted">Portas 1 a 12</Text71>
      </View>
      <View style={item}>
        <View
          style={{
            width: layout.stadiumLegendSectorWidth,
            height: layout.stadiumLegendSectorHeight,
            borderRadius: layout.stadiumLegendSectorRadius,
            backgroundColor: colors.stadiumSector,
          }}
        />
        <Text71 variant="caption12" color="textMuted">Sectores A e B</Text71>
      </View>
      <View testID="legenda-museu" style={item}>
        <View style={{ padding: layout.stadiumLegendMuseumPad, borderRadius: layout.stadiumLegendMuseumRadius, backgroundColor: colors.white }}>
          <Image source={ICONS.museum} style={{ width: layout.stadiumLegendMuseumIcon, height: layout.stadiumLegendMuseumIcon }} accessible={false} />
        </View>
        <Text71 variant="caption12" color="textMuted">Museu</Text71>
      </View>
    </View>
  );
}

export default function Estadio() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const [zoomed, setZoomed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  // A altura da área segue o zoom (mesma duração e curva), para o mapa ampliado não ser cortado em cima e em baixo.
  const areaHeight = useRef(new Animated.Value(layout.stadiumMap.height)).current;

  useEffect(() => {
    const timing = { duration: layout.stadiumZoomMs, easing: Easing.out(Easing.cubic) };
    const a = Animated.timing(scale, { ...timing, toValue: zoomed ? layout.stadiumZoomScale : 1, useNativeDriver: true });
    const b = Animated.timing(areaHeight, {
      ...timing,
      toValue: layout.stadiumMap.height * (zoomed ? layout.stadiumZoomScale : 1),
      useNativeDriver: false,
    });
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [zoomed, scale, areaHeight]);

  const label = zoomed ? 'Reduzir mapa' : 'Ampliar mapa';

  return (
    <Screen padded="none">
      <Header
        title="Estádio"
        onBack={back}
        right={
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setZoomed((z) => !z)}
            style={{ minWidth: layout.minTouch, minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
          >
            <Image source={zoomed ? ICONS.shrink : ICONS.expand} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
          </Touchable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: space.s24 }}>
        <Animated.View testID="estadio-area" style={{ height: areaHeight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Image
            source={LUZ}
            accessible={false}
            style={{ position: 'absolute', left: layout.stadiumLuzLeft, top: '50%', marginTop: layout.stadiumLuzTop - layout.stadiumLuz / 2, width: layout.stadiumLuz, height: layout.stadiumLuz }}
          />
          <Animated.View testID="estadio-mapa" style={{ transform: [{ scale }] }}>
            <Image source={MAP} contentFit="contain" accessibilityLabel={MAP_A11Y} accessible style={layout.stadiumMap} />
          </Animated.View>
        </Animated.View>
        <View style={{ paddingHorizontal: space.s24, paddingTop: layout.stadiumBelowTop, gap: space.s16 }}>
          <Legend />
          <View>
            {STADIUM_LINKS.map((l, i) => (
              <MenuRow
                key={l.id}
                external
                label={l.label}
                separator={i < STADIUM_LINKS.length - 1}
                icon={<Image source={ICONS[l.id]} style={{ width: layout.menuRowIcon, height: layout.menuRowIcon }} accessible={false} />}
                onPress={() => void openLink(l.url)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
