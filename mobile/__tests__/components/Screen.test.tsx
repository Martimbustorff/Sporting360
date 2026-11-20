import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from '@/components/Screen';

describe('Screen', () => {
  it('renders children', async () => {
    await render(<Screen><Text>ola</Text></Screen>);
    expect(screen.getByText('ola')).toBeTruthy();
  });
  it('scroll variant renders children', async () => {
    await render(<Screen scroll padded="wide"><Text>ola</Text></Screen>);
    expect(screen.getByText('ola')).toBeTruthy();
  });
  it('excludes the top edge by default (Header owns the top inset)', async () => {
    const r = await render(<Screen><Text>ola</Text></Screen>);
    const root = r.toJSON() as unknown as { props: { edges: Record<string, string> } };
    expect(root.props.edges.top).toBe('off');
    expect(root.props.edges.bottom).toBe('additive');
  });

  it('edges prop can re-enable the top inset', async () => {
    const r = await render(<Screen edges={['top', 'bottom']}><Text>ola</Text></Screen>);
    const root = r.toJSON() as unknown as { props: { edges: Record<string, string> } };
    expect(root.props.edges.top).toBe('additive');
  });

  it('draws the brand circle by default (20/11: every screen but Home)', async () => {
    await render(<Screen><Text>ola</Text></Screen>);
    expect(screen.getByTestId('brand-backdrop')).toBeTruthy();
  });

  it('backdrop={false} leaves the plain background (GameBox ticket QR)', async () => {
    await render(<Screen backdrop={false}><Text>ola</Text></Screen>);
    expect(screen.queryByTestId('brand-backdrop')).toBeNull();
  });

  it('snapshot (default)', async () => {
    const r = await render(<Screen><Text>ola</Text></Screen>);
    expect(r.toJSON()).toMatchSnapshot();
  });
});

it('o fundo leva o leão desfocado por baixo do círculo (20/11)', async () => {
  await render(<Screen><Text>ola</Text></Screen>);
  expect(screen.getByTestId('brand-backdrop-lion')).toBeTruthy();
});
