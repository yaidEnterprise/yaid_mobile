import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefinePinUseCase } from '../../../../src/modules/access/app/define_pin_usecase';
import { PinLockMock } from '../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { PinMismatchError, PinObviousError } from '../../../../src/shared/domain/errors/pin_errors';

function makeUseCase() {
  const pinLock = new PinLockMock(new ClockMock(0));
  return { useCase: new DefinePinUseCase(pinLock), pinLock };
}

test('matching, non-obvious pin and confirmation initializes the pin lock', async () => {
  const { useCase, pinLock } = makeUseCase();
  await useCase.execute({ pin: '112233', confirmation: '112233' });
  await assert.doesNotReject(() => pinLock.verify('112233'));
});

test('pin different from confirmation throws PinMismatchError', async () => {
  const { useCase } = makeUseCase();
  await assert.rejects(
    () => useCase.execute({ pin: '123456', confirmation: '234567' }),
    PinMismatchError,
  );
});

test('all-same-digit pin (111111) throws PinObviousError', async () => {
  const { useCase } = makeUseCase();
  await assert.rejects(() => useCase.execute({ pin: '111111', confirmation: '111111' }), PinObviousError);
});

test('ascending sequence pin (123456) throws PinObviousError', async () => {
  const { useCase } = makeUseCase();
  await assert.rejects(() => useCase.execute({ pin: '123456', confirmation: '123456' }), PinObviousError);
});

test('descending sequence pin (987654) throws PinObviousError', async () => {
  const { useCase } = makeUseCase();
  await assert.rejects(() => useCase.execute({ pin: '987654', confirmation: '987654' }), PinObviousError);
});

test('non-obvious pin (112233) is accepted', async () => {
  const { useCase } = makeUseCase();
  await assert.doesNotReject(() => useCase.execute({ pin: '112233', confirmation: '112233' }));
});
