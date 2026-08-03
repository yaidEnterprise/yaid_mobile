import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateIdentityUseCase } from '../../../../src/modules/identity/app/create_identity_usecase';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { SignerMock } from '../../../../src/shared/infra/providers/mock/signer_mock';
import { RandomnessMock } from '../../../../src/shared/infra/providers/mock/randomness_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { IdentityCreationFailedError } from '../../../../src/shared/domain/errors/identity_errors';
import type { IIdentityRepository } from '../../../../src/shared/domain/interfaces/repositories/identity_repository';
import type { Identity } from '../../../../src/shared/domain/entities/identity';

const FIXED_VECTOR_PUBLIC_KEY_HEX =
  '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29';
const FIXED_VECTOR_DID = `did:yaid:user:${FIXED_VECTOR_PUBLIC_KEY_HEX}`;

function makeUseCase() {
  const identityRepository = new IdentityRepositoryMock();
  const signer = new SignerMock();
  const randomness = new RandomnessMock();
  return {
    useCase: new CreateIdentityUseCase(identityRepository, signer, randomness),
    identityRepository,
  };
}

test('fixed vector: a 32-byte zero seed derives the expected publicKey and DID', async () => {
  const { useCase, identityRepository } = makeUseCase();
  const output = await useCase.execute({});
  assert.equal(output.did, FIXED_VECTOR_DID);

  const stored = await identityRepository.load();
  assert.ok(stored);
  assert.equal(Buffer.from(stored.publicKey).toString('hex'), FIXED_VECTOR_PUBLIC_KEY_HEX);
  assert.equal(stored.seed.length, 32);
  assert.ok(stored.seed.every((byte) => byte === 0));
});

test('identity-already-exists guard: a pre-existing identity is cleared and replaced by the fresh one', async () => {
  const { useCase, identityRepository } = makeUseCase();
  const staleDid = `did:yaid:user:${'f'.repeat(64)}`;
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(9), publicKey: new Uint8Array(32).fill(9), did: staleDid }),
  );

  const output = await useCase.execute({});

  assert.equal(output.did, FIXED_VECTOR_DID);
  const stored = await identityRepository.load();
  assert.equal(stored?.did, FIXED_VECTOR_DID);
});

test('a repository save failure surfaces as IdentityCreationFailedError', async () => {
  const failingRepository: IIdentityRepository = {
    async save(_identity: Identity): Promise<void> {
      throw new Error('secure storage write failed');
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
  await assert.rejects(() => useCase.execute({}), IdentityCreationFailedError);
});
