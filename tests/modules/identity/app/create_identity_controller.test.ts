import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateIdentityController } from '../../../../src/modules/identity/app/create_identity_controller';
import { CreateIdentityUseCase } from '../../../../src/modules/identity/app/create_identity_usecase';
import { CreateIdentityViewModel } from '../../../../src/modules/identity/app/create_identity_viewmodel';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { SignerMock } from '../../../../src/shared/infra/providers/mock/signer_mock';
import { RandomnessMock } from '../../../../src/shared/infra/providers/mock/randomness_mock';
import type { IIdentityRepository } from '../../../../src/shared/domain/interfaces/repositories/identity_repository';
import type { Identity } from '../../../../src/shared/domain/entities/identity';

test('success path returns a success result containing only the did', async () => {
  const useCase = new CreateIdentityUseCase(new IdentityRepositoryMock(), new SignerMock(), new RandomnessMock());
  const controller = new CreateIdentityController(useCase, new CreateIdentityViewModel());
  const result = await controller.execute({});
  assert.equal(result.kind, 'success');
  assert.ok('did' in result && result.did.length > 0);
});

test('a failure in the use case is mapped to an error result, not thrown', async () => {
  const failingRepository: IIdentityRepository = {
    async save(_identity: Identity): Promise<void> {
      throw new Error('disk full');
    },
    async load(): Promise<Identity | null> {
      return null;
    },
    async exists(): Promise<boolean> {
      return false;
    },
    async clear(): Promise<void> {},
  };
  const useCase = new CreateIdentityUseCase(failingRepository, new SignerMock(), new RandomnessMock());
  const controller = new CreateIdentityController(useCase, new CreateIdentityViewModel());
  const result = await controller.execute({});
  assert.equal(result.kind, 'error');
  assert.ok('message' in result && result.message.length > 0);
});
