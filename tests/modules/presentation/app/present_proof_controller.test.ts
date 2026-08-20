import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresentProofUseCase } from '../../../../src/modules/presentation/app/present_proof_usecase';
import { PresentProofViewModel } from '../../../../src/modules/presentation/app/present_proof_viewmodel';
import { PresentProofController } from '../../../../src/modules/presentation/app/present_proof_controller';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import {
  AuthClockSkewError,
  PresentationRejectedError,
} from '../../../../src/shared/domain/errors/presentation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeController() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const yaIDApi = new YaIDApiMock();
  const useCase = new PresentProofUseCase(pinLock, identityRepository, credentialRepository, yaIDApi, clock);
  const viewModel = new PresentProofViewModel();
  const controller = new PresentProofController(useCase, viewModel);
  return { controller, pinLock, identityRepository, credentialRepository, yaIDApi };
}

async function setupIdentityAndCredential(
  identityRepository: IdentityRepositoryMock,
  credentialRepository: CredentialRepositoryMock,
) {
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(7), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
  await credentialRepository.save(
    createCredential({ vcId: 'vc', raw: '{}', issuedAt: new Date(), holder: DID, ageOver18: true }),
  );
}

test('success result exposes verifiedAtLabel', async () => {
  const { controller, pinLock, identityRepository, credentialRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentityAndCredential(identityRepository, credentialRepository);

  const result = await controller.execute({ pin: '112233', sessionToken: 'tok' });

  assert.equal(result.kind, 'success');
  if (result.kind === 'success') {
    assert.ok(result.verifiedAtLabel.length > 0);
  }
});

test('wrong PIN produces wrong_pin result', async () => {
  const { controller, pinLock, identityRepository, credentialRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentityAndCredential(identityRepository, credentialRepository);

  const result = await controller.execute({ pin: '000000', sessionToken: 'tok' });

  assert.equal(result.kind, 'wrong_pin');
});

test('rejection produces rejected result', async () => {
  const { controller, pinLock, identityRepository, credentialRepository, yaIDApi } = makeController();
  await pinLock.initialize('112233');
  await setupIdentityAndCredential(identityRepository, credentialRepository);
  yaIDApi.scriptVerifyPresentationError(new PresentationRejectedError());

  const result = await controller.execute({ pin: '112233', sessionToken: 'tok' });

  assert.equal(result.kind, 'rejected');
});

test('clock-skew produces clock_skew result', async () => {
  const { controller, pinLock, identityRepository, credentialRepository, yaIDApi } = makeController();
  await pinLock.initialize('112233');
  await setupIdentityAndCredential(identityRepository, credentialRepository);
  yaIDApi.scriptGetChallengeError(new AuthClockSkewError());

  const result = await controller.execute({ pin: '112233', sessionToken: 'tok' });

  assert.equal(result.kind, 'clock_skew');
});
