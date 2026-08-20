import { IPinLock, PinStatus } from '../../domain/interfaces/providers/pin_lock';
import { IClock } from '../../domain/interfaces/providers/clock';
import { PinNotInitializedError, PinWrongError, PinBackoffActiveError } from '../../domain/errors/pin_errors';
import { SecureStoreClient } from '../../clients/secure_store_client';

const PIN_VALUE_KEY = 'yaid.pin.value';
const PIN_STATE_KEY = 'yaid.pin.state';

const LOCKOUT_SCHEDULE_MS = [60_000, 300_000, 900_000, 3_600_000];
const MAX_ATTEMPTS = 5;

interface PinState {
  attemptCount: number;
  lockoutCount: number;
  lockedUntilMs: number | null;
}

const CLEAN_STATE: PinState = { attemptCount: 0, lockoutCount: 0, lockedUntilMs: null };

function lockoutDurationMs(lockoutCount: number): number {
  const index = Math.min(lockoutCount, LOCKOUT_SCHEDULE_MS.length - 1);
  return LOCKOUT_SCHEDULE_MS[index]!;
}

export class PinLockConcrete implements IPinLock {
  constructor(private readonly clock: IClock) {}

  async initialize(pin: string): Promise<void> {
    await SecureStoreClient.setItem(PIN_VALUE_KEY, pin);
    await this.persistState(CLEAN_STATE);
  }

  async verify(pin: string): Promise<void> {
    const storedPin = await SecureStoreClient.getItem(PIN_VALUE_KEY);
    if (storedPin === null) {
      throw new PinNotInitializedError();
    }

    const state = await this.loadState();

    if (this.isCurrentlyLocked(state)) {
      throw new PinBackoffActiveError(state.lockedUntilMs!);
    }

    if (pin === storedPin) {
      await this.persistState({ ...state, attemptCount: 0 });
      return;
    }

    const attemptCount = state.attemptCount + 1;

    if (attemptCount >= MAX_ATTEMPTS) {
      const lockedUntilMs = this.clock.nowMs() + lockoutDurationMs(state.lockoutCount);
      await this.persistState({
        attemptCount: 0,
        lockoutCount: state.lockoutCount + 1,
        lockedUntilMs,
      });
      throw new PinBackoffActiveError(lockedUntilMs);
    }

    await this.persistState({ ...state, attemptCount });
    throw new PinWrongError(MAX_ATTEMPTS - attemptCount);
  }

  async getStatus(): Promise<PinStatus> {
    const state = await this.loadState();
    const isLocked = this.isCurrentlyLocked(state);
    return {
      isLocked,
      lockedUntilMs: isLocked ? state.lockedUntilMs : null,
      attemptsRemaining: MAX_ATTEMPTS - state.attemptCount,
      lockoutCount: state.lockoutCount,
    };
  }

  private isCurrentlyLocked(state: PinState): boolean {
    return state.lockedUntilMs !== null && this.clock.nowMs() < state.lockedUntilMs;
  }

  private async loadState(): Promise<PinState> {
    const raw = await SecureStoreClient.getItem(PIN_STATE_KEY);
    if (raw === null) {
      return CLEAN_STATE;
    }
    return JSON.parse(raw) as PinState;
  }

  private async persistState(state: PinState): Promise<void> {
    await SecureStoreClient.setItem(PIN_STATE_KEY, JSON.stringify(state));
  }

  async reset(): Promise<void> {
    await SecureStoreClient.deleteItem(PIN_VALUE_KEY);
    await SecureStoreClient.deleteItem(PIN_STATE_KEY);
  }
}
