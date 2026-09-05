import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresentProofViewModel } from '../../../../src/modules/presentation/app/present_proof_viewmodel';

test('exposes only verifiedAtLabel', () => {
  const viewModel = new PresentProofViewModel();
  const display = viewModel.fromOutput({ verifiedAt: new Date('2026-08-02T15:30:00Z') });

  assert.deepEqual(Object.keys(display), ['verifiedAtLabel']);
  assert.equal(typeof display.verifiedAtLabel, 'string');
  assert.ok(display.verifiedAtLabel.length > 0);
});
