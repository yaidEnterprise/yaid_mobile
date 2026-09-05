import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeBase64Url } from '../../../src/shared/clients/base64url';

test('encodes a known 64-byte input to base64url with no padding', () => {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) {
    bytes[i] = i;
  }

  const result = encodeBase64Url(bytes);

  assert.equal(
    result,
    'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-Pw',
  );
  assert.equal(result.includes('='), false);
  assert.equal(result.includes('+'), false);
  assert.equal(result.includes('/'), false);
});
