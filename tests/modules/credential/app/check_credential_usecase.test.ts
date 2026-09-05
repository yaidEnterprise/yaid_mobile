import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CheckCredentialUseCase } from '../../../../src/modules/credential/app/check_credential_usecase';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { createCredential } from '../../../../src/shared/domain/entities/credential';

const HOLDER = `did:yaid:user:${'a'.repeat(64)}`;

test('exists is false when no credential is stored', async () => {
  const repo = new CredentialRepositoryMock();
  const useCase = new CheckCredentialUseCase(repo);
  const result = await useCase.execute({});
  assert.equal(result.exists, false);
});

test('exists is true, with ageOver18 and issuedAt, when a credential is stored', async () => {
  const repo = new CredentialRepositoryMock();
  const issuedAt = new Date('2026-08-02T10:00:00Z');
  await repo.save(
    createCredential({ vcId: 'uuid', raw: '{}', issuedAt, holder: HOLDER, ageOver18: true }),
  );
  const useCase = new CheckCredentialUseCase(repo);
  const result = await useCase.execute({});
  assert.equal(result.exists, true);
  assert.equal(result.ageOver18, true);
  assert.deepEqual(result.issuedAt, issuedAt);
});
