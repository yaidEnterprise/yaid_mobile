import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefinePinViewModel } from '../../../../src/modules/access/app/define_pin_viewmodel';

test('toDisplay maps the (empty) use case output to an empty display object', () => {
  const viewModel = new DefinePinViewModel();
  const display = viewModel.toDisplay({});
  assert.deepEqual(display, {});
});
