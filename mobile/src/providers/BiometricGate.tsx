// Figma: ecrã de bloqueio segue o frame 348:37997 (secção 310:9622, "PIN Code") SEM o teclado e os pontos do PIN:
// logótipo 565:21545 (DIN 48, "S" verde) a 77px do topo, texto a 144px, leão "image 2" 348:37998 ao fundo.
// Os botões ocupam o lugar do teclado e seguem o par de botões do Welcome (564:7259 / 564:7261).
// Os anéis (Group 1743, 348:38000) ficam de fora: são 72 elipses mascaradas e não há asset equivalente no projeto
// (o SVG do Welcome tem outra escala). A validar com o Martim.
// SEM FIGMA: a folha "Ativar {label}?" (modal feito com tokens) e o estado "não foi possível desbloquear".
import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { shouldLock } from '@/lib/biometricPolicy';
import { useSession } from '@/providers/SessionProvider';
import { signOut } from '@/services/auth';
import {
  type BiometricLabel,
  biometricLabel,
  biometricStatus,
  hasBiometricPromptAnswered,
  isBiometricEnabled,
  setBiometricEnabled,
  setBiometricPromptAnswered,
  unlock,
} from '@/services/biometrics';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LION = require('../../assets/images/lock-lion.png');

// "Arranque a frio" = primeira avaliação desde que o bundle JS arrancou. Vive no módulo (não no componente)
// para sobreviver a remontagens do layout; é gasto na primeira avaliação.
let coldStartPending = true;

/** Chamar quando se observa signedOut: um login novo nesta sessão do bundle nunca conta como arranque a frio. */
export function markFreshSession(): void {
  coldStartPending = false;
}
export function resetBiometricGateForTests(): void {
  coldStartPending = true;
}

type Phase = 'checking' | 'locked' | 'open';

export function BiometricGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const [phase, setPhase] = useState<Phase>('checking');
  const [everOpen, setEverOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [label, setLabel] = useState<BiometricLabel>('biometria');
  const [askEnable, setAskEnable] = useState(false);

  const uidRef = useRef(uid);
  uidRef.current = uid;
  const mounted = useRef(true);
  const evaluatedFor = useRef<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingPrompt = useRef(false);
  const promptChecked = useRef(false);

  const open = useCallback(() => {
    setPhase('open');
    setEverOpen(true);
    setFailed(false);
  }, []);

  // Só pede biometria com a app `active`. O diálogo do Face ID põe o estado em `inactive`: não é background.
  const attempt = useCallback(async () => {
    if (inFlight.current) return;
    if (AppState.currentState !== 'active') {
      pendingPrompt.current = true;
      return;
    }
    pendingPrompt.current = false;
    inFlight.current = true;
    setFailed(false);
    let ok = false;
    try {
      ok = await unlock();
    } finally {
      inFlight.current = false;
    }
    if (!mounted.current) return;
    if (ok) open();
    else setFailed(true);
  }, [open]);

  const evaluate = useCallback(
    async (coldStart: boolean) => {
      const id = uidRef.current;
      if (!id) return;
      const enabled = await isBiometricEnabled(id);
      const lock = shouldLock({ enabled, signedIn: true, coldStart, backgroundedAt: backgroundedAt.current, now: Date.now() });
      backgroundedAt.current = null;
      if (!mounted.current) return;
      if (!lock) {
        if (coldStart) open();
        return;
      }
      // Review Focus 3: ligada mas a biometria deixou de estar disponível (ex.: dedos removidos): desliga e deixa entrar.
      if ((await biometricStatus()) !== 'available') {
        await setBiometricEnabled(id, false).catch(() => {});
        if (mounted.current) open();
        return;
      }
      if (!mounted.current) return;
      setPhase('locked');
      void attempt();
    },
    [attempt, open],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    biometricLabel().then((l) => mounted.current && setLabel(l), () => {});
  }, []);

  // Primeira avaliação por uid (a guarda por ref torna o efeito idempotente em StrictMode).
  useEffect(() => {
    if (!uid || evaluatedFor.current === uid) return;
    evaluatedFor.current = uid;
    const cold = coldStartPending;
    coldStartPending = false;
    void evaluate(cold);
  }, [uid, evaluate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        backgroundedAt.current = Date.now();
      } else if (s === 'active') {
        if (pendingPrompt.current) void attempt();
        else if (backgroundedAt.current !== null && evaluatedFor.current) void evaluate(false);
      }
    });
    return () => sub.remove();
  }, [attempt, evaluate]);

  // Folha "Ativar {label}?": uma vez por uid, depois de a app abrir sem bloqueio.
  useEffect(() => {
    if (phase !== 'open' || !uid || promptChecked.current) return;
    promptChecked.current = true;
    (async () => {
      if ((await biometricStatus()) !== 'available') return;
      if (await isBiometricEnabled(uid)) return;
      if (await hasBiometricPromptAnswered(uid)) return;
      if (mounted.current) setAskEnable(true);
    })().catch(() => {});
  }, [phase, uid]);

  const answerPrompt = async (enable: boolean) => {
    setAskEnable(false);
    if (!uid) return;
    if (enable) await setBiometricEnabled(uid, true).catch(() => {});
    await setBiometricPromptAnswered(uid);
  };

  const otherAccount = async () => {
    const id = uid;
    setLeaving(true);
    try {
      await signOut();
    } catch {
      if (mounted.current) setLeaving(false);
      return;
    }
    if (id) await setBiometricEnabled(id, false).catch(() => {});
  };

  const covered = phase !== 'open';
  return (
    <View style={styles.fill}>
      {everOpen ? (
        <View
          style={styles.fill}
          accessibilityElementsHidden={covered}
          importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
      ) : null}
      {covered ? (
        <LockScreen
          label={label}
          ready={phase === 'locked'}
          failed={failed}
          busy={leaving}
          onUnlock={() => void attempt()}
          onOtherAccount={() => void otherAccount()}
        />
      ) : null}
      {askEnable && phase === 'open' ? (
        <EnablePrompt label={label} onEnable={() => void answerPrompt(true)} onLater={() => void answerPrompt(false)} />
      ) : null}
    </View>
  );
}

function LockScreen({
  label,
  ready,
  failed,
  busy,
  onUnlock,
  onOtherAccount,
}: {
  label: BiometricLabel;
  ready: boolean;
  failed: boolean;
  busy: boolean;
  onUnlock: () => void;
  onOtherAccount: () => void;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const paddingTop = Math.max(top, layout.statusBarHeight) + (layout.lockLogoTop - layout.statusBarHeight);
  const paddingBottom = Math.max(bottom, layout.homeIndicator) + layout.lockBottom;
  return (
    <View testID="lock-screen" accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <View pointerEvents="none" style={[styles.lion, layout.lockLion]}>
        <Image source={LION} accessible={false} contentFit="fill" style={[styles.lionImage, layout.lockLionImage]} />
      </View>
      <View style={{ paddingTop, alignItems: 'center' }}>
        <Text style={type.lockLogo} accessibilityRole="header" accessibilityLabel="S360">
          <Text style={{ color: colors.primary }}>S</Text>360
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={[type.authIntro, { width: layout.lockHintWidth, textAlign: 'center', marginTop: layout.lockHintGap }]}
        >
          {failed ? 'Não foi possível desbloquear.' : 'A S360 está bloqueada.'}
        </Text>
      </View>
      {ready ? (
        <View
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.authX, paddingBottom, gap: layout.lockButtonsGap }}
        >
          <PrimaryButton label={failed ? 'Tentar outra vez' : `Desbloquear com ${label}`} onPress={onUnlock} disabled={busy} />
          <PrimaryButton label="Entrar com outra conta" variant="secondary" onPress={onOtherAccount} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}

function EnablePrompt({ label, onEnable, onLater }: { label: BiometricLabel; onEnable: () => void; onLater: () => void }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onLater}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: layout.lockScrim }}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            padding: layout.lockModalPad,
            paddingBottom: Math.max(bottom, layout.homeIndicator) + layout.lockBottom,
            gap: layout.lockModalGap,
          }}
        >
          <Text style={type.screenTitle} accessibilityRole="header">{`Ativar ${label}?`}</Text>
          <Text style={type.authIntro}>{`Usa ${label} para abrir a S360 mais depressa, sem escreveres a palavra-passe.`}</Text>
          <PrimaryButton label="Ativar" onPress={onEnable} />
          <PrimaryButton label="Agora não" variant="secondary" onPress={onLater} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lion: { position: 'absolute', overflow: 'hidden' },
  lionImage: { position: 'absolute' },
});
