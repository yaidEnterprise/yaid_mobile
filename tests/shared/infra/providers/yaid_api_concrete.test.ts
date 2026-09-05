import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YaIDApiConcrete } from '../../../../src/shared/infra/providers/yaid_api_concrete';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { ProofType } from '../../../../src/shared/domain/enums/proof_type';
import { ProofSessionStatus } from '../../../../src/shared/domain/enums/proof_session_status';
import { Ed25519Client } from '../../../../src/shared/clients/ed25519_client';
import { IssuanceApiError } from '../../../../src/shared/domain/errors/credential_errors';
import {
  AuthClockSkewError,
  PresentationRejectedError,
  SessionExpiredError,
  SessionNotFoundError,
} from '../../../../src/shared/domain/errors/presentation_errors';
import { VerifiablePresentation } from '../../../../src/shared/domain/entities/verifiable_presentation';
import { RevocationApiError } from '../../../../src/shared/domain/errors/revocation_errors';

const DID = `did:yaid:user:${'a'.repeat(64)}`;
const SEED = new Uint8Array(32).fill(9);
const IMAGE = 'ZmFrZS1kb2N1bWVudC1pbWFnZQ==';

function toBase64Url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeVcJwt(overrides: { vcId: string; holder: string; issuedAtSeconds: number; ageOver18: boolean }): string {
  const header = { alg: 'EdDSA', typ: 'JWT', kid: `did:yaid:issuer:${'b'.repeat(64)}#key-1` };
  const payload = {
    iss: `did:yaid:issuer:${'b'.repeat(64)}`,
    sub: overrides.holder,
    jti: overrides.vcId,
    iat: overrides.issuedAtSeconds,
    nbf: overrides.issuedAtSeconds,
    vc: { personhood: true, ageOver18: overrides.ageOver18 },
  };
  const enc = (o: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  return `${enc(header)}.${enc(payload)}.mock-sig`;
}

test('fixed-vector: known seed + known image → expected authSig and bodySig, sent in headers/body', async () => {
  const clock = new ClockMock(1_700_000_000_000);
  const timestamp = clock.nowSeconds().toString();

  const expectedAuthSig = toBase64Url(
    await Ed25519Client.sign(new TextEncoder().encode(`${timestamp}:POST:/api/credentials/issue`), SEED),
  );
  const expectedBodySig = toBase64Url(
    await Ed25519Client.sign(new TextEncoder().encode(IMAGE), SEED),
  );

  let capturedPath = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: unknown;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedPath = url;
    capturedHeaders = init.headers as Record<string, string>;
    capturedBody = JSON.parse(init.body as string);
    return {
      status: 201,
      text: async () =>
        fakeVcJwt({ vcId: 'vc-1', holder: DID, issuedAtSeconds: clock.nowSeconds(), ageOver18: true }),
    } as Response;
  }) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    await api.issueCredential({
      did: DID,
      seed: SEED,
      documentImage: IMAGE,
      clock,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedPath.endsWith('/api/credentials/issue'));
  assert.equal(capturedHeaders['X-YaID-DID'], DID);
  assert.equal(capturedHeaders['X-YaID-Timestamp'], timestamp);
  assert.equal(capturedHeaders['X-YaID-Signature'], expectedAuthSig);
  assert.equal((capturedBody as { bodySignature: string }).bodySignature, expectedBodySig);
  assert.equal((capturedBody as { documentImage: string }).documentImage, IMAGE);
});

test('201 response maps to a Credential via the DTO mapper', async () => {
  const clock = new ClockMock(0);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      status: 201,
      text: async () =>
        fakeVcJwt({
          vcId: 'vc-2',
          holder: DID,
          issuedAtSeconds: Math.floor(Date.parse('2026-08-02T10:00:00.000Z') / 1000),
          ageOver18: true,
        }),
    }) as Response) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    const credential = await api.issueCredential({
      did: DID,
      seed: SEED,
      documentImage: IMAGE,
      clock,
    });
    assert.equal(credential.vcId, 'vc-2');
    assert.equal(credential.holder, DID);
    assert.equal(credential.ageOver18, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function mockFetchOnce(status: number, body: unknown): void {
  globalThis.fetch = (async () =>
    ({
      status,
      text: async () => JSON.stringify(body),
    }) as Response) as typeof fetch;
}

async function issueAndExpectCause(cause: string) {
  const clock = new ClockMock(0);
  const api = new YaIDApiConcrete();
  await assert.rejects(
    () =>
      api.issueCredential({
        did: DID,
        seed: SEED,
        documentImage: IMAGE,
        clock,
      }),
    (err: unknown) => {
      assert.ok(err instanceof IssuanceApiError);
      assert.equal(err.cause, cause);
      return true;
    },
  );
}

test('401 with "Request expired" maps to clock_skew', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(401, { error: 'Request expired' });
  try {
    await issueAndExpectCause('clock_skew');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('401 with any other message maps to unknown', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(401, { error: 'Invalid signature' });
  try {
    await issueAndExpectCause('unknown');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('422 maps to document_unreadable', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(422, { error: 'Document processing failed' });
  try {
    await issueAndExpectCause('document_unreadable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('502 maps to server_unavailable', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(502, { error: 'Blockchain registration failed' });
  try {
    await issueAndExpectCause('server_unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('400 Form B object error maps to unknown, tolerant reader extracts message', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(400, { error: { code: 'VALIDATION_ERROR', message: 'bad field' } });
  try {
    await issueAndExpectCause('unknown');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('network failure maps to no_connection', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  try {
    await issueAndExpectCause('no_connection');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- D3 ---

test('getProofSession sends no auth headers, 200 maps via proofSessionDtoToEntity', async () => {
  const originalFetch = globalThis.fetch;
  let capturedPath = '';
  let capturedInit: RequestInit = {};
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedPath = url;
    capturedInit = init;
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          token: 'tok',
          status: 'waiting_user',
          proofType: 'age_over_18',
          companyName: 'Empresa Parceira',
          expiresAt: '2026-08-02T15:30:00Z',
        }),
    } as Response;
  }) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    const session = await api.getProofSession({ sessionToken: 'tok' });
    assert.equal(session.status, ProofSessionStatus.WaitingUser);
    assert.equal(session.proofType, ProofType.AgeOver18);
    assert.equal(session.companyName, 'Empresa Parceira');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedPath.endsWith('/api/proof-sessions/tok'));
  assert.equal(capturedInit.method, 'GET');
  const headers = (capturedInit.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-YaID-DID'], undefined);
  assert.equal(headers['X-YaID-Signature'], undefined);
});

test('getProofSession 404 maps to SessionNotFoundError', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(404, {});
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () => api.getProofSession({ sessionToken: 'tok' }),
      (err: unknown) => err instanceof SessionNotFoundError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getChallenge sends fixed-vector DID-auth headers, 200 maps to { nonce }', async () => {
  const clock = new ClockMock(1_700_000_000_000);
  const timestamp = clock.nowSeconds().toString();
  const expectedAuthSig = toBase64Url(
    await Ed25519Client.sign(
      new TextEncoder().encode(`${timestamp}:GET:/api/proof-sessions/tok/challenge`),
      SEED,
    ),
  );

  let capturedPath = '';
  let capturedInit: RequestInit = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedPath = url;
    capturedInit = init;
    return { status: 200, text: async () => JSON.stringify({ nonce: 'test-nonce-fixed' }) } as Response;
  }) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    const result = await api.getChallenge({ did: DID, seed: SEED, sessionToken: 'tok', clock });
    assert.equal(result.nonce, 'test-nonce-fixed');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedPath.endsWith('/api/proof-sessions/tok/challenge'));
  const headers = (capturedInit.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-YaID-DID'], DID);
  assert.equal(headers['X-YaID-Timestamp'], timestamp);
  assert.equal(headers['X-YaID-Signature'], expectedAuthSig);
});

test('getChallenge 401 "Request expired" maps to AuthClockSkewError', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(401, { error: 'Request expired' });
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () => api.getChallenge({ did: DID, seed: SEED, sessionToken: 'tok', clock: new ClockMock(0) }),
      (err: unknown) => err instanceof AuthClockSkewError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getChallenge 404 maps to SessionExpiredError', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(404, {});
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () => api.getChallenge({ did: DID, seed: SEED, sessionToken: 'tok', clock: new ClockMock(0) }),
      (err: unknown) => err instanceof SessionExpiredError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function makeVp(): VerifiablePresentation {
  return {
    holder: DID,
    challenge: 'test-nonce-fixed',
    verifiableCredential: ['mock.vc.jwt'],
    proof: {
      type: 'Ed25519Signature2020',
      created: '2026-08-02T15:25:00Z',
      verificationMethod: `${DID}#key-1`,
      proofPurpose: 'authentication',
      signatureValue: 'sig-value',
    },
  };
}

test('verifyPresentation sends DID-auth headers and { vp, sessionToken }, 200 valid:true maps to { verifiedAt }', async () => {
  const clock = new ClockMock(1_700_000_000_000);
  const timestamp = clock.nowSeconds().toString();
  const expectedAuthSig = toBase64Url(
    await Ed25519Client.sign(new TextEncoder().encode(`${timestamp}:POST:/api/presentations/verify`), SEED),
  );
  const vp = makeVp();

  let capturedPath = '';
  let capturedInit: RequestInit = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedPath = url;
    capturedInit = init;
    return {
      status: 200,
      text: async () => JSON.stringify({ valid: true, verifiedAt: '2026-08-02T15:30:00Z' }),
    } as Response;
  }) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    const result = await api.verifyPresentation({ did: DID, seed: SEED, sessionToken: 'tok', vp, clock });
    assert.deepEqual(result.verifiedAt, new Date('2026-08-02T15:30:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedPath.endsWith('/api/presentations/verify'));
  const headers = (capturedInit.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-YaID-DID'], DID);
  assert.equal(headers['X-YaID-Timestamp'], timestamp);
  assert.equal(headers['X-YaID-Signature'], expectedAuthSig);
  const body = JSON.parse(capturedInit.body as string);
  assert.deepEqual(body, { vp, sessionToken: 'tok' });
});

test('verifyPresentation 200 valid:false maps to PresentationRejectedError', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(200, { valid: false });
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () =>
        api.verifyPresentation({ did: DID, seed: SEED, sessionToken: 'tok', vp: makeVp(), clock: new ClockMock(0) }),
      (err: unknown) => err instanceof PresentationRejectedError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('verifyPresentation 401 "Request expired" maps to AuthClockSkewError', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(401, { error: 'Request expired' });
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () =>
        api.verifyPresentation({ did: DID, seed: SEED, sessionToken: 'tok', vp: makeVp(), clock: new ClockMock(0) }),
      (err: unknown) => err instanceof AuthClockSkewError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cancelProofSession sends DID-auth headers, 200 resolves void', async () => {
  const clock = new ClockMock(1_700_000_000_000);
  const timestamp = clock.nowSeconds().toString();
  const expectedAuthSig = toBase64Url(
    await Ed25519Client.sign(
      new TextEncoder().encode(`${timestamp}:POST:/api/proof-sessions/tok/cancel`),
      SEED,
    ),
  );

  let capturedPath = '';
  let capturedInit: RequestInit = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedPath = url;
    capturedInit = init;
    return { status: 200, text: async () => '{}' } as Response;
  }) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    await api.cancelProofSession({ did: DID, seed: SEED, sessionToken: 'tok', clock });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedPath.endsWith('/api/proof-sessions/tok/cancel'));
  const headers = (capturedInit.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-YaID-DID'], DID);
  assert.equal(headers['X-YaID-Timestamp'], timestamp);
  assert.equal(headers['X-YaID-Signature'], expectedAuthSig);
});

test('cancelProofSession is best-effort: 404 and 5xx both resolve void', async () => {
  const originalFetch = globalThis.fetch;
  const api = new YaIDApiConcrete();
  const clock = new ClockMock(0);

  mockFetchOnce(404, {});
  await assert.doesNotReject(() => api.cancelProofSession({ did: DID, seed: SEED, sessionToken: 'tok', clock }));

  mockFetchOnce(500, {});
  await assert.doesNotReject(() => api.cancelProofSession({ did: DID, seed: SEED, sessionToken: 'tok', clock }));

  globalThis.fetch = originalFetch;
});

// --- D4 ---

test('revokeCredential fixed-vector: known seed + vcId + timestamp → expected authSig and bodySig', async () => {
  const clock = new ClockMock(1_700_000_000_000);
  const timestamp = clock.nowSeconds().toString();
  const VC_ID = 'vc-fixed-vector';

  const expectedAuthSig = toBase64Url(
    await Ed25519Client.sign(
      new TextEncoder().encode(`${timestamp}:POST:/api/credentials/revoke`),
      SEED,
    ),
  );
  const expectedBodySig = toBase64Url(await Ed25519Client.sign(new TextEncoder().encode(VC_ID), SEED));

  let capturedPath = '';
  let capturedInit: RequestInit = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedPath = url;
    capturedInit = init;
    return { status: 200, text: async () => JSON.stringify({ revoked: true }) } as Response;
  }) as typeof fetch;

  try {
    const api = new YaIDApiConcrete();
    const result = await api.revokeCredential({ did: DID, seed: SEED, vcId: VC_ID, clock });
    assert.deepEqual(result, { revoked: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedPath.endsWith('/api/credentials/revoke'));
  const headers = (capturedInit.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-YaID-DID'], DID);
  assert.equal(headers['X-YaID-Timestamp'], timestamp);
  assert.equal(headers['X-YaID-Signature'], expectedAuthSig);
  const body = JSON.parse(capturedInit.body as string);
  assert.equal(body.vcId, VC_ID);
  assert.equal(body.bodySignature, expectedBodySig);
});

test('revokeCredential 401 "Request expired" maps to RevocationApiError { isClockSkew: true }', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(401, { error: 'Request expired' });
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () => api.revokeCredential({ did: DID, seed: SEED, vcId: 'vc-1', clock: new ClockMock(0) }),
      (err: unknown) => {
        assert.ok(err instanceof RevocationApiError);
        assert.equal(err.isClockSkew, true);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('revokeCredential 502 maps to RevocationApiError', async () => {
  const originalFetch = globalThis.fetch;
  mockFetchOnce(502, { error: 'Blockchain revocation failed' });
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () => api.revokeCredential({ did: DID, seed: SEED, vcId: 'vc-1', clock: new ClockMock(0) }),
      (err: unknown) => err instanceof RevocationApiError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('revokeCredential network failure maps to RevocationApiError { isNetworkError: true }', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  try {
    const api = new YaIDApiConcrete();
    await assert.rejects(
      () => api.revokeCredential({ did: DID, seed: SEED, vcId: 'vc-1', clock: new ClockMock(0) }),
      (err: unknown) => {
        assert.ok(err instanceof RevocationApiError);
        assert.equal(err.isNetworkError, true);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
