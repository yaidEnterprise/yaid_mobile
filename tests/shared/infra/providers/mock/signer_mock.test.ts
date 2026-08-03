import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignerMock } from '../../../../../src/shared/infra/providers/mock/signer_mock';

const SEED = new Uint8Array(32).fill(7);
const PAYLOAD = new Uint8Array([1, 2, 3, 4]);

test('getPublicKey is synchronous and deterministic for a fixed seed', () => {
  const signer = new SignerMock();
  const first = signer.getPublicKey(SEED);
  const second = signer.getPublicKey(SEED);
  assert.equal(first.length, 32);
  assert.deepEqual(first, second);
});

test('different seeds produce different public keys', () => {
  const signer = new SignerMock();
  const a = signer.getPublicKey(new Uint8Array(32).fill(1));
  const b = signer.getPublicKey(new Uint8Array(32).fill(2));
  assert.notDeepEqual(a, b);
});

test('sign produces a deterministic 64-byte signature for a fixed seed and payload', async () => {
  const signer = new SignerMock();
  const first = await signer.sign(PAYLOAD, SEED);
  const second = await signer.sign(PAYLOAD, SEED);
  assert.equal(first.length, 64);
  assert.deepEqual(first, second);
});
