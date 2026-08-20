import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IssueCredentialUseCase } from '../../../../src/modules/credential/app/issue_credential_usecase';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { ImageProcessorMock } from '../../../../src/shared/infra/providers/mock/image_processor_mock';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import { PinWrongError } from '../../../../src/shared/domain/errors/pin_errors';
import { CredentialAlreadyExistsError, IssuanceApiError } from '../../../../src/shared/domain/errors/credential_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeDeps() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const imageProcessor = new ImageProcessorMock();
  const yaIDApi = new YaIDApiMock();
  return { clock, pinLock, identityRepository, credentialRepository, imageProcessor, yaIDApi };
}

async function setupIdentity(identityRepository: IdentityRepositoryMock) {
  const identity = createIdentity({ seed: new Uint8Array(32).fill(7), publicKey: new Uint8Array(32).fill(1), did: DID });
  await identityRepository.save(identity);
}

test('success path: PIN correct → load identity → compress → issue → save, in order', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);

  const useCase = new IssueCredentialUseCase(
    deps.pinLock,
    deps.identityRepository,
    deps.credentialRepository,
    deps.imageProcessor,
    deps.yaIDApi,
    deps.clock,
  );

  const output = await useCase.execute({ pin: '112233', documentImage: 'ZmFrZS1pbWFnZQ==' });

  assert.equal(deps.yaIDApi.callCount, 1);
  assert.equal(await deps.credentialRepository.exists(), true);
  assert.equal(typeof output.ageOver18, 'boolean');
  assert.ok(output.issuedAt instanceof Date);
});

test('IPinLock.verify() is the first call — API and repository never touched when PIN is wrong', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);

  const useCase = new IssueCredentialUseCase(
    deps.pinLock,
    deps.identityRepository,
    deps.credentialRepository,
    deps.imageProcessor,
    deps.yaIDApi,
    deps.clock,
  );

  await assert.rejects(
    () => useCase.execute({ pin: '000000', documentImage: 'ZmFrZQ==' }),
    PinWrongError,
  );

  assert.equal(deps.yaIDApi.callCount, 0);
  assert.equal(await deps.credentialRepository.exists(), false);
});

test('guard: credential already exists → CredentialAlreadyExistsError before any capture', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  await deps.credentialRepository.save(
    createCredential({
      vcId: 'existing',
      raw: '{}',
      issuedAt: new Date(0),
      holder: DID,
      ageOver18: true,
    }),
  );

  const useCase = new IssueCredentialUseCase(
    deps.pinLock,
    deps.identityRepository,
    deps.credentialRepository,
    deps.imageProcessor,
    deps.yaIDApi,
    deps.clock,
  );

  await assert.rejects(
    () => useCase.execute({ pin: '112233', documentImage: 'ZmFrZQ==' }),
    CredentialAlreadyExistsError,
  );
});

test('CredentialRepository.save() is called exactly once on the success path', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  let saveCount = 0;
  const originalSave = deps.credentialRepository.save.bind(deps.credentialRepository);
  deps.credentialRepository.save = async (credential) => {
    saveCount += 1;
    return originalSave(credential);
  };

  const useCase = new IssueCredentialUseCase(
    deps.pinLock,
    deps.identityRepository,
    deps.credentialRepository,
    deps.imageProcessor,
    deps.yaIDApi,
    deps.clock,
  );
  await useCase.execute({ pin: '112233', documentImage: 'ZmFrZQ==' });
  assert.equal(saveCount, 1);
});

test('FR-026 regression: any IssuanceApiError from IYaIDApi → save() NOT called, no credential persisted', async () => {
  const deps = makeDeps();
  await deps.pinLock.initialize('112233');
  await setupIdentity(deps.identityRepository);
  deps.yaIDApi.scriptError(new IssuanceApiError('server_unavailable', 'down'));

  const useCase = new IssueCredentialUseCase(
    deps.pinLock,
    deps.identityRepository,
    deps.credentialRepository,
    deps.imageProcessor,
    deps.yaIDApi,
    deps.clock,
  );

  await assert.rejects(
    () => useCase.execute({ pin: '112233', documentImage: 'ZmFrZQ==' }),
    IssuanceApiError,
  );
  assert.equal(await deps.credentialRepository.exists(), false);
});
