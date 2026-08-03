import { useCallback, useEffect, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CreateIdentityPresenter } from '../../src/modules/identity/app/create_identity_presenter';

export default function CreateIdentityScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attemptCreation = useCallback(async () => {
    setErrorMessage(null);
    const controller = CreateIdentityPresenter();
    const result = await controller.execute({});

    if (result.kind === 'success') {
      router.replace('/');
      return;
    }

    setErrorMessage(result.message);
  }, [router]);

  useEffect(() => {
    attemptCreation();
  }, [attemptCreation]);

  if (errorMessage === null) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Não foi possível criar sua identidade
      </Text>
      <Text style={styles.message}>{errorMessage}</Text>
      <Pressable
        style={styles.button}
        onPress={attemptCreation}
        accessibilityRole="button"
        accessibilityLabel="Tentar novamente"
      >
        <Text style={styles.buttonText}>Tentar novamente</Text>
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
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
