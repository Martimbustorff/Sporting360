// A minha história (Plano 10, Figma 52c e 54). Martim 20/11: só para quem fez prognóstico, no Sumário do jogo
// terminado, por baixo da previsão dos sportinguistas: "Partilhar a minha história" abre a folha com o StoryCard
// (à escala do ecrã) e "Partilhar" / "Fechar", como a partilha do prognóstico.
// Pontos: os do servidor quando o jogo está liquidado; antes disso, os calculados com o resultado final (mesmas regras).
import { useRef, useState, type ComponentRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StoryCard } from '@/components/StoryCard';
import type { Match } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { useMyGamePoints, useMyMvpVote, useMyPrediction, useSettlement } from '@/data/user';
import { mvpCandidates } from '@/lib/gameWindows';
import { predictionPoints } from '@/lib/predictionPoints';
import { provisionalPoints } from '@/lib/provisionalPoints';
import { reportCode } from '@/lib/report';
import { useSession } from '@/providers/SessionProvider';
import { shareStory } from '@/services/share';
import { layout, space } from '@/theme/tokens';

export const MY_STORY_TEXT = {
  open: 'Partilhar a minha história',
  send: 'Partilhar',
  close: 'Fechar',
  error: 'Não foi possível partilhar. Tenta outra vez.',
} as const;

/** Parte do ecrã que o cartão ocupa na folha (o resto fica para os botões). */
const SHEET_HEIGHT_SHARE = 0.55;

type StoryData = { pick: { home: number; away: number }; points: number | null; mvpName: string | null };

function useStoryData(match: Match): StoryData | null {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const prediction = useMyPrediction(match.id, uid);
  const settlement = useSettlement(match.id);
  const points = useMyGamePoints(match.id, uid);
  const vote = useMyMvpVote(match.id, uid);
  const players = useMatchDetail(match.id, 'players');
  if (prediction.status !== 'ready') return null;
  const pick = { home: prediction.data.home, away: prediction.data.away };
  const settled = settlement.status === 'ready' && points.status === 'ready' ? predictionPoints(points.data) : null;
  const final = match.score.home !== null && match.score.away !== null ? { home: match.score.home, away: match.score.away } : null;
  const total = settled ?? (final ? provisionalPoints(pick, final).total : null);
  const votedId = vote.status === 'ready' ? vote.data.playerId : null;
  const candidates = players.status === 'ready' ? mvpCandidates(players.data) : [];
  const mvpName = votedId ? (candidates.find((c) => c.playerId === votedId)?.name ?? null) : null;
  return { pick, points: total, mvpName };
}

function StorySheet({ match, data, onClose }: { match: Match; data: StoryData; onClose: () => void }) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const { height } = useWindowDimensions();
  const scale = Math.min(1, (height * SHEET_HEIGHT_SHARE) / layout.storyCard.height);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setSending(true);
    setError(null);
    try {
      if ((await shareStory(card, match)) === 'shared') onClose();
    } catch (e) {
      reportCode('SHARE_FAILED', e);
      setError(MY_STORY_TEXT.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalSheet grabber="center" onClose={onClose}>
      {/* Caixa já escalada; o cartão capturado fica sem transformação, com os 360x640 do design. */}
      <View
        testID="story-fit"
        style={{ alignSelf: 'center', width: layout.storyCard.width * scale, height: layout.storyCard.height * scale, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ transform: [{ scale }] }}>
          <StoryCard ref={card} match={match} pick={data.pick} points={data.points} mvpName={data.mvpName} />
        </View>
      </View>
      {error ? <FormMessage text={error} /> : null}
      <View style={{ gap: space.s12 }}>
        <PrimaryButton label={MY_STORY_TEXT.send} variant="white" onPress={() => void share()} loading={sending} />
        <PrimaryButton label={MY_STORY_TEXT.close} variant="outline" onPress={onClose} />
      </View>
    </ModalSheet>
  );
}

export function MyStory({ match }: { match: Match }) {
  const data = useStoryData(match);
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <View testID="my-story">
      <PrimaryButton label={MY_STORY_TEXT.open} onPress={() => setOpen(true)} />
      {open ? <StorySheet match={match} data={data} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}
