import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MatchCard } from '@/components/MatchCard';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const team = (name: string) => ({ name, crestUrl: null, id: null });

describe('MatchCard', () => {
  it('cada instância tem o seu id de degradê, válido em SVG, e o Rect aponta para o seu', async () => {
    const view = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <MatchCard home={team('A')} away={team('B')} competition="Liga" kickoff="sáb" />
        <MatchCard home={team('C')} away={team('D')} competition="Liga" kickoff="dom" />
      </SafeAreaProvider>,
    );
    const json = JSON.stringify(view.toJSON());
    const ids = [...json.matchAll(/"id":"(matchCardGrad[^"]*)"/g)].map((m) => m[1] as string);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
      expect(json).toContain(`url(#${id})`);
    }
  });
});
