// SEM FIGMA: linhas dos ecrãs da equipa e do jogador (Task 14), compostas com tokens à maneira das linhas dos tops
// da competição (Task 13): coluna fixa opcional (número em DIN 20), foto redonda de 32 px (círculo surface10 sem
// foto), nome numa linha com reticências (`tableTeam`) e, por baixo, uma linha a muted (`rowTeam`); divisória de
// 1 px a 20 % entre linhas. `TextRow`: texto à esquerda com reticências e valor à direita que não encolhe.
// `SectionError`: erro compacto de uma secção secundária (body a muted, centrado), sem esconder o resto do ecrã.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Image } from 'expo-image';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export function RowSeparator() {
  return <View style={{ height: layout.separator, backgroundColor: colors.surface20 }} />;
}

export function Avatar({ photo, testID }: { photo: string | null; testID?: string }) {
  const box = { width: layout.avatarSize, height: layout.avatarSize, borderRadius: radius.pill, flexShrink: 0 } as const;
  if (!photo) return <View testID={testID} style={{ ...box, backgroundColor: colors.surface10 }} />;
  return (
    <Image
      testID={testID}
      source={{ uri: photo }}
      contentFit="cover"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={box}
    />
  );
}

/** Pessoa (jogador ou treinador): número opcional, foto, nome e linha secundária; tocável quando há `onPress`. */
export function PersonRow({
  testID,
  label,
  number,
  photo,
  name,
  detail,
  right,
  onPress,
}: {
  testID?: string;
  /** Rótulo de acessibilidade da linha inteira. */
  label: string;
  number?: number | null;
  photo: string | null;
  name: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      {number !== undefined ? (
        <Display variant="tableValue" numberOfLines={1} style={{ width: layout.subNumberWidth, flexShrink: 0, textAlign: 'center' }}>
          {number === null ? '' : String(number)}
        </Display>
      ) : null}
      <Avatar photo={photo} />
      <View style={{ flex: 1 }}>
        <Body variant="tableTeam" numberOfLines={1} ellipsizeMode="tail">
          {name}
        </Body>
        {detail ? (
          <Body variant="rowTeam" numberOfLines={1} ellipsizeMode="tail" style={{ opacity: layout.mutedOpacity }}>
            {detail}
          </Body>
        ) : null}
      </View>
      {right}
    </>
  );
  const style = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.tableNameGap,
    minHeight: layout.rankingRowMinHeight,
  } as const;
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Touchable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={style}
    >
      {content}
    </Touchable>
  );
}

/** Texto à esquerda (uma linha, reticências) e valor à direita; o rótulo de acessibilidade é "texto: valor". */
export function TextRow({ left, right }: { left: string; right: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${left}: ${right}`}
      style={{
        minHeight: layout.minTouch,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Body variant="body" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1 }}>
        {left}
      </Body>
      <Body variant="body" style={{ flexShrink: 0, textAlign: 'right', opacity: layout.mutedOpacity }}>
        {right}
      </Body>
    </View>
  );
}

export const SECTION_ERROR = 'Não foi possível carregar esta secção.';

/** Erro de uma secção cujo documento falhou; o conteúdo principal do ecrã continua visível. */
export function SectionError() {
  return (
    <Body variant="body" accessibilityRole="alert" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>
      {SECTION_ERROR}
    </Body>
  );
}
