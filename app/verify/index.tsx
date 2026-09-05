import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { GetProofSessionPresenter } from '../../src/modules/proof-session/app/get_proof_session_presenter';
import { CancelProofSessionPresenter } from '../../src/modules/proof-session/app/cancel_proof_session_presenter';
import { PresentProofPresenter } from '../../src/modules/presentation/app/present_proof_presenter';
import { GetProofSessionScreenResult } from '../../src/modules/proof-session/app/get_proof_session_controller';

type Step =
  | 'arrival'
  | 'no_connection'
  | 'decision'
  | 'ineligible'
  | 'needs_identity'
  | 'needs_credential'
  | 'pin'
  | 'submitting'
  | 'verified'
  | 'refused'
  | 'expired'
  | 'failed'
  | 'clock_skew';

const BUTTON_INERT_MS = 400;

function formatRemainingMinutes(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

export default function VerifySessionScreen() {
  const router = useRouter();
  const { session: sessionToken } = useLocalSearchParams<{ session: string }>();

  const [step, setStep] = useState<Step>('arrival');
  const [companyName, setCompanyName] = useState('');
  const [proofTypeLabel, setProofTypeLabel] = useState('');
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [verifiedAtLabel, setVerifiedAtLabel] = useState('');

  const buttonsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSession = useCallback(async (): Promise<GetProofSessionScreenResult | null> => {
    if (typeof sessionToken !== 'string') {
      return null;
    }
    try {
      const controller = GetProofSessionPresenter();
      return await controller.execute({ sessionToken });
    } catch {
      return null;
    }
  }, [sessionToken]);

  const applySessionResult = useCallback((result: GetProofSessionScreenResult | null) => {
    if (result === null) {
      setStep('no_connection');
      return;
    }

    if (result.kind === 'success') {
      setCompanyName(result.companyName);
      setProofTypeLabel(result.proofTypeLabel);
      setStep('decision');
      setButtonsEnabled(false);
      if (buttonsTimerRef.current !== null) {
        clearTimeout(buttonsTimerRef.current);
      }
      buttonsTimerRef.current = setTimeout(() => setButtonsEnabled(true), BUTTON_INERT_MS);
      return;
    }

    if (result.kind === 'needs_identity') {
      setCompanyName(result.companyName);
      setStep('needs_identity');
      return;
    }

    if (result.kind === 'needs_credential') {
      setCompanyName(result.companyName);
      setStep('needs_credential');
      return;
    }

    if (result.kind === 'ineligible') {
      setStep('ineligible');
      return;
    }

    setStep('expired');
  }, []);

  useEffect(() => {
    (async () => {
      const result = await fetchSession();
      applySessionResult(result);
    })();
    return () => {
      if (buttonsTimerRef.current !== null) {
        clearTimeout(buttonsTimerRef.current);
      }
    };
  }, [fetchSession, applySessionResult]);

  useEffect(() => {
    if (step !== 'decision') {
      return;
    }
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') {
        return;
      }
      setButtonsEnabled(false);
      const result = await fetchSession();
      applySessionResult(result);
    });
    return () => subscription.remove();
  }, [step, fetchSession, applySessionResult]);

  async function handleRetry() {
    setStep('arrival');
    const result = await fetchSession();
    applySessionResult(result);
  }

  function handleAuthorize() {
    setPinInput('');
    setPinMessage(null);
    setPinLocked(false);
    setStep('pin');
  }

  async function handleRefuse() {
    if (typeof sessionToken !== 'string') {
      return;
    }
    const controller = CancelProofSessionPresenter();
    await controller.execute({ sessionToken });
    setStep('refused');
  }

  async function handlePinChange(rawText: string) {
    const digits = rawText.replace(/[^0-9]/g, '').slice(0, 6);
    setPinInput(digits);

    if (digits.length !== 6 || typeof sessionToken !== 'string') {
      return;
    }

    setStep('submitting');
    const controller = PresentProofPresenter();
    const result = await controller.execute({ pin: digits, sessionToken });

    if (result.kind === 'success') {
      setVerifiedAtLabel(result.verifiedAtLabel);
      setStep('verified');
      return;
    }

    if (result.kind === 'wrong_pin') {
      setPinInput('');
      setPinMessage(`Senha incorreta. Restam ${result.attemptsRemaining} tentativas — tente novamente.`);
      setStep('pin');
      return;
    }

    if (result.kind === 'locked') {
      setPinInput('');
      setPinLocked(true);
      setPinMessage(
        `Muitas tentativas incorretas. Aguarde ${formatRemainingMinutes(result.lockedUntilMs)} minutos para tentar novamente.`,
      );
      setStep('pin');
      return;
    }

    if (result.kind === 'clock_skew') {
      setStep('clock_skew');
      return;
    }

    setStep('failed');
  }

  function goHome() {
    router.replace('/');
  }

  if (step === 'arrival') {
    return <SafeAreaView style={styles.container} />;
  }

  if (step === 'no_connection') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Sem conexão
        </Text>
        <Text style={styles.paragraph}>Não foi possível carregar o pedido.</Text>
        <Pressable style={styles.button} onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Tentar de novo">
          <Text style={styles.buttonText}>Tentar de novo</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'needs_identity') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {companyName}
        </Text>
        <Text style={styles.paragraph}>
          Para responder a esse pedido, conclua o primeiro uso antes. Volte ao site da empresa
          depois.
        </Text>
        <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Entendi">
          <Text style={styles.buttonText}>Entendi</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'needs_credential') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {companyName}
        </Text>
        <Text style={styles.paragraph}>
          Para responder a esse pedido, verifique o documento antes. Volte ao site da empresa
          depois.
        </Text>
        <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Entendi">
          <Text style={styles.buttonText}>Entendi</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'ineligible') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {companyName}
        </Text>
        <Text style={styles.paragraph}>
          A {companyName} quer confirmar que {proofTypeLabel}. Sua verificação YaID indica que
          não. Você pode recusar este pedido.
        </Text>
        <Pressable style={styles.button} onPress={handleRefuse} accessibilityRole="button" accessibilityLabel="Recusar">
          <Text style={styles.buttonText}>Recusar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'decision') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <Text style={styles.companyName} accessibilityRole="header">
          {companyName}
        </Text>
        <Text style={styles.question}>{`A empresa quer confirmar: ${proofTypeLabel}`}</Text>
        <Text style={styles.privacyNote}>
          A empresa recebe apenas sim ou não. Nenhum dado seu é enviado.
        </Text>
        <Pressable
          style={styles.decisionButton}
          onPress={handleAuthorize}
          disabled={!buttonsEnabled}
          accessibilityRole="button"
          accessibilityLabel="Autorizar"
        >
          <Text style={styles.buttonText}>Autorizar</Text>
        </Pressable>
        <Pressable
          style={styles.decisionButton}
          onPress={handleRefuse}
          disabled={!buttonsEnabled}
          accessibilityRole="button"
          accessibilityLabel="Recusar"
        >
          <Text style={styles.buttonText}>Recusar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'pin') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <Text style={styles.title} accessibilityRole="header">
          Digite sua senha
        </Text>
        <TextInput
          style={styles.pinInput}
          value={pinInput}
          onChangeText={handlePinChange}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          editable={!pinLocked}
          autoFocus
          accessibilityLabel="Senha de 6 dígitos"
        />
        {pinMessage !== null ? (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {pinMessage}
          </Text>
        ) : null}
      </SafeAreaView>
    );
  }

  if (step === 'submitting') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.paragraph}>Enviando sua resposta com segurança...</Text>
      </SafeAreaView>
    );
  }

  if (step === 'verified') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={[styles.title, styles.verifiedText]} accessibilityRole="header">
          Verificado
        </Text>
        <Text style={styles.paragraph}>Pronto. A empresa recebeu sua resposta.</Text>
        <Text style={styles.paragraph}>{verifiedAtLabel}</Text>
        <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Concluir">
          <Text style={styles.buttonText}>Concluir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'refused') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={[styles.title, styles.refusedText]} accessibilityRole="header">
          Recusado
        </Text>
        <Text style={styles.paragraph}>Você recusou. Nada foi enviado.</Text>
        <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Concluir">
          <Text style={styles.buttonText}>Concluir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'expired') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={[styles.title, styles.expiredText]} accessibilityRole="header">
          Expirado
        </Text>
        <Text style={styles.paragraph}>Este pedido expirou. Peça um novo à empresa.</Text>
        <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Concluir">
          <Text style={styles.buttonText}>Concluir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'clock_skew') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={[styles.title, styles.failedText]} accessibilityRole="header">
          Falhou
        </Text>
        <Text style={styles.paragraph}>
          A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo.
        </Text>
        <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Concluir">
          <Text style={styles.buttonText}>Concluir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.title, styles.failedText]} accessibilityRole="header">
        Falhou
      </Text>
      <Text style={styles.paragraph}>
        Não foi possível concluir. Comece de novo pelo site da empresa.
      </Text>
      <Pressable style={styles.button} onPress={goHome} accessibilityRole="button" accessibilityLabel="Concluir">
        <Text style={styles.buttonText}>Concluir</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  companyName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  question: {
    fontSize: 18,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  privacyNote: {
    fontSize: 13,
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 32,
  },
  paragraph: {
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    marginTop: 20,
    fontSize: 15,
    color: '#B00020',
    textAlign: 'center',
  },
  pinInput: {
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
    minWidth: 160,
    minHeight: 44,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  decisionButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 56,
    minWidth: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedText: {
    color: '#0A7D30',
  },
  refusedText: {
    color: '#6A6A6A',
  },
  expiredText: {
    color: '#B36B00',
  },
  failedText: {
    color: '#B00020',
  },
});
