// Figma: nós 450:5254 (mapa normal, 359 de largura) e 450:5095 (ampliado, 585 de largura, cortado pelo ecrã); mapa exportado
// do nó 445:4511 (assets/images/estadio-mapa.png, com os sectores, NORTE/SUL e os três ícones). Botão Expand/Shrink 450:5414 /
// 450:5416 no canto direito do Header; ligações 450:5379 (ícone 21.17 + gap 15 + etiqueta DIN 18) em baixo à esquerda.
// SEM FIGMA: a animação entre os dois estados (escala em `layout.stadiumZoomMs`) e a linha do Museu escondida sem URL.
// Usa o `Animated` do React Native (não o Reanimated) para as rotas continuarem a montar no teste de rotas.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { isHttps, STADIUM_LINKS, type StadiumLink } from '@/content/clubLinks';
import { layout, type } from '@/theme/tokens';
import { Display } from '@/theme/typography';

/* eslint-disable @typescript-eslint/no-require-imports */
const MAP = require('../../assets/images/estadio-mapa.png'); // nó 445:4511
const ICONS: Record<StadiumLink['id'] | 'expand' | 'shrink', number> = {
  museu: require('../../assets/icons/museum.svg'), // 450:5381
  loja: require('../../assets/icons/cart.svg'), // 450:5385
  bilheteira: require('../../assets/icons/ticket.svg'), // 450:5388
  expand: require('../../assets/icons/expand.svg'), // 450:5414
  shrink: require('../../assets/icons/shrink.svg'), // 450:5416
};
/* eslint-enable @typescript-eslint/no-require-imports */

export default function Estadio() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const [zoomed, setZoomed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: zoomed ? layout.stadiumZoomScale : 1,
      duration: layout.stadiumZoomMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [zoomed, scale]);

  const open = (url: string | null) => {
    if (isHttps(url)) WebBrowser.openBrowserAsync(url).catch(() => undefined);
  };
  const label = zoomed ? 'Reduzir mapa' : 'Ampliar mapa';

  return (
    <Screen padded="none">
      <Header
        title="Estádio"
        onBack={back}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setZoomed((z) => !z)} hitSlop={12}>
            <Image
              source={zoomed ? ICONS.shrink : ICONS.expand}
              style={{ width: layout.headerIcon, height: layout.headerIcon }}
              accessible={false}
            />
          </Pressable>
        }
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View testID="estadio-mapa" style={{ transform: [{ scale }] }}>
          <Image
            source={MAP}
            contentFit="contain"
            accessibilityLabel="Mapa do estádio com os sectores, a Loja Verde, o Museu e a Bilheteira"
            accessible
            style={layout.stadiumMap}
          />
        </Animated.View>
      </View>
      <View style={{ position: 'absolute', left: layout.stadiumLinksX, bottom: layout.stadiumLinksBottom, gap: layout.stadiumLinksGap }}>
        {STADIUM_LINKS.filter((l) => l.url !== null).map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="link"
            accessibilityLabel={l.label}
            onPress={() => open(l.url)}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: layout.stadiumLinkIconGap,
              opacity: pressed ? layout.pressedOpacity : 1,
            })}
          >
            <Image
              source={ICONS[l.id]}
              style={{ width: layout.stadiumLinkIcon, height: layout.stadiumLinkIcon }}
              accessible={false}
            />
            <Display variant="menuItem" style={type.menuRow}>{l.label}</Display>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
