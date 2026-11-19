// Figma V7.1: folhas modais escuras 4941:7718 (21b "Folha · password") e 4953:9206 (48b "Folha · Ativar Face ID"): fundo
// bg-raised, raio 28 em cima, grabber 36x5 (surface-20) à esquerda a 12 do topo, padding 24, 40 em baixo (34 do indicador
// de início + 6), elementos a 16 ou 20, por cima de um fundo escurecido. É um Modal (não a `Sheet`: a `Sheet` tem altura
// fixa e gesto de arrastar, e estas folhas têm de subir com o teclado e só se fecham pelos botões).
import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, space } from '@/theme/tokens';

export function ModalSheet({
  onClose,
  gap = 'normal',
  children,
}: {
  onClose: () => void;
  gap?: 'normal' | 'loose';
  children: ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: layout.lockScrim }}>
        <View
          testID="modal-sheet"
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.bgRaised,
            borderTopLeftRadius: radii.r28,
            borderTopRightRadius: radii.r28,
            paddingTop: space.s12,
            paddingHorizontal: space.s24,
            paddingBottom: Math.max(bottom, layout.homeIndicator) + layout.modalSheetBottomExtra,
            gap: gap === 'loose' ? layout.modalSheetGapLoose : layout.modalSheetGap,
          }}
        >
          <View
            testID="modal-sheet-grabber"
            style={{
              width: layout.grabberWidth,
              height: layout.grabberHeight,
              borderRadius: layout.grabberHeight / 2,
              backgroundColor: colors.surface20,
            }}
          />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
