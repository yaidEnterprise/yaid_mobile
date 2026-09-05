import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImageProcessorMock } from '../../../../../src/shared/infra/providers/mock/image_processor_mock';

test('compress is a passthrough, returning the input unchanged', async () => {
  const processor = new ImageProcessorMock();
  const input = 'ZmFrZS1pbWFnZS1kYXRh';
  const output = await processor.compress(input);
  assert.equal(output, input);
});
