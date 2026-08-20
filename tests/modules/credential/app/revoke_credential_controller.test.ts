import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RevokeCredentialController } from '../../../../src/modules/credential/app/revoke_credential_controller';
import { RevokeCredentialUseCase } from '../../../../src/modules/credential/app/revoke_credential_usecase';
import { RevokeCredentialViewModel } from '../../../../src/modules/credential/app/revoke_credential_viewmodel';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import { RevocationApiError } from '../../../../src/shared/domain/errors/revocation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeController() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const yaIDApi = new YaIDApiMock();
  const useCase = new RevokeCredentialUseCase(identityRepository, credentialRepository, pinLock, clock, yaIDApi);
  const viewModel = new RevokeCredentialViewModel();
  const controller = new RevokeCredentialController(useCase, viewModel);
  return { controller, pinLock, identityRepository, credentialRepository, yaIDApi };
}

async function setupIdentity(identityRepository: IdentityRepositoryMock) {
  await identityRepository.save(createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }));
}

async function setupCredential(credentialRepository: CredentialRepositoryMock) {
  await credentialRepository.save(
    createCredential({ vcId: 'vc-1', raw: '{}', issuedAt: new Date(0), holder: DID, ageOver18: true }),
  );
}

test('success → RevokeCredentialSuccess with ViewModel', async () => {
  const { controller, pinLock, identityRepository, credentialRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository);

  const result = await controller.execute({ pin: '112233' });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(typeof result.revokedAt, 'string');
    assert.equal(typeof result.credentialType, 'string');
  }
});

test('PinWrongError → kind: pin_wrong with attemptsRemaining', async () => {
  const { controller, pinLock, identityRepository, credentialRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository);

  const result = await controller.execute({ pin: '000000' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'pin_wrong');
    assert.equal(result.attemptsRemaining, 4);
  }
});

test('PinBackoffActiveError → kind: pin_backoff with lockedUntilMs', async () => {
  const { controller, pinLock, identityRepository, credentialRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository);
  for (let i = 0; i < 5; i += 1) {
    try {
      await pinLock.verify('000000');
    } catch {
      // accumulate toward lockout
    }
  }

  const result = await controller.execute({ pin: '112233' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'pin_backoff');
    assert.equal(typeof result.lockedUntilMs, 'number');
  }
});

test('absent credential → kind: no_credential', async () => {
  const { controller, pinLock, identityRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);

  const result = await controller.execute({ pin: '112233' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'no_credential');
  }
});

test('RevocationApiError { isClockSkew: true } → kind: clock_skew', async () => {
  const { controller, pinLock, identityRepository, credentialRepository, yaIDApi } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository);
  yaIDApi.scriptRevokeCredential(new RevocationApiError(true, false, 'Request expired'));

  const result = await controller.execute({ pin: '112233' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'clock_skew');
  }
});

test('RevocationApiError { isNetworkError: true } → kind: network_error', async () => {
  const { controller, pinLock, identityRepository, credentialRepository, yaIDApi } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository);
  yaIDApi.scriptRevokeCredential(new RevocationApiError(false, true, 'network down'));

  const result = await controller.execute({ pin: '112233' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'network_error');
  }
});

test('other RevocationApiError → kind: api_error', async () => {
  const { controller, pinLock, identityRepository, credentialRepository, yaIDApi } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository);
  yaIDApi.scriptRevokeCredential(new RevocationApiError(false, false, 'Blockchain revocation failed'));

  const result = await controller.execute({ pin: '112233' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, 'api_error');
  }
});
