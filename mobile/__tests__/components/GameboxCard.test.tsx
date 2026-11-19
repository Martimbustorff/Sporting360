// Plano 9 (frames 43 e 44): o número da GameBox em grupos de quatro, só para ver; o QR leva os algarismos sem espaços.
import { render, screen } from '@testing-library/react-native';
import { GameboxCard } from '@/components/GameboxCard';
import type { GameboxView } from '@/lib/gamebox';

const view = (number: string): GameboxView => ({
  id: 'g1',
  number,
  name: 'Lugar anual',
  stadium: { port: '5', sector: 'A12', line: '7', seat: '14' },
  pavilion: null,
  order: 1,
});

it('mostra o número em grupos de quatro e o QR leva os algarismos sem espaços', async () => {
  await render(<GameboxCard gamebox={view('001234567890')} />);
  expect(screen.getByText('0012 3456 7890')).toBeTruthy();
  expect(screen.queryByText('001234567890')).toBeNull();
  expect(screen.getByTestId('qrcode').props.value).toBe('001234567890');
});

it('número guardado com espaços: o QR continua sem espaços', async () => {
  await render(<GameboxCard gamebox={view('2665 7127 6572')} />);
  expect(screen.getByText('2665 7127 6572')).toBeTruthy();
  expect(screen.getByTestId('qrcode').props.value).toBe('266571276572');
});
