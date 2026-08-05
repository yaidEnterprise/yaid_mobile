import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClockMock } from '../../../../../src/shared/infra/providers/mock/clock_mock';

test('nowMs returns the value the clock was constructed with', () => {
  const clock = new ClockMock(1_000_000);
  assert.equal(clock.nowMs(), 1_000_000);
});

test('nowSeconds derives the integer floor of nowMs / 1000', () => {
  const clock = new ClockMock(1_500);
  assert.equal(clock.nowSeconds(), 1);
});

test('advance(ms) increments nowMs by delta', () => {
  const clock = new ClockMock(1_000);
  clock.advance(500);
  assert.equal(clock.nowMs(), 1_500);
  clock.advance(500);
  assert.equal(clock.nowMs(), 2_000);
});
