// Figma V7.1: 4933:7140 "Botão 44 · Votar no MVP" (08 Sumário revisto 20/11): taça num círculo verde à direita da barra do
// jogo; o ponto verde diz que a votação está aberta e ainda não votaste. Abre o ecrã do MVP (`/mvp/{id}`).
// Só aparece quando o MVP tem alguma coisa para mostrar: jogo a decorrer ou terminado (nunca antes, adiado ou cancelado).
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import type { Match } from '@/data/schemas';
import { useNow } from '@/data/clock';
import { useSession } from '@/providers/SessionProvider';
import { useMyMvpVote } from '@/data/user';
import { mvpWindow } from '@/lib/gameWindows';
import { colors, layout } from '@/theme/tokens';

const TROPHY = require('../../../assets/icons/trophy.svg') as number;
const SHOWN: ReadonlyArray<Match['status']> = ['LIVE', 'HT', 'FT', 'AET', 'PEN'];

export function MvpButton({ match }: { match: Match }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const vote = useMyMvpVote(match.id, uid);
  const now = useNow();
  if (!SHOWN.includes(match.status)) return null;
  const open = mvpWindow(match, now).state === 'open';
  const voted = vote.status === 'ready' && vote.data.playerId !== null;
  const dot = open && uid !== null && vote.status === 'ready' && !voted;
  return (
    <Touchable
      testID="mvp-button"
      accessibilityRole="button"
      accessibilityLabel={dot ? 'Votar no MVP, votação aberta' : 'MVP do jogo'}
      onPress={() => router.push(`/mvp/${match.id}`)}
      feedback="scale"
      style={{
        width: layout.mvpButton,
        height: layout.mvpButton,
        borderRadius: layout.mvpButton / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryTint,
      }}
    >
      <Image source={TROPHY} tintColor={colors.primaryOnDark} accessible={false} style={{ width: layout.mvpButtonIcon, height: layout.mvpButtonIcon }} />
      {dot ? (
        <View
          testID="mvp-button-dot"
          style={{
            position: 'absolute',
            top: layout.mvpButtonDotInset,
            right: layout.mvpButtonDotInset,
            width: layout.mvpButtonDot,
            height: layout.mvpButtonDot,
            borderRadius: layout.mvpButtonDot / 2,
            backgroundColor: colors.primaryOnDark,
          }}
        />
      ) : null}
    </Touchable>
  );
}
