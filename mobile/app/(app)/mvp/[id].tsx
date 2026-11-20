// Figma V7.1: 4934:7087 "09 Jogo · MVP · ecrã próprio" (revisto 20/11, Martim: a votação não pode ficar escondida nas
// tabs). Abre pela taça no topo do jogo (`MvpButton`) e pelo "VOTA NO MVP" da Home. Cabeçalho com o resultado
// compacto, por baixo o conteúdo do MVP (votação aberta com a grelha de caras dos jogadores, resultado, MVP oficial).
// SEM FIGMA: o esqueleto enquanto o jogo chega, jogo não encontrado e erro (os mesmos textos do detalhe do jogo).
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { GameHeader } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { MvpTab } from '@/components/match/MvpTab';
import { Screen } from '@/components/Screen';
import { useMatch } from '@/data/sports';
import { toGameHeaderVM } from '@/lib/matchVM';
import { colors, layout, radii, space } from '@/theme/tokens';

const MISSING_TEXT = 'Jogo não encontrado.';
const ERROR_TEXT = 'Não foi possível carregar o jogo.';

export default function MvpScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? null;
  const loadable = useMatch(id);
  const match = loadable.status === 'ready' ? loadable.data : null;
  const back = () => (router.canGoBack() ? router.back() : router.replace(id ? `/jogo/${id}` : '/'));

  return (
    <Screen padded="none">
      <Header
        title="MVP"
        onBack={back}
        center={match ? <GameHeader game={toGameHeaderVM(match)} size="compact" /> : undefined}
      />
      {loadable.status === 'loading' ? (
        <View style={{ paddingHorizontal: space.s16, paddingTop: space.s16 }}>
          <View testID="mvp-screen-skeleton" style={{ height: layout.skeletonHeaderHeight, borderRadius: radii.r8, backgroundColor: colors.surface10 }} />
        </View>
      ) : loadable.status === 'missing' ? (
        <EmptyState icon="info" text={MISSING_TEXT} />
      ) : !match ? (
        <EmptyState icon="info" text={ERROR_TEXT} />
      ) : (
        <MvpTab match={match} />
      )}
    </Screen>
  );
}
