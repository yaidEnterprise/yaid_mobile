import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';

const VALID_DID = `did:yaid:user:${'a'.repeat(64)}`;

test('createIdentity accepts a valid 32-byte seed, 32-byte publicKey, and well-formed did', () => {
  const identity = createIdentity({
    seed: new Uint8Array(32),
    publicKey: new Uint8Array(32),
    did: VALID_DID,
  });
  assert.equal(identity.seed.length, 32);
  assert.equal(identity.publicKey.length, 32);
  assert.equal(identity.did, VALID_DID);
});

test('createIdentity rejects a seed that is not 32 bytes', () => {
  assert.throws(() =>
    createIdentity({ seed: new Uint8Array(31), publicKey: new Uint8Array(32), did: VALID_DID }),
  );
});

test('createIdentity rejects a publicKey that is not 32 bytes', () => {
  assert.throws(() =>
    createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(33), did: VALID_DID }),
  );
});

test('createIdentity rejects a did with uppercase hex', () => {
  assert.throws(() =>
    createIdentity({
      seed: new Uint8Array(32),
      publicKey: new Uint8Array(32),
      did: `did:yaid:user:${'A'.repeat(64)}`,
    }),
  );
});

test('createIdentity rejects a did missing the did:yaid:user: prefix', () => {
  assert.throws(() =>
    createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(32), did: 'a'.repeat(64) }),
  );
});

test('createIdentity rejects a did with fewer than 64 hex chars', () => {
  assert.throws(() =>
    createIdentity({
      seed: new Uint8Array(32),
      publicKey: new Uint8Array(32),
      did: `did:yaid:user:${'a'.repeat(63)}`,
    }),
  );
});
