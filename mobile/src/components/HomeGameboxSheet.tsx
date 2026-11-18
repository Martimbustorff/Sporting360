// Figma: nó 564:6981 (folha GameBox recolhida, título "GameBox Digital"); na Home 1561:5164.
// Task 5: só a folha com o título. O conteúdo (QR, Estádio/Pavilhão 450:5419, vazio 348:39454) vem na Task 24.
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '@/components/Sheet';
import { layout } from '@/theme/tokens';

/** Altura visível da folha recolhida: padding, linha do título e a zona do indicador home. */
export function useGameboxSheetCollapsedHeight(): number {
  const { bottom } = useSafeAreaInsets();
  return layout.sheetPadYCollapsed + layout.minTouch + Math.max(bottom, layout.homeIndicator);
}

// `uid` é usado pela Task 24 para ler as GameBox do utilizador.
export function HomeGameboxSheet(_props: { uid: string }) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const collapsedHeight = useGameboxSheetCollapsedHeight();
  return (
    <Sheet
      title="GameBox Digital"
      collapsedHeight={collapsedHeight}
      expandedHeight={Math.max(collapsedHeight, Math.round(height * layout.homeSheetExpandedRatio))}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
