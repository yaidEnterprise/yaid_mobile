import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YaIDApiMock } from '../../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { ClockMock } from '../../../../../src/shared/infra/providers/mock/clock_mock';
import { ProofType } from '../../../../../src/shared/domain/enums/proof_type';
import { ProofSessionStatus } from '../../../../../src/shared/domain/enums/proof_session_status';
import { IssuanceApiError } from '../../../../../src/shared/domain/errors/credential_errors';
import {
  AuthClockSkewError,
  PresentationRejectedError,
  SessionExpiredError,
  SessionNotFoundError,
} from '../../../../../src/shared/domain/errors/presentation_errors';
import { VerifiablePresentation } from '../../../../../src/shared/domain/entities/verifiable_presentation';
import { RevocationApiError } from '../../../../../src/shared/domain/errors/revocation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeParams() {
  return {
    did: DID,
    seed: new Uint8Array(32),
    documentImage: 'ZmFrZQ==',
    clock: new ClockMock(0),
  };
}

test('default issueCredential returns a scripted Credential', async () => {
  const api = new YaIDApiMock();
  const credential = await api.issueCredential(makeParams());
  assert.ok(credential.vcId.length > 0);
  assert.ok(credential.raw.length > 0);
});

test('can be configured to throw IssuanceApiError with any cause', async () => {
  const api = new YaIDApiMock();
  api.scriptError(new IssuanceApiError('document_unreadable', 'unreadable'));
  await assert.rejects(
    () => api.issueCredential(makeParams()),
    (err: unknown) => {
      assert.ok(err instanceof IssuanceApiError);
      assert.equal(err.cause, 'document_unreadable');
      return true;
    },
  );
});

test('ignores seed and does not validate signatures', async () => {
  const api = new YaIDApiMock();
  const params = makeParams();
  params.seed = new Uint8Array(32).fill(9);
  await assert.doesNotReject(() => api.issueCredential(params));
});

test('records call count and last params', async () => {
  const api = new YaIDApiMock();
  const params = makeParams();
  await api.issueCredential(params);
  await api.issueCredential(params);
  assert.equal(api.callCount, 2);
  assert.deepEqual(api.lastParams, params);
});

// --- D3 contract tests ---

test('getProofSession defaults to waiting_user + personhood', async () => {
  const api = new YaIDApiMock();
  const session = await api.getProofSession({ sessionToken: 'tok' });
  assert.equal(session.status, ProofSessionStatus.WaitingUser);
  assert.equal(session.proofType, ProofType.Personhood);
});

test('getProofSession is configurable to any status and records last params', async () => {
  const api = new YaIDApiMock();
  api.scriptProofSession({ status: ProofSessionStatus.Expired });
  const session = await api.getProofSession({ sessionToken: 'tok-2' });
  assert.equal(session.status, ProofSessionStatus.Expired);
  assert.deepEqual(api.lastGetProofSessionParams, { sessionToken: 'tok-2' });
});

test('getProofSession is configurable to throw SessionNotFoundError', async () => {
  const api = new YaIDApiMock();
  api.scriptGetProofSessionError(new SessionNotFoundError());
  await assert.rejects(
    () => api.getProofSession({ sessionToken: 'tok' }),
    (err: unknown) => err instanceof SessionNotFoundError,
  );
});

test('getChallenge defaults to a fixed nonce and records call count', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  const result1 = await api.getChallenge({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', clock });
  const result2 = await api.getChallenge({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', clock });
  assert.equal(result1.nonce, 'test-nonce-fixed');
  assert.equal(result2.nonce, 'test-nonce-fixed');
  assert.equal(api.getChallengeCallCount, 2);
});

test('getChallenge is configurable to throw AuthClockSkewError / SessionExpiredError', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  api.scriptGetChallengeError(new AuthClockSkewError());
  await assert.rejects(
    () => api.getChallenge({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', clock }),
    (err: unknown) => err instanceof AuthClockSkewError,
  );
});

test('verifyPresentation defaults to verifiedAt from the clock and records the last VP', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(12_345);
  const vp: VerifiablePresentation = {
    holder: DID,
    challenge: 'nonce',
    verifiableCredential: ['mock.vc.jwt'],
    proof: {
      type: 'Ed25519Signature2020',
      created: '2026-08-02T00:00:00Z',
      verificationMethod: `${DID}#key-1`,
      proofPurpose: 'authentication',
      signatureValue: 'sig',
    },
  };
  const result = await api.verifyPresentation({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', vp, clock });
  assert.deepEqual(result.verifiedAt, new Date(12_345));
  assert.deepEqual(api.lastVerifyPresentationVp, vp);
});

test('verifyPresentation is configurable to throw PresentationRejectedError / AuthClockSkewError', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  api.scriptVerifyPresentationError(new PresentationRejectedError());
  const vp: VerifiablePresentation = {
    holder: DID,
    challenge: 'nonce',
    verifiableCredential: ['mock.vc.jwt'],
    proof: {
      type: 'Ed25519Signature2020',
      created: '2026-08-02T00:00:00Z',
      verificationMethod: `${DID}#key-1`,
      proofPurpose: 'authentication',
      signatureValue: 'sig',
    },
  };
  await assert.rejects(
    () => api.verifyPresentation({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', vp, clock }),
    (err: unknown) => err instanceof PresentationRejectedError,
  );
});

test('cancelProofSession resolves void by default and records call count', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  await api.cancelProofSession({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', clock });
  await api.cancelProofSession({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', clock });
  assert.equal(api.cancelProofSessionCallCount, 2);
});

test('cancelProofSession is configurable to throw', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  api.scriptCancelProofSessionError(new SessionNotFoundError());
  await assert.rejects(
    () => api.cancelProofSession({ did: DID, seed: new Uint8Array(32), sessionToken: 'tok', clock }),
    (err: unknown) => err instanceof SessionNotFoundError,
  );
});

// --- D4 contract tests ---

test('revokeCredential defaults to { revoked: true } and records last params', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  const result = await api.revokeCredential({ did: DID, seed: new Uint8Array(32), vcId: 'vc-1', clock });
  assert.deepEqual(result, { revoked: true });
  assert.equal(api.lastRevokeParams?.vcId, 'vc-1');
  assert.equal(api.lastRevokeParams?.did, DID);
});

test('revokeCredential is configurable to throw a scripted RevocationApiError', async () => {
  const api = new YaIDApiMock();
  const clock = new ClockMock(0);
  const scripted = new RevocationApiError(false, false, 'blockchain revocation failed');
  api.scriptRevokeCredential(scripted);
  await assert.rejects(
    () => api.revokeCredential({ did: DID, seed: new Uint8Array(32), vcId: 'vc-1', clock }),
    (err: unknown) => err === scripted,
  );
});
