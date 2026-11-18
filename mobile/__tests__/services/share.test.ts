// Task 17: partilha do cartão "S360 MATCHDAY" (imagem + texto com link) pelo react-native-share.
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));

import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import type { Match } from '@/data/schemas';
import { track } from '@/services/analytics';
import { shareMatchday } from '@/services/share';

const MATCH = {
  id: '1001',
  home: { id: '228', name: 'Sporting CP', logo: null },
  away: { id: '217', name: 'SC Braga', logo: null },
} as Match;
const ref = { current: {} } as never;

beforeEach(() => jest.clearAllMocks());

describe('shareMatchday', () => {
  it('captura o cartão em PNG e partilha imagem e mensagem com o link', async () => {
    await expect(shareMatchday(ref, MATCH, 2, 1)).resolves.toBe('shared');
    expect(captureRef).toHaveBeenCalledWith(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    expect(Share.open).toHaveBeenCalledWith({
      url: 'file:///tmp/card.png',
      type: 'image/png',
      message:
        'O meu prognóstico para Sporting CP x SC Braga: 2-1. Faz o teu na S360: https://scp360-37a74.web.app/j?src=share&game=1001',
      failOnCancel: false,
    });
    expect(track).toHaveBeenCalledWith('share_prediction', { game: '1001' });
  });

  it('fechar a folha de partilha devolve dismissed e não conta como partilha', async () => {
    (Share.open as jest.Mock).mockResolvedValueOnce({ success: false, dismissedAction: true, message: '' });
    await expect(shareMatchday(ref, MATCH, 2, 1)).resolves.toBe('dismissed');
    expect(track).not.toHaveBeenCalled();
  });

  it('um erro da captura propaga-se sem abrir a folha', async () => {
    (captureRef as jest.Mock).mockRejectedValueOnce(new Error('snap'));
    await expect(shareMatchday(ref, MATCH, 2, 1)).rejects.toThrow('snap');
    expect(Share.open).not.toHaveBeenCalled();
  });
});
