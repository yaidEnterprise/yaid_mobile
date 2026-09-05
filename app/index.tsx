import { useCallback, useEffect, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CheckIdentityPresenter } from '../src/modules/identity/app/check_identity_presenter';
import { CheckCredentialPresenter } from '../src/modules/credential/app/check_credential_presenter';
import { ResetAppPresenter } from '../src/modules/reset/app/reset_app_presenter';

type HomeState = 'loading' | 'no-identity' | 'identity-no-credential' | 'identity-with-credential';

interface CredentialDisplay {
  ageOver18: boolean;
  issuedAt: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

export default function HomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<HomeState>('loading');
  const [credential, setCredential] = useState<CredentialDisplay | null>(null);

  const refresh = useCallback(async () => {
    const identityController = CheckIdentityPresenter();
    const { exists: hasIdentity } = await identityController.execute({});

    if (!hasIdentity) {
      setState('no-identity');
      return;
    }

    const credentialController = CheckCredentialPresenter();
    const credentialResult = await credentialController.execute({});

    if (!credentialResult.exists) {
      setState('identity-no-credential');
      return;
    }

    setCredential({ ageOver18: credentialResult.ageOver18, issuedAt: credentialResult.issuedAt });
    setState('identity-with-credential');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function handleReset() {
    const controller = ResetAppPresenter();
    await controller.execute({});
    await refresh();
  }

  // TEMPORARY — testing-only reset (identity + credential + PIN), as if the
  // app had just been installed. Remove before shipping to production.
  const resetButton = (
    <Pressable onPress={handleReset} accessibilityRole="button" accessibilityLabel="Resetar tudo">
      <Text style={styles.resetButtonText}>Resetar tudo (teste)</Text>
    </Pressable>
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
        {resetButton}
      </SafeAreaView>
    );
  }

  if (state === 'identity-with-credential' && credential !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Documento comprovado
        </Text>
        <Text style={styles.paragraph}>
          Seu aparelho responde por você quando alguém pedir para confirmar sua identidade ou
          sua idade.
        </Text>
        <Text style={styles.answerLabel}>Maior de 18 anos</Text>
        <Text style={styles.answerValueNeutral} accessibilityRole="text">
          {credential.ageOver18 ? 'Sim' : 'Não'}
        </Text>
        <Text style={styles.paragraph}>
          Confirmado em {formatDate(credential.issuedAt)}
        </Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/credential/revoke')}
          accessibilityRole="button"
          accessibilityLabel="Revogar credencial"
        >
          <Text style={styles.secondaryButtonText}>Revogar credencial</Text>
        </Pressable>
        {resetButton}
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
        onPress={() => router.push('/credential/capture-document')}
        accessibilityRole="button"
        accessibilityLabel="Verificar documento"
      >
        <Text style={styles.buttonText}>Verificar meu documento</Text>
      </Pressable>
      {resetButton}
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
  answerLabel: {
    fontSize: 14,
    color: '#4A4A4A',
    textAlign: 'center',
    marginTop: 12,
  },
  answerValueNeutral: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
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
    marginTop: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#4A4A4A',
  },
  resetButtonText: {
    marginTop: 32,
    fontSize: 13,
    color: '#B00020',
  },
});
