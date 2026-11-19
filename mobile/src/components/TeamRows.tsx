// Figma V7.1: linhas do plantel e dos troféus (4949:8312, 4949:8654): `PlayerPhoto` de 36 (com o número, não no treinador), nome em
// Strong 14, linha de apoio em Caption 12 text-subtle, etiqueta opcional (LESÃO, DÚVIDA, nº de troféus) e seta de 18 quando a linha
// abre; 9 pt em cima e em baixo, separador de 1 pt por baixo. Troféu do treinador: ícone 18 e texto Body 14 (4949:8668).
// SEM FIGMA: `TextRow` ainda com o valor à direita (troféus sem ícone), `SectionError` (erro compacto de uma secção, sem esconder
// o resto do ecrã) e `Loading` (esqueleto, 38c e 11c).
// Linhas só são botão com `onPress`; nomes numa linha com reticências, a etiqueta e a seta nunca encolhem.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { ScreenSkeleton, SkeletonRows } from '@/components/Skeleton';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TROPHY_ICON = require('../../assets/icons/trophy.svg');

const TAG_BG = {
  injury: colors.injuryBg,
  doubt: colors.yellow71Bg,
  count: colors.surface10,
  in: colors.primary,
  out: colors.surface20,
} as const;
const TAG_TEXT = { injury: 'danger', doubt: 'yellow71', count: 'white', in: 'white', out: 'white' } as const;

/** Etiqueta pequena (Badge 11, maiúsculas): LESÃO, DÚVIDA ou o número de troféus. */
export function Tag({ kind, text, testID }: { kind: keyof typeof TAG_BG; text: string; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        flexShrink: 0,
        paddingHorizontal: layout.tagPadX,
        paddingVertical: layout.tagPadY,
        borderRadius: layout.tagRadius,
        backgroundColor: TAG_BG[kind],
      }}
    >
      <Text71 variant="badge11" color={TAG_TEXT[kind]} numberOfLines={1}>{text}</Text71>
    </View>
  );
}

/** Pessoa (jogador ou treinador): foto com número opcional, nome e linha secundária; tocável quando há `onPress`. */
export function PersonRow({
  testID,
  label,
  number,
  photo,
  name,
  detail,
  tag,
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
  tag?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      <PlayerPhoto photo={photo} size={layout.personPhoto} number={number ?? null} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text71 variant="strong14" numberOfLines={1} ellipsizeMode="tail">{name}</Text71>
        {detail ? (
          <Text71 variant="caption12" color="textSubtle" numberOfLines={1} ellipsizeMode="tail">{detail}</Text71>
        ) : null}
      </View>
      {tag}
      {right}
      {onPress ? (
        <Feather name="chevron-right" size={layout.personArrow} color={colors.textSubtle} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
    </>
  );
  const style = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.personRowGap,
    paddingVertical: layout.personRowPadY,
    borderBottomWidth: layout.separator,
    borderBottomColor: colors.separator,
  } as const;
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Touchable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {content}
    </Touchable>
  );
}

/** Troféu do treinador: ícone (com `icon`) e texto; o rótulo de acessibilidade é "texto: valor" (o valor, quando há, fica à direita). */
export function TextRow({ left, right, icon = false }: { left: string; right?: string; icon?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={right ? `${left}: ${right}` : left}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.trophyGap,
        paddingVertical: layout.personRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      {icon ? (
        <Image
          testID="trophy-icon"
          source={TROPHY_ICON}
          contentFit="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ width: layout.trophyIcon, height: layout.trophyIcon }}
        />
      ) : null}
      <Text71 variant="body14" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{left}</Text71>
      {right ? (
        <Text71 variant="body14" color="textMuted" numberOfLines={1} style={{ flexShrink: 0, textAlign: 'right' }}>{right}</Text71>
      ) : null}
    </View>
  );
}

export const SECTION_ERROR = 'Não foi possível carregar esta secção.';

/** Erro de uma secção cujo documento falhou; o conteúdo principal do ecrã continua visível. */
export function SectionError() {
  return (
    <Text71 variant="caption12" color="textMuted" accessibilityRole="alert" style={{ textAlign: 'center' }}>
      {SECTION_ERROR}
    </Text71>
  );
}

/** Enquanto os dados chegam: o esqueleto do ecrã a carregar (38c 4994:12960, 11c 4994:13150). */
/** Esqueleto de ecrã inteiro (com a margem de 24 e 8 do cabeçalho): só para devolver no ecrã, nunca dentro de um scroll com margem. */
export const Loading = ({ testID }: { testID: string }) => <ScreenSkeleton testID={testID} />;
/** Esqueleto de uma secção dentro de um scroll que já tem a margem lateral. */
export const SectionLoading = ({ testID }: { testID: string }) => <SkeletonRows testID={testID} />;

