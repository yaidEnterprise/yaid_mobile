import { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { VerifyPinPresenter } from '../modules/access/app/verify_pin_presenter';

function formatRemainingMinutes(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

export default function VerifyPinScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  function leave() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  async function handleChange(rawText: string) {
    const digits = rawText.replace(/[^0-9]/g, '').slice(0, 6);
    setInput(digits);

    if (digits.length !== 6) {
      return;
    }

    const controller = VerifyPinPresenter();
    const result = await controller.execute({ pin: digits });

    if (result.kind === 'success') {
      leave();
      return;
    }

    if (result.kind === 'wrong') {
      setInput('');
      setMessage(`Senha incorreta. Restam ${result.attemptsRemaining} tentativas — tente novamente.`);
      return;
    }

    if (result.kind === 'locked') {
      setInput('');
      setIsLocked(true);
      setMessage(
        `Muitas tentativas incorretas. Aguarde ${formatRemainingMinutes(result.remainingMs)} minutos para tentar novamente.`,
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <Text style={styles.title} accessibilityRole="header">
        Digite sua senha
      </Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={handleChange}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        editable={!isLocked}
        autoFocus
        accessibilityLabel="Senha de 6 dígitos"
      />
      {message !== null ? (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <Pressable
        style={styles.exitButton}
        onPress={leave}
        accessibilityRole="button"
        accessibilityLabel="Sair"
      >
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
    marginBottom: 24,
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
    marginTop: 20,
    fontSize: 15,
    color: '#B00020',
    textAlign: 'center',
  },
  exitButton: {
    marginTop: 32,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  exitButtonText: {
    fontSize: 15,
    color: '#4A4A4A',
  },
});
