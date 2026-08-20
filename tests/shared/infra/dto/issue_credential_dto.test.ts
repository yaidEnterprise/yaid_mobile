import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vcResponseToCredential } from '../../../../src/shared/infra/dto/issue_credential_dto';
import { encodeBase64Url } from '../../../../src/shared/clients/base64url';

const HOLDER = `did:yaid:user:${'a'.repeat(64)}`;

function makeVcJwt(overrides: { jti: string; sub: string; iat: number; ageOver18: boolean }): string {
  const header = { alg: 'EdDSA', typ: 'JWT', kid: `did:yaid:issuer:${'b'.repeat(64)}#key-1` };
  const payload = {
    iss: `did:yaid:issuer:${'b'.repeat(64)}`,
    sub: overrides.sub,
    jti: overrides.jti,
    iat: overrides.iat,
    nbf: overrides.iat,
    vc: { personhood: true, ageOver18: overrides.ageOver18 },
  };
  const enc = (o: unknown) => encodeBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  return `${enc(header)}.${enc(payload)}.mock-signature`;
}

test('vc.ageOver18 true maps to Credential.ageOver18 true', () => {
  const raw = makeVcJwt({ jti: 'uuid-1', sub: HOLDER, iat: 1_754_128_800, ageOver18: true });
  const credential = vcResponseToCredential(raw);
  assert.equal(credential.ageOver18, true);
});

test('vc.ageOver18 false maps to Credential.ageOver18 false', () => {
  const raw = makeVcJwt({ jti: 'uuid-2', sub: HOLDER, iat: 1_754_128_800, ageOver18: false });
  const credential = vcResponseToCredential(raw);
  assert.equal(credential.ageOver18, false);
});

test('raw is identical byte-for-byte to the original JWT string', () => {
  const raw = makeVcJwt({ jti: 'uuid-3', sub: HOLDER, iat: 1_754_128_800, ageOver18: true });
  const credential = vcResponseToCredential(raw);
  assert.equal(credential.raw, raw);
});

test('vcId, issuedAt, and holder are mapped from jti/iat/sub', () => {
  const raw = makeVcJwt({ jti: 'uuid-4', sub: HOLDER, iat: 1_754_128_800, ageOver18: true });
  const credential = vcResponseToCredential(raw);
  assert.equal(credential.vcId, 'uuid-4');
  assert.equal(credential.holder, HOLDER);
  assert.equal(credential.issuedAt.toISOString(), new Date(1_754_128_800 * 1000).toISOString());
});

test('malformed JWT (missing segments) throws rather than silently producing a bad Credential', () => {
  assert.throws(() => vcResponseToCredential('not-a-jwt'));
});
