import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { IssueCredentialPresenter } from '../../src/modules/credential/app/issue_credential_presenter';
import { VerifyPinPresenter } from '../../src/modules/access/app/verify_pin_presenter';
import { createDocumentCapture } from '../../src/shared/environments';
import { DocumentCaptureConcrete } from '../../src/shared/infra/providers/document_capture_concrete';
import { IssuanceApiErrorCause } from '../../src/shared/domain/errors/credential_errors';

type Step =
  | 'explanation'
  | 'pin'
  | 'permission-denied'
  | 'camera'
  | 'review'
  | 'loading'
  | 'success'
  | 'failure';

const FAILURE_MESSAGES: Record<IssuanceApiErrorCause, string> = {
  document_unreadable:
    'Não conseguimos ler o documento na foto. Tente novamente com boa iluminação e o documento inteiro dentro do quadro.',
  server_unavailable: 'O serviço do YaID está indisponível no momento. Tente novamente em alguns minutos.',
  clock_skew: 'A data e hora do seu aparelho estão incorretas. Ajuste-as nas configurações e tente novamente.',
  no_connection: 'Não foi possível conectar à internet. Verifique sua conexão e tente novamente.',
  unknown: 'Não foi possível concluir a comprovação. Tente novamente.',
};

export default function CaptureDocumentScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionRequestedOnce, setPermissionRequestedOnce] = useState(false);

  const [step, setStep] = useState<Step>('explanation');
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [sessionAuthenticated, setSessionAuthenticated] = useState(false);
  const [sessionPin, setSessionPin] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [failureCause, setFailureCause] = useState<IssuanceApiErrorCause>('unknown');
  const [successDisplay, setSuccessDisplay] = useState<{ ageOver18: boolean } | null>(null);

  function leave() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  async function openCameraAfterAuth() {
    if (!permission?.granted) {
      if (permissionRequestedOnce) {
        setStep('permission-denied');
        return;
      }
      setPermissionRequestedOnce(true);
      const result = await requestPermission();
      if (!result.granted) {
        setStep('permission-denied');
        return;
      }
    }
    setStep('camera');
  }

  async function handlePinChange(rawText: string) {
    const digits = rawText.replace(/[^0-9]/g, '').slice(0, 6);
    setPinInput(digits);

    if (digits.length !== 6) {
      return;
    }

    const controller = VerifyPinPresenter();
    const result = await controller.execute({ pin: digits });

    if (result.kind === 'wrong') {
      setPinInput('');
      setPinMessage(`Senha incorreta. Restam ${result.attemptsRemaining} tentativas — tente novamente.`);
      return;
    }

    if (result.kind === 'locked') {
      setPinInput('');
      setPinLocked(true);
      setPinMessage('Muitas tentativas incorretas. Tente novamente mais tarde.');
      return;
    }

    if (result.kind === 'cancelled') {
      return;
    }

    setSessionAuthenticated(true);
    setSessionPin(digits);
    setPinInput('');
    setPinMessage(null);
    await openCameraAfterAuth();
  }

  async function handleCapture() {
    if (isCapturing) {
      return;
    }
    setIsCapturing(true);
    try {
      const capture = createDocumentCapture();
      if (capture instanceof DocumentCaptureConcrete) {
        capture.setCameraRef(cameraRef.current);
      }
      const base64 = await capture.capture();
      setPhoto(base64);
      setStep('review');
    } catch {
      // Camera may have been unmounted mid-capture (e.g. back navigation);
      // swallow so it doesn't surface as an unhandled rejection.
    } finally {
      setIsCapturing(false);
    }
  }

  function handleRepeat() {
    setPhoto(null);
    setStep('camera');
  }

  async function handleSend() {
    if (photo === null || sessionPin === null) {
      return;
    }
    setStep('loading');
    const controller = IssueCredentialPresenter();
    const result = await controller.execute({ pin: sessionPin, documentImage: photo });
    setPhoto(null);

    if (result.kind === 'success') {
      setSuccessDisplay({ ageOver18: result.ageOver18 });
      setStep('success');
      return;
    }

    if (result.kind === 'api_error') {
      setFailureCause(result.cause);
      setStep('failure');
      return;
    }

    // wrong_pin / locked should not occur here since the PIN was verified earlier
    // in this session; treat defensively as a generic failure.
    setFailureCause('unknown');
    setStep('failure');
  }

  function handleRetry() {
    setFailureCause('unknown');
    if (sessionAuthenticated) {
      openCameraAfterAuth();
      return;
    }
    setStep('explanation');
  }

  const proceedFromExplanation = useCallback(() => {
    if (sessionAuthenticated) {
      openCameraAfterAuth();
      return;
    }
    setStep('pin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAuthenticated]);

  if (step === 'explanation') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title} accessibilityRole="header">
          Vamos comprovar seu documento
        </Text>
        <Text style={styles.paragraph}>
          Você vai fotografar seu documento de identidade. A foto é enviada ao YaID apenas para
          confirmar suas respostas — ela não fica guardada no seu aparelho nem em nossos servidores.
        </Text>
        <Text style={styles.paragraph}>
          Depois disso, seu aparelho passa a responder apenas "sim" ou "não" quando alguém pedir
          para confirmar sua identidade ou sua idade.
        </Text>
        <Pressable
          style={styles.button}
          onPress={proceedFromExplanation}
          accessibilityRole="button"
          accessibilityLabel="Continuar"
        >
          <Text style={styles.buttonText}>Continuar</Text>
        </Pressable>
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Sair">
          <Text style={styles.exitButtonText}>Sair</Text>
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

  if (step === 'permission-denied') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Precisamos da câmera
        </Text>
        <Text style={styles.paragraph}>
          Para fotografar seu documento, o YaID precisa da sua permissão para usar a câmera.
          Abra as configurações do aparelho e permita o acesso.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Abrir ajustes"
        >
          <Text style={styles.buttonText}>Abrir ajustes</Text>
        </Pressable>
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Sair">
          <Text style={styles.exitButtonText}>Sair</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'camera') {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <Text style={styles.cameraOverlayText}>Enquadre seu documento dentro da área</Text>
        </CameraView>
        <Pressable
          style={styles.shutterButton}
          onPress={handleCapture}
          disabled={isCapturing}
          accessibilityRole="button"
          accessibilityLabel="Capturar foto"
        >
          <Text style={styles.buttonText}>Capturar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'review') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Revise a foto
        </Text>
        <Text style={styles.paragraph}>
          Confira se o documento está legível e completo antes de enviar.
        </Text>
        {photo !== null ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${photo}` }}
            style={styles.photoPreview}
            resizeMode="contain"
            accessibilityLabel="Foto do documento capturada"
          />
        ) : null}
        <Pressable
          style={styles.button}
          onPress={handleSend}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
        >
          <Text style={styles.buttonText}>Enviar</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={handleRepeat}
          accessibilityRole="button"
          accessibilityLabel="Repetir"
        >
          <Text style={styles.secondaryButtonText}>Repetir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <Text style={styles.title} accessibilityRole="header">
          Enviando seu documento
        </Text>
        <Text style={styles.paragraph}>
          Estamos confirmando suas respostas com o YaID. Isso pode levar alguns instantes.
        </Text>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Documento comprovado
        </Text>
        <Text style={styles.paragraph}>
          Seu aparelho já pode responder por você quando alguém pedir para confirmar sua
          identidade ou sua idade.
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

  // step === 'failure'
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Não foi possível comprovar seu documento
      </Text>
      <Text style={styles.message} accessibilityLiveRegion="polite">
        {FAILURE_MESSAGES[failureCause]}
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  cameraOverlayText: {
    marginTop: 40,
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  shutterButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    margin: 24,
    minHeight: 44,
    justifyContent: 'center',
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
  photoPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
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
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#4A4A4A',
  },
  exitButtonText: {
    marginTop: 20,
    fontSize: 15,
    color: '#4A4A4A',
  },
});
