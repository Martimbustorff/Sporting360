// Task 17: partilha do cartão "S360 MATCHDAY": imagem (captura do ShareCard) e texto com o link, juntos, pelo
// react-native-share (o expo-sharing da V2 só levava a imagem). Mede `share_prediction` quando o sistema confirma.
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import type { Match } from '@/data/schemas';
import { shareLink } from '@/lib/shareLink';
import { track } from '@/services/analytics';

export function shareMessage(match: Pick<Match, 'id' | 'home' | 'away'>, home: number, away: number): string {
  return `O meu prognóstico para ${match.home.name} x ${match.away.name}: ${home}-${away}. Faz o teu na S360: ${shareLink(match.id)}`;
}

/**
 * Captura o cartão em PNG e abre a folha de partilha. `dismissed` quando a pessoa fecha a folha sem partilhar
 * (`failOnCancel: false`). Um erro da captura ou da folha propaga-se (o ecrã mostra a mensagem).
 */
export async function shareMatchday(
  ref: RefObject<ComponentRef<typeof View> | null>,
  match: Pick<Match, 'id' | 'home' | 'away'>,
  home: number,
  away: number,
): Promise<'shared' | 'dismissed'> {
  const url = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  const res = await Share.open({ url, type: 'image/png', message: shareMessage(match, home, away), failOnCancel: false });
  if (!res.success || res.dismissedAction) return 'dismissed';
  track('share_prediction', { game: match.id });
  return 'shared';
}
