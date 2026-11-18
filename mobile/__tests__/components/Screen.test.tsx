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

  it('snapshot (default)', async () => {
    const r = await render(<Screen><Text>ola</Text></Screen>);
    expect(r.toJSON()).toMatchSnapshot();
  });
});
