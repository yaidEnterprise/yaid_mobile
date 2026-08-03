import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RandomnessMock } from '../../../../../src/shared/infra/providers/mock/randomness_mock';

test('getBytes returns a fixed deterministic sequence of the requested length', () => {
  const randomness = new RandomnessMock();
  const first = randomness.getBytes(32);
  const second = randomness.getBytes(32);
  assert.equal(first.length, 32);
  assert.deepEqual(first, second);
});

test('getBytes respects the requested length for different values of n', () => {
  const randomness = new RandomnessMock();
  assert.equal(randomness.getBytes(16).length, 16);
  assert.equal(randomness.getBytes(64).length, 64);
  assert.equal(randomness.getBytes(0).length, 0);
});

test('getBytes(n) is a deterministic prefix-stable sequence', () => {
  const randomness = new RandomnessMock();
  const short = randomness.getBytes(4);
  const long = randomness.getBytes(8);
  assert.deepEqual(long.slice(0, 4), short);
});
