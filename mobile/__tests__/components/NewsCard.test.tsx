import { fireEvent, render, screen } from '@testing-library/react-native';
import { NewsCard, type NewsVM } from '@/components/NewsCard';

const now = new Date('2026-11-17T12:00:00Z');
const news: NewsVM = {
  id: 'n1',
  title: 'Sporting vence em Alvalade',
  imageUrl: null,
  source: 'Record',
  publishedAt: new Date('2026-11-17T09:00:00Z'),
};

describe('NewsCard', () => {
  it('sem imagem renderiza com placeholder, fonte e tempo relativo', async () => {
    await render(<NewsCard news={news} now={now} onPress={() => {}} />);
    expect(screen.getByTestId('news-placeholder')).toBeTruthy();
    expect(screen.getByText(/Record/)).toBeTruthy();
    expect(screen.getByText(/há 3 horas/)).toBeTruthy();
  });
  it('com imagem mostra a fotografia', async () => {
    await render(<NewsCard news={{ ...news, imageUrl: 'https://x/y.jpg' }} now={now} onPress={() => {}} />);
    expect(screen.getByTestId('news-image')).toBeTruthy();
    expect(screen.queryByTestId('news-placeholder')).toBeNull();
  });
  it('carregar chama onPress com o id', async () => {
    const onPress = jest.fn();
    await render(<NewsCard news={news} now={now} onPress={onPress} />);
    fireEvent.press(screen.getByRole('link'));
    expect(onPress).toHaveBeenCalledWith('n1');
  });
  it('limita o título a duas linhas e não mostra o resumo (frame 27)', async () => {
    await render(<NewsCard news={{ ...news, summary: 'Resumo da notícia' }} now={now} onPress={() => {}} />);
    expect(screen.queryByText('Resumo da notícia')).toBeNull();
    expect(screen.getByText('Sporting vence em Alvalade').props.numberOfLines).toBe(2);
  });
});
