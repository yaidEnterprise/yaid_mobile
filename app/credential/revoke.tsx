import { useEffect, useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { RevokeCredentialPresenter } from '../../src/modules/credential/app/revoke_credential_presenter';
import { CheckCredentialPresenter } from '../../src/modules/credential/app/check_credential_presenter';

type Step =
  | { kind: 'checking' }
  | { kind: 'no-credential' }
  | { kind: 'pin' }
  | { kind: 'confirming' }
  | { kind: 'loading' }
  | { kind: 'success'; revokedAt: string; credentialType: string }
  | { kind: 'error'; message: string };

function formatRemainingMinutes(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

export default function RevokeCredentialScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [sessionPin, setSessionPin] = useState<string | null>(null);

  useEffect(() => {
    async function checkCredential() {
      const controller = CheckCredentialPresenter();
      const result = await controller.execute({});
      setStep(result.exists ? { kind: 'pin' } : { kind: 'no-credential' });
    }
    checkCredential();
  }, []);

  function leave() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  async function runRevocation(pin: string) {
    setStep({ kind: 'loading' });
    const controller = RevokeCredentialPresenter();
    const result = await controller.execute({ pin });

    if (result.ok) {
      setStep({ kind: 'success', revokedAt: result.revokedAt, credentialType: result.credentialType });
      return;
    }

    if (result.kind === 'pin_wrong') {
      setSessionPin(null);
      setStep({ kind: 'pin' });
      setPinInput('');
      setPinMessage(`Senha incorreta. Restam ${result.attemptsRemaining} tentativas — tente novamente.`);
      return;
    }

    if (result.kind === 'pin_backoff') {
      setSessionPin(null);
      setStep({ kind: 'pin' });
      setPinInput('');
      setPinLocked(true);
      setPinMessage(
        `Muitas tentativas incorretas. Aguarde ${formatRemainingMinutes(result.lockedUntilMs ?? 0)} minutos para tentar novamente.`,
      );
      return;
    }

    // no_credential / clock_skew / network_error / api_error — all named, retryable failures
    setStep({ kind: 'error', message: result.message });
  }

  async function handlePinChange(rawText: string) {
    const digits = rawText.replace(/[^0-9]/g, '').slice(0, 6);
    setPinInput(digits);

    if (digits.length !== 6) {
      return;
    }

    setSessionPin(digits);
    setPinInput('');
    setPinMessage(null);
    setStep({ kind: 'confirming' });
  }

  function handleConfirm() {
    if (sessionPin === null) {
      return;
    }
    runRevocation(sessionPin);
  }

  function handleBack() {
    setSessionPin(null);
    setStep({ kind: 'pin' });
  }

  function handleRetry() {
    if (sessionPin === null) {
      setStep({ kind: 'pin' });
      return;
    }
    setStep({ kind: 'confirming' });
  }

  if (step.kind === 'checking') {
    return <SafeAreaView style={styles.container} />;
  }

  if (step.kind === 'no-credential') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Não há credencial a revogar
        </Text>
        <Text style={styles.paragraph}>
          Você ainda não tem uma credencial comprovada neste aparelho.
        </Text>
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.exitButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step.kind === 'pin') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <Text style={styles.title} accessibilityRole="header">
          Digite sua senha
        </Text>
        <TextInput
          style={styles.input}
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
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Sair">
          <Text style={styles.exitButtonText}>Sair</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step.kind === 'confirming') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <Text style={styles.title} accessibilityRole="header">
          Revogar credencial
        </Text>
        <Text style={styles.paragraph}>
          Essa ação é permanente e não pode ser desfeita. Depois de revogada, sua credencial deixa
          de valer e você precisará comprovar seu documento de novo para ter uma nova.
        </Text>
        <Pressable
          style={styles.button}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="Confirmar revogação"
        >
          <Text style={styles.buttonText}>Confirmar revogação</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step.kind === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <Text style={styles.title} accessibilityRole="header">
          Revogando sua credencial
        </Text>
        <Text style={styles.paragraph}>Isso pode levar alguns instantes.</Text>
      </SafeAreaView>
    );
  }

  if (step.kind === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Credencial revogada
        </Text>
        <Text style={styles.paragraph}>
          Sua credencial ({step.credentialType}) foi invalidada em {step.revokedAt}. Ela não pode
          mais ser usada para confirmar sua identidade.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Concluir"
        >
          <Text style={styles.buttonText}>Concluir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // step.kind === 'error'
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Não foi possível revogar sua credencial
      </Text>
      <Text style={styles.message} accessibilityLiveRegion="polite">
        {step.message} Sua credencial não foi alterada.
      </Text>
      <Pressable
        style={styles.button}
        onPress={handleRetry}
        accessibilityRole="button"
        accessibilityLabel="Tentar de novo"
      >
        <Text style={styles.buttonText}>Tentar de novo</Text>
      </Pressable>
      <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Sair">
        <Text style={styles.exitButtonText}>Sair</Text>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
    minWidth: 160,
    minHeight: 44,
    paddingVertical: 12,
  },
  message: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  exitButtonText: {
    marginTop: 20,
    fontSize: 15,
    color: '#4A4A4A',
  },
});
