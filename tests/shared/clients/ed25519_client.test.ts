import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ed25519Client } from '../../../src/shared/clients/ed25519_client';

const SEED = new Uint8Array(32).fill(7);
const PAYLOAD = new Uint8Array([1, 2, 3, 4]);

test('getPublicKey is synchronous and deterministic for a fixed seed', () => {
  const first = Ed25519Client.getPublicKey(SEED);
  const second = Ed25519Client.getPublicKey(SEED);
  assert.equal(first.length, 32);
  assert.deepEqual(first, second);
});

test('different seeds produce different public keys', () => {
  const a = Ed25519Client.getPublicKey(new Uint8Array(32).fill(1));
  const b = Ed25519Client.getPublicKey(new Uint8Array(32).fill(2));
  assert.notDeepEqual(a, b);
});

test('sign produces a deterministic 64-byte signature for a fixed seed and payload', async () => {
  const first = await Ed25519Client.sign(PAYLOAD, SEED);
  const second = await Ed25519Client.sign(PAYLOAD, SEED);
  assert.equal(first.length, 64);
  assert.deepEqual(first, second);
});
