// Plano 7 T6 (ronda 1): o provider de scroll do detalhe do jogo e a lógica do cabeçalho compacto.
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MatchScrollProvider, MatchScrollView, nextCompact, useMatchScrollContext } from '@/components/match/MatchScroll';
import { MatchDetailLayout } from '@/components/match/CollapsingHeader';
import { layout } from '@/theme/tokens';

const H = 300;

describe('nextCompact (histerese)', () => {
  it('entra acima de collapseCompactFrom e sai abaixo de collapseCompactExit', () => {
    const enter = H * layout.collapseCompactFrom;
    const exit = H * layout.collapseCompactExit;
    expect(nextCompact(false, enter - 1, H)).toBe(false);
    expect(nextCompact(false, enter + 1, H)).toBe(true);
    // Entre os dois limiares mantém o estado atual.
    const mid = (enter + exit) / 2;
    expect(nextCompact(true, mid, H)).toBe(true);
    expect(nextCompact(false, mid, H)).toBe(false);
    expect(nextCompact(true, exit - 1, H)).toBe(false);
  });
  it('sem altura medida usa o fallback', () => {
    expect(nextCompact(false, layout.collapseRange, 0)).toBe(true);
    expect(nextCompact(false, 0, 0)).toBe(false);
  });
});

function Probe({ onCtx }: { onCtx: (c: ReturnType<typeof useMatchScrollContext>) => void }) {
  onCtx(useMatchScrollContext());
  return null;
}

async function setup() {
  let ctx: ReturnType<typeof useMatchScrollContext> = null;
  await render(
    <MatchScrollProvider>
      <Probe onCtx={(c) => { ctx = c; }} />
      <MatchDetailLayout header={<Text>cab</Text>} tabs={<Text>tabs</Text>}>
        <MatchScrollView testID="scroll"><Text>conteudo</Text></MatchScrollView>
      </MatchDetailLayout>
    </MatchScrollProvider>,
  );
  return { ctx: () => ctx! };
}

const scrollTo = async (y: number) => fireEvent.scroll(screen.getByTestId('scroll'), { nativeEvent: { contentOffset: { x: 0, y } } });

describe('MatchScrollProvider', () => {
  it('regista o scroll em y, torna-se compacto com histerese e reabre no reset', async () => {
    const { ctx } = await setup();
    // Mede o cabeçalho completo e os separadores.
    await act(async () => { ctx().setHeaderHeight(H); ctx().setTabsHeight(48); });
    expect(ctx().compact).toBe(false);

    await scrollTo(H * layout.collapseCompactFrom + 10);
    expect(ctx().y.get()).toBe(H * layout.collapseCompactFrom + 10);
    expect(ctx().compact).toBe(true);

    // Entre os limiares fica compacto.
    await scrollTo(H * 0.45);
    expect(ctx().compact).toBe(true);
    // Abaixo do limiar de saída reabre.
    await scrollTo(H * layout.collapseCompactExit - 5);
    expect(ctx().compact).toBe(false);

    await scrollTo(H);
    expect(ctx().compact).toBe(true);
    await act(async () => { ctx().reset(); });
    expect(ctx().y.get()).toBe(0);
    expect(ctx().compact).toBe(false);
  });

  it('ignora scroll negativo (overscroll) e reserva o espaço do bloco por cima', async () => {
    const { ctx } = await setup();
    await act(async () => { ctx().setHeaderHeight(H); ctx().setTabsHeight(48); });
    await scrollTo(-40);
    expect(ctx().y.get()).toBe(0);
    expect(ctx().inset).toBe(H + 48);
    expect(screen.getByTestId('match-scroll-spacer').props.style.height).toBe(H + 48);
  });

  it('esconde o cabeçalho completo da acessibilidade quando compacto', async () => {
    const { ctx } = await setup();
    await act(async () => { ctx().setHeaderHeight(H); });
    await scrollTo(H);
    expect(screen.queryByText('cab')).toBeNull(); // escondido da árvore de acessibilidade
    const block = screen.getByText('cab', { includeHiddenElements: true }).parent!;
    expect(block.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(block.props.accessibilityElementsHidden).toBe(true);
  });
});

describe('MatchScrollView fora do provider', () => {
  it('é um ScrollView normal, sem espaçador', async () => {
    await render(<MatchScrollView testID="s"><Text>x</Text></MatchScrollView>);
    expect(screen.queryByTestId('match-scroll-spacer')).toBeNull();
  });
});
