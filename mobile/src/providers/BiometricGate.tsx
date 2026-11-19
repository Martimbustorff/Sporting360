// Figma V7.1: ecrã de bloqueio 4953:9027 (48 Bloqueio) e folha 4953:9206 (48b Ativar Face ID). O fundo é o "Home backdrop"
// (LionBackdrop: leão a 62 %, anéis, verde bg-tint a 60 % e esbatido em baixo); logo "S360" DIN Condensed 68 centrado a 48 pt
// da barra de estado, frase Body 14 a 22 pt do logo, e os botões em baixo a 12: "Desbloquear com {label}" (Branco) e
// "Entrar com outra conta" (Contorno). A folha 48b é a ModalSheet escura com o ícone, o título Title S 20, o texto
// Body Light a 70 % e "Ativar" (Branco) / "Agora não" (Contorno).
// SEM FIGMA: o estado "não foi possível desbloquear" usa a mesma frase no lugar de "A S360 está bloqueada." (nota do frame).
// Task 26 (Plano 4): `useBiometricControl` dá às Definições o estado e o interruptor. Ligar pede logo o Face ID (como
// "Ativar"); ligar e desligar mudam `enabledRef` de imediato, sem esperar pelo próximo arranque.
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LionBackdrop } from '@/components/LionBackdrop';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { shouldLock } from '@/lib/biometricPolicy';
import { consumeColdStart } from '@/lib/lockSession';
import { useSession } from '@/providers/SessionProvider';
import { signOut } from '@/services/auth';
import {
  type BiometricLabel,
  type BiometricStatus,
  biometricLabel,
  biometricStatus,
  hasBiometricPromptAnswered,
  isBiometricEnabled,
  setBiometricEnabled,
  setBiometricPromptAnswered,
  unlock,
} from '@/services/biometrics';
import { Text71 } from '@/theme/typography';
import { colors, layout, space, type } from '@/theme/tokens';

type Phase = 'checking' | 'locked' | 'open';

export type BiometricToggleResult = 'ok' | 'cancelled' | 'notEnrolled';
export type BiometricControl = {
  status: BiometricStatus;
  label: BiometricLabel;
  enabled: boolean;
  /** Ligar: só com biometria disponível e `unlock()` aceite. Desligar: vale já. Falha a gravar: rejeita. */
  setEnabled: (on: boolean) => Promise<BiometricToggleResult>;
};

const FALLBACK: BiometricControl = {
  status: 'noHardware',
  label: 'biometria',
  enabled: false,
  setEnabled: async () => 'notEnrolled',
};
const BiometricControlContext = createContext<BiometricControl>(FALLBACK);

/** Controlo da opção de desbloqueio (Definições). Fora do BiometricGate a opção aparece indisponível. */
export function useBiometricControl(): BiometricControl {
  return useContext(BiometricControlContext);
}

export function BiometricGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const [phase, setPhase] = useState<Phase>('checking');
  const [everOpen, setEverOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [label, setLabel] = useState<BiometricLabel>('biometria');
  const [askEnable, setAskEnable] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [status, setStatus] = useState<BiometricStatus>('error');
  const [enabled, setEnabledState] = useState(false);

  const uidRef = useRef(uid);
  uidRef.current = uid;
  const mounted = useRef(true);
  const evaluatedFor = useRef<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingPrompt = useRef(false);
  const promptChecked = useRef(false);
  // Cache em memória: permite bloquear de forma síncrona ao voltar do background (sem esperar pelo secure-store).
  const enabledRef = useRef<boolean | null>(null);
  const everOpenRef = useRef(false);

  // Ref (leitura síncrona no regresso do background) e estado (interruptor das Definições) sempre juntos.
  const markEnabled = useCallback((on: boolean) => {
    enabledRef.current = on;
    if (mounted.current) setEnabledState(on);
  }, []);
  const refreshStatus = useCallback(async () => {
    const s = await biometricStatus();
    if (mounted.current) setStatus(s);
    return s;
  }, []);

  const open = useCallback(() => {
    everOpenRef.current = true;
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

  // Opção ligada e é preciso bloquear: confirma que a biometria existe e pede-a.
  const lockOrOpen = useCallback(
    async (id: string) => {
      const status = await biometricStatus();
      if (!mounted.current) return;
      if (status === 'error') {
        // Falha nativa transitória: mantém a opção e deixa entrar sem pedir desta vez.
        open();
        return;
      }
      if (status !== 'available') {
        // Review Focus 3: ligada mas a biometria deixou de estar disponível: desliga e deixa entrar.
        markEnabled(false);
        await setBiometricEnabled(id, false).catch(() => {});
        if (mounted.current) open();
        return;
      }
      setPhase('locked');
      void attempt();
    },
    [attempt, open, markEnabled],
  );

  const evaluateStart = useCallback(
    async (coldStart: boolean) => {
      const id = uidRef.current;
      if (!id) return;
      const on = await isBiometricEnabled(id);
      markEnabled(on);
      const lock = shouldLock({ enabled: on, signedIn: true, coldStart, backgroundedAt: null, now: Date.now() });
      if (!mounted.current) return;
      if (!lock) {
        open();
        return;
      }
      await lockOrOpen(id);
    },
    [lockOrOpen, open, markEnabled],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    biometricLabel().then((l) => mounted.current && setLabel(l), () => {});
    refreshStatus().catch(() => {});
  }, [refreshStatus]);

  // Primeira avaliação por uid (a guarda por ref torna o efeito idempotente em StrictMode).
  useEffect(() => {
    if (!uid || evaluatedFor.current === uid) return;
    evaluatedFor.current = uid;
    void evaluateStart(consumeColdStart());
  }, [uid, evaluateStart]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') {
        if (s === 'background') backgroundedAt.current = Date.now();
        // Cobertura de privacidade (snapshot do seletor de apps do iOS): só se a app já abriu e a opção está ligada.
        if (everOpenRef.current && enabledRef.current) setPrivacy(true);
        return;
      }
      if (s !== 'active') return;
      setPrivacy(false);
      // A biometria pode ter sido configurada (ou retirada) nos ajustes do telemóvel entretanto.
      refreshStatus().catch(() => {});
      if (pendingPrompt.current) {
        void attempt();
        return;
      }
      const bg = backgroundedAt.current;
      const id = uidRef.current;
      if (bg === null || !id || !evaluatedFor.current) return;
      backgroundedAt.current = null;
      // Síncrono, antes de qualquer await: o conteúdo nunca aparece depois de `active`.
      if (shouldLock({ enabled: enabledRef.current === true, signedIn: true, coldStart: false, backgroundedAt: bg, now: Date.now() })) {
        setPhase('locked');
        void lockOrOpen(id);
      }
    });
    return () => sub.remove();
  }, [attempt, lockOrOpen, refreshStatus]);

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

  // "Ativar" pede o Face ID já (dispara a permissão do iOS) e só liga a opção se passar.
  const answerPrompt = async (enable: boolean) => {
    if (!uid) return;
    await setBiometricPromptAnswered(uid);
    if (enable) {
      inFlight.current = true;
      try {
        if (await unlock()) {
          await setBiometricEnabled(uid, true).catch(() => {});
          markEnabled(true);
        }
      } finally {
        inFlight.current = false;
      }
    }
    if (mounted.current) setAskEnable(false);
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
    markEnabled(false);
    if (id) await setBiometricEnabled(id, false).catch(() => {});
  };

  // Definições: ligar pede logo a biometria; desligar vale de imediato. A escolha conta como resposta à folha "Ativar".
  const setEnabled = useCallback(
    async (on: boolean): Promise<BiometricToggleResult> => {
      const id = uidRef.current;
      if (!id) return 'cancelled';
      if (!on) {
        markEnabled(false);
        await setBiometricPromptAnswered(id);
        await setBiometricEnabled(id, false);
        return 'ok';
      }
      const s = await refreshStatus();
      if (s === 'notEnrolled' || s === 'noHardware') return 'notEnrolled';
      if (s !== 'available' || inFlight.current) return 'cancelled';
      inFlight.current = true;
      let ok = false;
      try {
        ok = await unlock();
      } finally {
        inFlight.current = false;
      }
      if (!ok || uidRef.current !== id) return 'cancelled';
      await setBiometricPromptAnswered(id);
      await setBiometricEnabled(id, true);
      markEnabled(true);
      return 'ok';
    },
    [markEnabled, refreshStatus],
  );
  const control = useMemo<BiometricControl>(() => ({ status, label, enabled, setEnabled }), [status, label, enabled, setEnabled]);

  const covered = phase !== 'open' || privacy;
  return (
    <BiometricControlContext.Provider value={control}>
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
        {phase === 'checking' ? <Blank testID="lock-checking" /> : null}
        {phase === 'locked' ? (
          <LockScreen
            label={label}
            failed={failed}
            busy={leaving}
            onUnlock={() => void attempt()}
            onOtherAccount={() => void otherAccount()}
          />
        ) : null}
        {phase === 'open' && privacy ? <Blank testID="privacy-cover" /> : null}
        {askEnable && phase === 'open' ? (
          <EnablePrompt label={label} onEnable={() => void answerPrompt(true)} onLater={() => void answerPrompt(false)} />
        ) : null}
      </View>
    </BiometricControlContext.Provider>
  );
}

// Vista neutra, da cor do splash e sem texto: arranque (a verificar) e cobertura de privacidade.
function Blank({ testID }: { testID: string }) {
  return <View testID={testID} accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />;
}

function LockScreen({
  label,
  failed,
  busy,
  onUnlock,
  onOtherAccount,
}: {
  label: BiometricLabel;
  failed: boolean;
  busy: boolean;
  onUnlock: () => void;
  onOtherAccount: () => void;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const paddingTop = Math.max(top, layout.statusBarHeight) + layout.lockLogoOffset;
  const paddingBottom = Math.max(bottom, layout.homeIndicator) + layout.lockActionsBottom;
  return (
    <View testID="lock-screen" accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: colors.black }]}>
      <LionBackdrop />
      <View style={{ paddingTop, alignItems: 'center' }}>
        <Text style={type.lockLogo} accessibilityRole="header" accessibilityLabel="S360">
          <Text style={{ color: colors.primary }}>S</Text>360
        </Text>
        <Text71
          variant="body14"
          accessibilityLiveRegion="polite"
          style={{ textAlign: 'center', marginTop: layout.lockHintGapV71 }}
        >
          {failed ? 'Não foi possível desbloquear.' : 'A S360 está bloqueada.'}
        </Text71>
      </View>
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.s24, paddingBottom, gap: layout.lockButtonsGap }}
      >
        <PrimaryButton label={failed ? 'Tentar outra vez' : `Desbloquear com ${label}`} variant="white" onPress={onUnlock} disabled={busy} />
        <PrimaryButton label="Entrar com outra conta" variant="outline" onPress={onOtherAccount} disabled={busy} />
      </View>
    </View>
  );
}

function EnablePrompt({ label, onEnable, onLater }: { label: BiometricLabel; onEnable: () => void; onLater: () => void }) {
  return (
    <ModalSheet onClose={onLater}>
      <Ionicons
        name={label === 'Touch ID' || label === 'impressão digital' ? 'finger-print-outline' : 'scan-outline'}
        size={layout.modalSheetIcon}
        color={colors.white}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text71 variant="titleS20" accessibilityRole="header">{`Ativar ${label}?`}</Text71>
      <Text71 variant="bodyLight14" color="textMuted">{`Usa ${label} para abrir a S360 mais depressa, sem escreveres a palavra-passe.`}</Text71>
      <PrimaryButton label="Ativar" variant="white" onPress={onEnable} />
      <PrimaryButton label="Agora não" variant="outline" onPress={onLater} />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
