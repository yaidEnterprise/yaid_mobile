import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentCaptureMock } from '../../../../../src/shared/infra/providers/mock/document_capture_mock';

test('capture returns a fixed, deterministic base64 fixture', async () => {
  const capture = new DocumentCaptureMock();
  const first = await capture.capture();
  const second = await capture.capture();
  assert.equal(first, second);
  assert.ok(first.length > 0);
});

test('capture returns a base64 string without a data: prefix', async () => {
  const capture = new DocumentCaptureMock();
  const image = await capture.capture();
  assert.equal(image.startsWith('data:'), false);
});
