import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetProofSessionUseCase } from '../../../../src/modules/proof-session/app/get_proof_session_usecase';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import { ProofSessionStatus } from '../../../../src/shared/domain/enums/proof_session_status';
import { ProofType } from '../../../../src/shared/domain/enums/proof_type';
import {
  SessionExpiredError,
  SessionIneligibleError,
} from '../../../../src/shared/domain/errors/presentation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeUseCase() {
  const yaIDApi = new YaIDApiMock();
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const useCase = new GetProofSessionUseCase(yaIDApi, identityRepository, credentialRepository);
  return { useCase, yaIDApi, identityRepository, credentialRepository };
}

async function setupIdentity(identityRepository: IdentityRepositoryMock) {
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
}

async function setupCredential(credentialRepository: CredentialRepositoryMock, ageOver18: boolean) {
  await credentialRepository.save(
    createCredential({
      vcId: 'vc-1',
      raw: '{}',
      issuedAt: new Date('2026-08-02T00:00:00Z'),
      holder: DID,
      ageOver18,
    }),
  );
}

test('waiting_user + identity + eligible credential -> ok:true, canDecide:true; getChallenge never called', async () => {
  const { useCase, yaIDApi, identityRepository, credentialRepository } = makeUseCase();
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository, true);
  yaIDApi.scriptProofSession({ status: ProofSessionStatus.WaitingUser, proofType: ProofType.Personhood });

  const result = await useCase.execute({ sessionToken: 'tok' });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.canDecide, true);
    assert.equal(result.session.status, ProofSessionStatus.WaitingUser);
  }
  assert.equal(yaIDApi.getChallengeCallCount, 0);
});

test('identity absent -> ok:false, reason:needs_identity, companyName; getChallenge never called', async () => {
  const { useCase, yaIDApi } = makeUseCase();
  yaIDApi.scriptProofSession({ companyName: 'Empresa X' });

  const result = await useCase.execute({ sessionToken: 'tok' });

  assert.equal(result.ok, false);
  if (!result.ok && 'reason' in result) {
    assert.equal(result.reason, 'needs_identity');
    assert.equal(result.companyName, 'Empresa X');
  } else {
    assert.fail('expected reason branch');
  }
  assert.equal(yaIDApi.getChallengeCallCount, 0);
});

test('credential absent -> ok:false, reason:needs_credential, companyName; getChallenge never called', async () => {
  const { useCase, yaIDApi, identityRepository } = makeUseCase();
  await setupIdentity(identityRepository);
  yaIDApi.scriptProofSession({ companyName: 'Empresa Y' });

  const result = await useCase.execute({ sessionToken: 'tok' });

  assert.equal(result.ok, false);
  if (!result.ok && 'reason' in result) {
    assert.equal(result.reason, 'needs_credential');
    assert.equal(result.companyName, 'Empresa Y');
  } else {
    assert.fail('expected reason branch');
  }
  assert.equal(yaIDApi.getChallengeCallCount, 0);
});

test('age_over_18 requested + credential.ageOver18 false -> SessionIneligibleError; getChallenge never called', async () => {
  const { useCase, yaIDApi, identityRepository, credentialRepository } = makeUseCase();
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository, false);
  yaIDApi.scriptProofSession({ status: ProofSessionStatus.WaitingUser, proofType: ProofType.AgeOver18 });

  const result = await useCase.execute({ sessionToken: 'tok' });

  assert.equal(result.ok, false);
  if (!result.ok && 'error' in result) {
    assert.ok(result.error instanceof SessionIneligibleError);
  } else {
    assert.fail('expected error branch');
  }
  assert.equal(yaIDApi.getChallengeCallCount, 0);
});

test('personhood is always eligible', async () => {
  const { useCase, identityRepository, credentialRepository, yaIDApi } = makeUseCase();
  await setupIdentity(identityRepository);
  await setupCredential(credentialRepository, false);
  yaIDApi.scriptProofSession({ status: ProofSessionStatus.WaitingUser, proofType: ProofType.Personhood });

  const result = await useCase.execute({ sessionToken: 'tok' });

  assert.equal(result.ok, true);
});

for (const status of [
  ProofSessionStatus.Opened,
  ProofSessionStatus.Expired,
  ProofSessionStatus.ApprovedByUser,
  ProofSessionStatus.Cancelled,
]) {
  test(`status ${status} -> SessionExpiredError; getChallenge never called`, async () => {
    const { useCase, yaIDApi, identityRepository, credentialRepository } = makeUseCase();
    await setupIdentity(identityRepository);
    await setupCredential(credentialRepository, true);
    yaIDApi.scriptProofSession({ status });

    const result = await useCase.execute({ sessionToken: 'tok' });

    assert.equal(result.ok, false);
    if (!result.ok && 'error' in result) {
      assert.ok(result.error instanceof SessionExpiredError);
    } else {
      assert.fail('expected error branch');
    }
    assert.equal(yaIDApi.getChallengeCallCount, 0);
  });
}
