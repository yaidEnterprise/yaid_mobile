import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CancelProofSessionUseCase } from '../../../../src/modules/proof-session/app/cancel_proof_session_usecase';
import { CancelProofSessionController } from '../../../../src/modules/proof-session/app/cancel_proof_session_controller';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { SessionNotFoundError } from '../../../../src/shared/domain/errors/presentation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeController() {
  const yaIDApi = new YaIDApiMock();
  const identityRepository = new IdentityRepositoryMock();
  const clock = new ClockMock(0);
  const useCase = new CancelProofSessionUseCase(identityRepository, yaIDApi, clock);
  const controller = new CancelProofSessionController(useCase);
  return { controller, yaIDApi, identityRepository };
}

test('resolves success on API success', async () => {
  const { controller, identityRepository } = makeController();
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'success');
});

test('resolves success even on best-effort cancel failure', async () => {
  const { controller, identityRepository, yaIDApi } = makeController();
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
  yaIDApi.scriptCancelProofSessionError(new SessionNotFoundError());

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'success');
});
