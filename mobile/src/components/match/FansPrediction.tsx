// Plano 10 · Figma 52a (antes do jogo: título e "1.234 PALPITES", centrados), 52b e 52c (ao vivo e terminado:
// vitória/empate/derrota em %, com barra, a maior a verde). Regras em lib/fansPrediction (Martim, 20/11): abaixo de
// 50 palpites não aparece nada; as percentagens só ao apito inicial. Sem legendas explicativas.
import { View } from 'react-native';
import type { Match } from '@/data/schemas';
import { useFansPrediction } from '@/data/sports';
import { fansView, thousandsPt } from '@/lib/fansPrediction';
import { uiState } from '@/lib/matchVM';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const TITLE = 'Previsão dos sportinguistas';
const LABELS = ['Vitória', 'Empate', 'Derrota'] as const;

export function FansPrediction({ match }: { match: Match }) {
  const doc = useFansPrediction(match.id);
  const view = fansView(doc.status === 'ready' ? doc.data : null, uiState(match.status));
  if (!view) return null;
  return (
    <View testID="fans-prediction" style={{ alignItems: 'center', gap: space.s12 }}>
      <Text71 variant="eyebrow13" color="textSubtle" accessibilityRole="header">
        {TITLE}
      </Text71>
      {view.kind === 'count' ? (
        <View accessible accessibilityLabel={`${thousandsPt(view.total)} palpites`} style={{ alignItems: 'center', gap: space.s4 }}>
          <Text71 variant="display40">{thousandsPt(view.total)}</Text71>
          <Text71 variant="eyebrow13" color="textSubtle">
            Palpites
          </Text71>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignSelf: 'stretch', gap: space.s8 }}>
          {view.percents.map((pct, i) => {
            const top = i === view.top;
            return (
              <View
                key={LABELS[i]}
                testID={`fans-col-${i}`}
                accessible
                accessibilityLabel={`${LABELS[i]} ${pct}%`}
                style={{ flex: 1, alignItems: 'center', gap: space.s8 }}
              >
                <Text71 variant="title24" color={top ? 'primaryOnDark' : 'white'}>{`${pct}%`}</Text71>
                <View
                  style={{
                    alignSelf: 'stretch',
                    height: layout.statBarHeight,
                    borderRadius: layout.statBarHeight / 2,
                    backgroundColor: colors.surface10,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: layout.statBarHeight / 2,
                      backgroundColor: top ? colors.primary : colors.textSubtle,
                    }}
                  />
                </View>
                <Text71 variant="eyebrow13" color="textSubtle">
                  {LABELS[i]}
                </Text71>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
