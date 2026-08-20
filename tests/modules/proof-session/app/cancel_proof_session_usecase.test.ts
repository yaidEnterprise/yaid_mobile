import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CancelProofSessionUseCase } from '../../../../src/modules/proof-session/app/cancel_proof_session_usecase';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { SessionNotFoundError } from '../../../../src/shared/domain/errors/presentation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeUseCase() {
  const yaIDApi = new YaIDApiMock();
  const identityRepository = new IdentityRepositoryMock();
  const clock = new ClockMock(0);
  const useCase = new CancelProofSessionUseCase(identityRepository, yaIDApi, clock);
  return { useCase, yaIDApi, identityRepository };
}

async function setupIdentity(identityRepository: IdentityRepositoryMock) {
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
}

test('calls cancelProofSession exactly once', async () => {
  const { useCase, yaIDApi, identityRepository } = makeUseCase();
  await setupIdentity(identityRepository);

  await useCase.execute({ sessionToken: 'tok' });

  assert.equal(yaIDApi.cancelProofSessionCallCount, 1);
});

test('never calls IPinLock — refusal has no PIN cost (no pinLock dependency exists on this use case)', () => {
  // Structural guarantee: CancelProofSessionUseCase's constructor does not accept an IPinLock.
  const { useCase } = makeUseCase();
  assert.equal('pinLock' in (useCase as unknown as Record<string, unknown>), false);
});

test('best-effort: resolves { ok: true } even when cancelProofSession throws', async () => {
  const { useCase, yaIDApi, identityRepository } = makeUseCase();
  await setupIdentity(identityRepository);
  yaIDApi.scriptCancelProofSessionError(new SessionNotFoundError());

  const result = await useCase.execute({ sessionToken: 'tok' });

  assert.equal(result.ok, true);
});
