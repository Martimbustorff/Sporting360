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
  it('snapshot (default)', async () => {
    const r = await render(<Screen><Text>ola</Text></Screen>);
    expect(r.toJSON()).toMatchSnapshot();
  });
});
