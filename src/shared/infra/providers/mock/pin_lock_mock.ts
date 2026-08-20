import { IPinLock, PinStatus } from '../../../domain/interfaces/providers/pin_lock';
import { IClock } from '../../../domain/interfaces/providers/clock';
import {
  PinNotInitializedError,
  PinWrongError,
  PinBackoffActiveError,
} from '../../../domain/errors/pin_errors';

const LOCKOUT_SCHEDULE_MS = [60_000, 300_000, 900_000, 3_600_000];
const MAX_ATTEMPTS = 5;

function lockoutDurationMs(lockoutCount: number): number {
  const index = Math.min(lockoutCount, LOCKOUT_SCHEDULE_MS.length - 1);
  return LOCKOUT_SCHEDULE_MS[index]!;
}

interface SerializedPinLockState {
  pinValue: string | null;
  attemptCount: number;
  lockoutCount: number;
  lockedUntilMs: number | null;
}

export class PinLockMock implements IPinLock {
  private pinValue: string | null = null;
  private attemptCount = 0;
  private lockoutCount = 0;
  private lockedUntilMs: number | null = null;

  constructor(
    private readonly clock: IClock,
    serialized?: string,
  ) {
    if (serialized !== undefined) {
      const state = JSON.parse(serialized) as SerializedPinLockState;
      this.pinValue = state.pinValue;
      this.attemptCount = state.attemptCount;
      this.lockoutCount = state.lockoutCount;
      this.lockedUntilMs = state.lockedUntilMs;
    }
  }

  /** Simulates persisting to secure storage, for restart regression tests. */
  serialize(): string {
    const state: SerializedPinLockState = {
      pinValue: this.pinValue,
      attemptCount: this.attemptCount,
      lockoutCount: this.lockoutCount,
      lockedUntilMs: this.lockedUntilMs,
    };
    return JSON.stringify(state);
  }

  async initialize(pin: string): Promise<void> {
    this.pinValue = pin;
    this.attemptCount = 0;
    this.lockoutCount = 0;
    this.lockedUntilMs = null;
  }

  async verify(pin: string): Promise<void> {
    if (this.pinValue === null) {
      throw new PinNotInitializedError();
    }

    if (this.isCurrentlyLocked()) {
      throw new PinBackoffActiveError(this.lockedUntilMs!);
    }

    if (pin === this.pinValue) {
      this.attemptCount = 0;
      return;
    }

    this.attemptCount += 1;

    if (this.attemptCount >= MAX_ATTEMPTS) {
      const lockedUntilMs = this.clock.nowMs() + lockoutDurationMs(this.lockoutCount);
      this.lockedUntilMs = lockedUntilMs;
      this.lockoutCount += 1;
      this.attemptCount = 0;
      throw new PinBackoffActiveError(lockedUntilMs);
    }

    throw new PinWrongError(MAX_ATTEMPTS - this.attemptCount);
  }

  async getStatus(): Promise<PinStatus> {
    const isLocked = this.isCurrentlyLocked();
    return {
      isLocked,
      lockedUntilMs: isLocked ? this.lockedUntilMs : null,
      attemptsRemaining: MAX_ATTEMPTS - this.attemptCount,
      lockoutCount: this.lockoutCount,
    };
  }

  private isCurrentlyLocked(): boolean {
    return this.lockedUntilMs !== null && this.clock.nowMs() < this.lockedUntilMs;
  }

  async reset(): Promise<void> {
    this.pinValue = null;
    this.attemptCount = 0;
    this.lockoutCount = 0;
    this.lockedUntilMs = null;
  }
}
