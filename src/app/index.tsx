import { useCallback, useEffect, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CheckIdentityPresenter } from '../modules/identity/app/check_identity_presenter';

type HomeState = 'loading' | 'no-identity' | 'identity-no-credential';

export default function HomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<HomeState>('loading');

  const refresh = useCallback(async () => {
    const controller = CheckIdentityPresenter();
    const { exists } = await controller.execute({});
    setState(exists ? 'identity-no-credential' : 'no-identity');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (state === 'loading') {
    return <SafeAreaView style={styles.container} />;
  }

  if (state === 'no-identity') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Bem-vindo ao YaID
        </Text>
        <Text style={styles.paragraph}>
          O YaID guarda sua identidade digital neste aparelho, sem enviar seus dados a nenhum
          servidor. Você decide, a cada verificação, o que compartilhar.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push('/onboarding/define-pin')}
          accessibilityRole="button"
          accessibilityLabel="Começar"
        >
          <Text style={styles.buttonText}>Começar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Sua identidade está pronta
      </Text>
      <Text style={styles.paragraph}>
        Sua verificação fica apenas neste aparelho. Se você trocar de aparelho, vai precisar
        comprovar seu documento de novo.
      </Text>
      <Text style={styles.paragraph}>Para concluir, verifique seu documento.</Text>
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Verificar documento"
      >
        <Text style={styles.buttonText}>Verificar documento</Text>
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
  paragraph: {
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 12,
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
});
