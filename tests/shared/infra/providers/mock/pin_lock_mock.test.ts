import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PinLockMock } from '../../../../../src/shared/infra/providers/mock/pin_lock_mock';
import { ClockMock } from '../../../../../src/shared/infra/providers/mock/clock_mock';
import { IdentityRepositoryMock } from '../../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { createIdentity } from '../../../../../src/shared/domain/entities/identity';
import { PinWrongError, PinBackoffActiveError } from '../../../../../src/shared/domain/errors/pin_errors';

test('initialize then verify with the correct PIN resolves', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  await assert.doesNotReject(() => lock.verify('123123'));
});

test('verify with wrong PIN four times throws PinWrongError with attemptsRemaining counting down to 1', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');

  for (let i = 0; i < 3; i++) {
    await assert.rejects(() => lock.verify('000000'), PinWrongError);
  }
  await assert.rejects(
    () => lock.verify('000000'),
    (err: unknown) => {
      assert.ok(err instanceof PinWrongError);
      assert.equal(err.attemptsRemaining, 1);
      return true;
    },
  );
});

test('the 5th wrong attempt triggers PinBackoffActiveError with lockedUntilMs', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');

  for (let i = 0; i < 4; i++) {
    await assert.rejects(() => lock.verify('000000'), PinWrongError);
  }
  await assert.rejects(
    () => lock.verify('000000'),
    (err: unknown) => {
      assert.ok(err instanceof PinBackoffActiveError);
      assert.equal(err.lockedUntilMs, 60_000);
      return true;
    },
  );
});

test('verify during active lockout always throws PinBackoffActiveError, even with the correct PIN', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  await assert.rejects(() => lock.verify('123123'), PinBackoffActiveError);
});

test('advancing the clock past lockout expiry allows verify(correct) to succeed again', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  clock.advance(60_001);
  await assert.doesNotReject(() => lock.verify('123123'));
});

test('a second lockout escalates to a longer duration than the first', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');

  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  const status1 = await lock.getStatus();
  const firstLockedUntil = status1.lockedUntilMs;
  assert.ok(firstLockedUntil !== null);

  clock.advance(60_001);

  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  const status2 = await lock.getStatus();
  const secondDuration = status2.lockedUntilMs! - clock.nowMs();
  const firstDuration = firstLockedUntil - 0;
  assert.ok(secondDuration > firstDuration, `expected second lockout (${secondDuration}) > first (${firstDuration})`);
});

test('getStatus never consumes an attempt, even called repeatedly', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  for (let i = 0; i < 100; i++) {
    await lock.getStatus();
  }
  const status = await lock.getStatus();
  assert.equal(status.attemptsRemaining, 5);
});

test('a successful verify resets attemptsRemaining back to 5', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  for (let i = 0; i < 3; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  await lock.verify('123123');
  const status = await lock.getStatus();
  assert.equal(status.attemptsRemaining, 5);
});

test('regression: lockout survives a simulated app restart (serialize then reconstruct)', async () => {
  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  const statusBeforeRestart = await lock.getStatus();
  assert.equal(statusBeforeRestart.isLocked, true);

  const serialized = lock.serialize();
  const restartedLock = new PinLockMock(clock, serialized);

  const statusAfterRestart = await restartedLock.getStatus();
  assert.deepEqual(statusAfterRestart, statusBeforeRestart);
  await assert.rejects(() => restartedLock.verify('123123'), PinBackoffActiveError);
});

test('regression: IdentityRepositoryMock.exists() stays true before and after any number of wrong PIN attempts', async () => {
  const identityRepo = new IdentityRepositoryMock();
  const did = `did:yaid:user:${'a'.repeat(64)}`;
  await identityRepo.save(createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(32), did }));
  assert.equal(await identityRepo.exists(), true);

  const clock = new ClockMock(0);
  const lock = new PinLockMock(clock);
  await lock.initialize('123123');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => lock.verify('000000'));
  }
  assert.equal(await identityRepo.exists(), true);
});
