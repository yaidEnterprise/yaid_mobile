import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VerifyPinController } from '../../../../src/modules/access/app/verify_pin_controller';
import { VerifyPinUseCase } from '../../../../src/modules/access/app/verify_pin_usecase';
import { VerifyPinViewModel } from '../../../../src/modules/access/app/verify_pin_viewmodel';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';

function makeController() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  const useCase = new VerifyPinUseCase(pinLock);
  const viewModel = new VerifyPinViewModel(clock);
  return { controller: new VerifyPinController(useCase, viewModel), pinLock };
}

test('correct pin returns a success result', async () => {
  const { controller, pinLock } = makeController();
  await pinLock.initialize('112233');
  const result = await controller.execute({ pin: '112233' });
  assert.deepEqual(result, { kind: 'success' });
});

test('wrong pin returns a wrong result carrying attemptsRemaining', async () => {
  const { controller, pinLock } = makeController();
  await pinLock.initialize('112233');
  const result = await controller.execute({ pin: '000000' });
  assert.equal(result.kind, 'wrong');
  assert.ok('attemptsRemaining' in result && result.attemptsRemaining === 4);
});

test('active lockout returns a locked result carrying remainingMs', async () => {
  const { controller, pinLock } = makeController();
  await pinLock.initialize('112233');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => pinLock.verify('000000'));
  }
  const result = await controller.execute({ pin: '112233' });
  assert.equal(result.kind, 'locked');
  assert.ok('remainingMs' in result && result.remainingMs > 0);
});

test('desisting returns a cancelled result', async () => {
  const { controller, pinLock } = makeController();
  await pinLock.initialize('112233');
  const result = await controller.execute({ pin: null });
  assert.deepEqual(result, { kind: 'cancelled' });
});
