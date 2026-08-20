import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResetAppUseCase } from '../../../../src/modules/reset/app/reset_app_usecase';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';

const DID = `did:yaid:user:${'a'.repeat(64)}`;
const SEED = new Uint8Array(32).fill(7);

function makeDeps() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  return { clock, pinLock, identityRepository, credentialRepository };
}

test('execute wipes identity, credential and PIN, as if freshly installed', async () => {
  const { pinLock, identityRepository, credentialRepository } = makeDeps();

  await identityRepository.save(createIdentity({ seed: SEED, publicKey: new Uint8Array(32).fill(1), did: DID }));
  await credentialRepository.save(
    createCredential({ vcId: 'vc-123', raw: '{}', issuedAt: new Date(0), holder: DID, ageOver18: true }),
  );
  await pinLock.initialize('123456');

  const useCase = new ResetAppUseCase(identityRepository, credentialRepository, pinLock);
  await useCase.execute({});

  assert.equal(await identityRepository.exists(), false);
  assert.equal(await credentialRepository.exists(), false);
  await assert.rejects(() => pinLock.verify('123456'));
});

test('execute is a no-op-safe wipe when nothing was ever set up', async () => {
  const { identityRepository, credentialRepository, pinLock } = makeDeps();

  const useCase = new ResetAppUseCase(identityRepository, credentialRepository, pinLock);
  await useCase.execute({});

  assert.equal(await identityRepository.exists(), false);
  assert.equal(await credentialRepository.exists(), false);
});
