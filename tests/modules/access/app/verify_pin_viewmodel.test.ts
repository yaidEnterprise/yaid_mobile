import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VerifyPinViewModel } from '../../../../src/modules/access/app/verify_pin_viewmodel';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';
import { PinWrongError, PinBackoffActiveError } from '../../../../src/shared/domain/errors/pin_errors';

test('fromWrongError maps PinWrongError to { attemptsRemaining }', () => {
  const viewModel = new VerifyPinViewModel(new ClockMock(0));
  const display = viewModel.fromWrongError(new PinWrongError(2));
  assert.deepEqual(display, { attemptsRemaining: 2 });
});

test('fromBackoffError maps PinBackoffActiveError to { remainingMs } derived from lockedUntilMs - now', () => {
  const clock = new ClockMock(10_000);
  const viewModel = new VerifyPinViewModel(clock);
  const display = viewModel.fromBackoffError(new PinBackoffActiveError(70_000));
  assert.deepEqual(display, { remainingMs: 60_000 });
});
