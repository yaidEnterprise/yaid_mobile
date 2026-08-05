import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefinePinController } from '../../../../src/modules/access/app/define_pin_controller';
import { DefinePinUseCase } from '../../../../src/modules/access/app/define_pin_usecase';
import { DefinePinViewModel } from '../../../../src/modules/access/app/define_pin_viewmodel';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';

function makeController() {
  const pinLock = new PinLockMock(new ClockMock(0));
  const useCase = new DefinePinUseCase(pinLock);
  const viewModel = new DefinePinViewModel();
  return new DefinePinController(useCase, viewModel);
}

test('valid, matching, non-obvious pin returns a success result', async () => {
  const controller = makeController();
  const result = await controller.execute({ pin: '112233', confirmation: '112233' });
  assert.equal(result.kind, 'success');
});

test('mismatched pin and confirmation returns a mismatch result with a message', async () => {
  const controller = makeController();
  const result = await controller.execute({ pin: '123456', confirmation: '234567' });
  assert.equal(result.kind, 'mismatch');
  assert.ok('message' in result && result.message.length > 0);
});

test('obvious pin returns an obvious result with a message', async () => {
  const controller = makeController();
  const result = await controller.execute({ pin: '111111', confirmation: '111111' });
  assert.equal(result.kind, 'obvious');
  assert.ok('message' in result && result.message.length > 0);
});
