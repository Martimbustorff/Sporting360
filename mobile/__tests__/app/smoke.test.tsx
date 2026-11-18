import { render, screen } from '@testing-library/react-native';

import Home from '../../app/(app)/index';

describe('app shell', () => {
  it('renders the S360 home screen', async () => {
    await render(<Home />);
    expect(screen.getByText('S360')).toBeTruthy();
  });
});
