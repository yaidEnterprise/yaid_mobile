import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VerifyPinUseCase } from '../../../../src/modules/access/app/verify_pin_usecase';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { PinWrongError, PinBackoffActiveError } from '../../../../src/shared/domain/errors/pin_errors';

function makeUseCase() {
  const clock = new ClockMock(0);
  const pinLock = new PinLockMock(clock);
  return { useCase: new VerifyPinUseCase(pinLock), pinLock, clock };
}

test('correct pin resolves with a success outcome', async () => {
  const { useCase, pinLock } = makeUseCase();
  await pinLock.initialize('112233');
  const outcome = await useCase.execute({ pin: '112233' });
  assert.equal(outcome.kind, 'success');
});

test('wrong pin throws PinWrongError with attemptsRemaining', async () => {
  const { useCase, pinLock } = makeUseCase();
  await pinLock.initialize('112233');
  await assert.rejects(
    () => useCase.execute({ pin: '000000' }),
    (err: unknown) => {
      assert.ok(err instanceof PinWrongError);
      assert.equal(err.attemptsRemaining, 4);
      return true;
    },
  );
});

test('an active lockout throws PinBackoffActiveError without consuming an attempt', async () => {
  const { useCase, pinLock } = makeUseCase();
  await pinLock.initialize('112233');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => pinLock.verify('000000'));
  }
  await assert.rejects(() => useCase.execute({ pin: '112233' }), PinBackoffActiveError);
});

test('desisting (no pin submitted) returns a cancelled outcome without consuming an attempt', async () => {
  const { useCase, pinLock } = makeUseCase();
  await pinLock.initialize('112233');
  const before = await pinLock.getStatus();

  const outcome = await useCase.execute({ pin: null });
  assert.equal(outcome.kind, 'cancelled');

  const after = await pinLock.getStatus();
  assert.equal(after.attemptsRemaining, before.attemptsRemaining);
});
