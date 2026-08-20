import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCredential } from '../../../../src/shared/domain/entities/credential';

const HOLDER = `did:yaid:user:${'a'.repeat(64)}`;
const RAW = '{"id":"uuid","claims":{"personhood":true}}';

test('raw is stored byte-for-byte', () => {
  const credential = createCredential({
    vcId: 'uuid',
    raw: RAW,
    issuedAt: new Date('2026-08-02T10:00:00Z'),
    holder: HOLDER,
    ageOver18: true,
  });
  assert.equal(credential.raw, RAW);
});

test('holder must match did:yaid:user: shape', () => {
  assert.throws(() =>
    createCredential({
      vcId: 'uuid',
      raw: RAW,
      issuedAt: new Date(),
      holder: 'not-a-did',
      ageOver18: true,
    }),
  );
});

test('valid credential is constructed with all fields', () => {
  const issuedAt = new Date('2026-08-02T10:00:00Z');
  const credential = createCredential({
    vcId: 'uuid',
    raw: RAW,
    issuedAt,
    holder: HOLDER,
    ageOver18: false,
  });
  assert.equal(credential.vcId, 'uuid');
  assert.equal(credential.issuedAt, issuedAt);
  assert.equal(credential.holder, HOLDER);
  assert.equal(credential.ageOver18, false);
});
