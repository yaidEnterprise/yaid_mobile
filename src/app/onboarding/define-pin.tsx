import { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DefinePinPresenter } from '../../modules/access/app/define_pin_presenter';

type Step = 'enter' | 'confirm';

export default function DefinePinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleChange(rawText: string) {
    const digits = rawText.replace(/[^0-9]/g, '').slice(0, 6);
    setInput(digits);

    if (digits.length !== 6) {
      return;
    }

    if (step === 'enter') {
      setFirstPin(digits);
      setInput('');
      setMessage(null);
      setStep('confirm');
      return;
    }

    const controller = DefinePinPresenter();
    const result = await controller.execute({ pin: firstPin, confirmation: digits });

    if (result.kind === 'success') {
      router.push('/onboarding/create-identity');
      return;
    }

    if (result.kind === 'mismatch') {
      setInput('');
      setMessage(result.message);
      return;
    }

    setFirstPin('');
    setInput('');
    setStep('enter');
    setMessage(result.message);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {step === 'enter' ? 'Crie sua senha de 6 dígitos' : 'Digite novamente para confirmar'}
      </Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={handleChange}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        autoFocus
        accessibilityLabel="Senha de 6 dígitos"
      />
      {message !== null ? (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
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
});
