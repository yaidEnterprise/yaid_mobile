import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RevokeCredentialUseCase } from '../../../../src/modules/credential/app/revoke_credential_usecase';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import { PinWrongError, PinBackoffActiveError } from '../../../../src/shared/domain/errors/pin_errors';
import { CredentialNotFoundError } from '../../../../src/shared/domain/errors/credential_errors';
import { RevocationApiError } from '../../../../src/shared/domain/errors/revocation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;
const SEED = new Uint8Array(32).fill(7);

function makeDeps() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const yaIDApi = new YaIDApiMock();
  return { clock, pinLock, identityRepository, credentialRepository, yaIDApi };
}

async function setupIdentity(identityRepository: IdentityRepositoryMock) {
  const identity = createIdentity({ seed: SEED, publicKey: new Uint8Array(32).fill(1), did: DID });
  await identityRepository.save(identity);
}

async function setupCredential(credentialRepository: CredentialRepositoryMock, vcId = 'vc-123') {
  const credential = createCredential({
    vcId,
    raw: '{}',
    issuedAt: new Date(0),
    holder: DID,
    ageOver18: true,
  });
  await credentialRepository.save(credential);
  return credential;
}

function makeUseCase(deps: ReturnType<typeof makeDeps>) {
  return new RevokeCredentialUseCase(
    deps.identityRepository,
    deps.credentialRepository,
    deps.pinLock,
    deps.clock,
    deps.yaIDApi,
  );
}

test('happy path: PIN OK → load identity → load credential → revoke → delete → returns output', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository);

  const useCase = makeUseCase(deps);
  const output = await useCase.execute({ pin: '112233' });

  assert.ok(output.revokedAt instanceof Date);
  assert.equal(output.ageOver18, true);
  assert.equal(await deps.credentialRepository.exists(), false);
});

test('fixed-vector passthrough: exact vcId and seed loaded are the ones passed to revokeCredential', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository, 'vc-fixed-vector');

  const useCase = makeUseCase(deps);
  await useCase.execute({ pin: '112233' });

  assert.equal(deps.yaIDApi.lastRevokeParams?.vcId, 'vc-fixed-vector');
  assert.deepEqual(deps.yaIDApi.lastRevokeParams?.seed, SEED);
  assert.equal(deps.yaIDApi.lastRevokeParams?.did, DID);
});

test('PIN-first regression: wrong PIN never calls revokeCredential and never deletes', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository);

  const useCase = makeUseCase(deps);
  await assert.rejects(() => useCase.execute({ pin: '000000' }), PinWrongError);

  assert.equal(deps.yaIDApi.lastRevokeParams, null);
  assert.equal(await deps.credentialRepository.exists(), true);
});

test('PIN-first regression: backoff active never calls revokeCredential and never deletes', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository);
  for (let i = 0; i < 5; i += 1) {
    try {
      await deps.pinLock.verify('000000');
    } catch {
      // accumulate failures toward lockout
    }
  }

  const useCase = makeUseCase(deps);
  await assert.rejects(() => useCase.execute({ pin: '112233' }), PinBackoffActiveError);

  assert.equal(deps.yaIDApi.lastRevokeParams, null);
  assert.equal(await deps.credentialRepository.exists(), true);
});

test('no-credential: absent credential throws before any API call', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);

  const useCase = makeUseCase(deps);
  await assert.rejects(() => useCase.execute({ pin: '112233' }), CredentialNotFoundError);

  assert.equal(deps.yaIDApi.lastRevokeParams, null);
});

test('delete-only-on-success regression: RevocationApiError → delete() never called', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository);
  deps.yaIDApi.scriptRevokeCredential(new RevocationApiError(false, false, 'boom'));

  const useCase = makeUseCase(deps);
  await assert.rejects(() => useCase.execute({ pin: '112233' }), RevocationApiError);

  assert.equal(await deps.credentialRepository.exists(), true);
});

test('clock-skew RevocationApiError propagates, credential untouched', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository);
  deps.yaIDApi.scriptRevokeCredential(new RevocationApiError(true, false, 'Request expired'));

  const useCase = makeUseCase(deps);
  await assert.rejects(
    () => useCase.execute({ pin: '112233' }),
    (err: unknown) => err instanceof RevocationApiError && err.isClockSkew === true,
  );
  assert.equal(await deps.credentialRepository.exists(), true);
});

test('network-error RevocationApiError propagates, credential untouched', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await setupCredential(deps.credentialRepository);
  deps.yaIDApi.scriptRevokeCredential(new RevocationApiError(false, true, 'network down'));

  const useCase = makeUseCase(deps);
  await assert.rejects(
    () => useCase.execute({ pin: '112233' }),
    (err: unknown) => err instanceof RevocationApiError && err.isNetworkError === true,
  );
  assert.equal(await deps.credentialRepository.exists(), true);
});
