import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IssueCredentialController } from '../../../../src/modules/credential/app/issue_credential_controller';
import { IssueCredentialUseCase } from '../../../../src/modules/credential/app/issue_credential_usecase';
import { IssueCredentialViewModel } from '../../../../src/modules/credential/app/issue_credential_viewmodel';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { ImageProcessorMock } from '../../../../src/shared/infra/providers/mock/image_processor_mock';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { IssuanceApiError } from '../../../../src/shared/domain/errors/credential_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeController() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const imageProcessor = new ImageProcessorMock();
  const yaIDApi = new YaIDApiMock();
  const useCase = new IssueCredentialUseCase(
    pinLock,
    identityRepository,
    credentialRepository,
    imageProcessor,
    yaIDApi,
    clock,
  );
  const viewModel = new IssueCredentialViewModel(clock);
  const controller = new IssueCredentialController(useCase, viewModel);
  return { controller, pinLock, identityRepository, yaIDApi };
}

async function setupIdentity(identityRepository: IdentityRepositoryMock) {
  const identity = createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID });
  await identityRepository.save(identity);
}

test('success result contains ageOver18 and issuedAt', async () => {
  const { controller, pinLock, identityRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);

  const result = await controller.execute({ pin: '112233', documentImage: 'ZmFrZQ==' });

  assert.equal(result.kind, 'success');
  if (result.kind === 'success') {
    assert.equal(typeof result.ageOver18, 'boolean');
    assert.ok(result.issuedAt instanceof Date);
  }
});

test('wrong PIN produces a wrong_pin result with attemptsRemaining', async () => {
  const { controller, pinLock, identityRepository } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);

  const result = await controller.execute({ pin: '000000', documentImage: 'ZmFrZQ==' });

  assert.equal(result.kind, 'wrong_pin');
  if (result.kind === 'wrong_pin') {
    assert.equal(result.attemptsRemaining, 4);
  }
});

test('API failure produces an api_error result with the mapped cause', async () => {
  const { controller, pinLock, identityRepository, yaIDApi } = makeController();
  await pinLock.initialize('112233');
  await setupIdentity(identityRepository);
  yaIDApi.scriptError(new IssuanceApiError('document_unreadable', 'bad doc'));

  const result = await controller.execute({ pin: '112233', documentImage: 'ZmFrZQ==' });

  assert.equal(result.kind, 'api_error');
  if (result.kind === 'api_error') {
    assert.equal(result.cause, 'document_unreadable');
  }
});
