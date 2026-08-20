import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresentProofUseCase } from '../../../../src/modules/presentation/app/present_proof_usecase';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import { PinWrongError, PinBackoffActiveError } from '../../../../src/shared/domain/errors/pin_errors';
import {
  AuthClockSkewError,
  PresentationRejectedError,
} from '../../../../src/shared/domain/errors/presentation_errors';
import { Ed25519Client } from '../../../../src/shared/clients/ed25519_client';
import { encodeBase64Url } from '../../../../src/shared/clients/base64url';

const DID = `did:yaid:user:${'a'.repeat(64)}`;
const SEED = new Uint8Array(32).fill(7);
const CREDENTIAL_RAW = 'header-fixed.payload-fixed.sig-fixed';

function makeUseCase() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const yaIDApi = new YaIDApiMock();
  const useCase = new PresentProofUseCase(
    pinLock,
    identityRepository,
    credentialRepository,
    yaIDApi,
    clock,
  );
  return { useCase, pinLock, identityRepository, credentialRepository, yaIDApi, clock };
}

async function setup(identityRepository: IdentityRepositoryMock, credentialRepository: CredentialRepositoryMock) {
  await identityRepository.save(createIdentity({ seed: SEED, publicKey: new Uint8Array(32).fill(1), did: DID }));
  await credentialRepository.save(
    createCredential({ vcId: 'vc-fixed', raw: CREDENTIAL_RAW, issuedAt: new Date(0), holder: DID, ageOver18: true }),
  );
}

test('fixed vector: known seed + credential.raw + nonce -> known base64url signatureValue', async () => {
  const { useCase, pinLock, identityRepository, credentialRepository, yaIDApi } = makeUseCase();
  await pinLock.initialize('112233');
  await setup(identityRepository, credentialRepository);

  await useCase.execute({ pin: '112233', sessionToken: 'tok' });

  const vp = yaIDApi.lastVerifyPresentationVp;
  assert.ok(vp !== null);
  const expectedPayload = JSON.stringify({
    holder: DID,
    challenge: 'test-nonce-fixed',
    verifiableCredential: [CREDENTIAL_RAW],
  });
  const expectedSignature = await Ed25519Client.sign(new TextEncoder().encode(expectedPayload), SEED);
  const expectedSignatureValue = encodeBase64Url(expectedSignature);
  assert.equal(vp!.proof.signatureValue, expectedSignatureValue);
  assert.equal(vp!.holder, DID);
  assert.equal(vp!.challenge, 'test-nonce-fixed');
  assert.deepEqual(vp!.verifiableCredential, [CREDENTIAL_RAW]);
});

test('IPinLock.verify is the FIRST call — getChallenge not called when PIN is wrong', async () => {
  const { useCase, pinLock, identityRepository, credentialRepository, yaIDApi } = makeUseCase();
  await pinLock.initialize('112233');
  await setup(identityRepository, credentialRepository);

  await assert.rejects(
    () => useCase.execute({ pin: '000000', sessionToken: 'tok' }),
    (err: unknown) => err instanceof PinWrongError,
  );
  assert.equal(yaIDApi.getChallengeCallCount, 0);
});

test('getChallenge not called when PinLock throws PinBackoffActiveError', async () => {
  const { useCase, pinLock, identityRepository, credentialRepository, yaIDApi, clock } = makeUseCase();
  await pinLock.initialize('112233');
  await setup(identityRepository, credentialRepository);
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(() => pinLock.verify('000000'));
  }

  await assert.rejects(
    () => useCase.execute({ pin: '112233', sessionToken: 'tok' }),
    (err: unknown) => err instanceof PinBackoffActiveError,
  );
  assert.equal(yaIDApi.getChallengeCallCount, 0);
});

test('getChallenge throws AuthClockSkewError -> propagated, verifyPresentation not called', async () => {
  const { useCase, pinLock, identityRepository, credentialRepository, yaIDApi } = makeUseCase();
  await pinLock.initialize('112233');
  await setup(identityRepository, credentialRepository);
  yaIDApi.scriptGetChallengeError(new AuthClockSkewError());

  await assert.rejects(
    () => useCase.execute({ pin: '112233', sessionToken: 'tok' }),
    (err: unknown) => err instanceof AuthClockSkewError,
  );
  assert.equal(yaIDApi.lastVerifyPresentationVp, null);
});

test('verifyPresentation rejected -> PresentationRejectedError', async () => {
  const { useCase, pinLock, identityRepository, credentialRepository, yaIDApi } = makeUseCase();
  await pinLock.initialize('112233');
  await setup(identityRepository, credentialRepository);
  yaIDApi.scriptVerifyPresentationError(new PresentationRejectedError());

  await assert.rejects(
    () => useCase.execute({ pin: '112233', sessionToken: 'tok' }),
    (err: unknown) => err instanceof PresentationRejectedError,
  );
});

test('success -> { verifiedAt }', async () => {
  const { useCase, pinLock, identityRepository, credentialRepository } = makeUseCase();
  await pinLock.initialize('112233');
  await setup(identityRepository, credentialRepository);

  const output = await useCase.execute({ pin: '112233', sessionToken: 'tok' });

  assert.ok(output.verifiedAt instanceof Date);
});
