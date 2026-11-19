// Figma V7.1: folhas modais escuras 4941:7718 (21b "Folha · password") e 4953:9206 (48b "Folha · Ativar Face ID"): fundo
// bg-raised, raio 28 em cima, grabber 36x5 (surface-20) à esquerda a 12 do topo, padding 24, 40 em baixo (34 do indicador
// de início + 6), elementos a 16 (48b), 20 (21b) ou 14 (45Lb, 45Le, com o título a 28 do topo), por cima de um fundo escurecido.
// Os três ritmos existem, um por família de frames, porque os frames realmente diferem e o quadro de componentes 4918:5041 não
// tem folha que decida. É um Modal (não a `Sheet`: a `Sheet` tem altura
// fixa e gesto de arrastar, e estas folhas têm de subir com o teclado e só se fecham pelos botões).
import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, space } from '@/theme/tokens';

export function ModalSheet({
  onClose,
  gap = 'normal',
  grabber = 'left',
  children,
}: {
  onClose: () => void;
  gap?: 'normal' | 'loose' | 'tight';
  /** Grabber à esquerda (21b, 48b) ou ao centro (folhas de confirmação e partilha do jogo, 4946:8195). */
  grabber?: 'left' | 'center';
  children: ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();
  const rhythm = gap === 'loose' ? layout.modalSheetGapLoose : gap === 'tight' ? layout.modalSheetGapTight : layout.modalSheetGap;
  // `tight`: o título fica a 28 do topo (grabber de 12 a 17, depois 11), não a 17 + 14.
  const grabberMargin = gap === 'tight' ? layout.modalSheetTitleTop - (space.s12 + layout.grabberHeight) - rhythm : 0;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrimV71 }}>
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
            gap: rhythm,
          }}
        >
          <View
            testID="modal-sheet-grabber"
            style={{
              alignSelf: grabber === 'center' ? 'center' : 'flex-start',
              width: layout.grabberWidth,
              height: layout.grabberHeight,
              borderRadius: layout.grabberHeight / 2,
              backgroundColor: colors.surface20,
              marginBottom: grabberMargin,
            }}
          />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
