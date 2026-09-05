export interface PinStatus {
  isLocked: boolean;
  lockedUntilMs: number | null;
  attemptsRemaining: number;
  lockoutCount: number;
}

export interface IPinLock {
  initialize(pin: string): Promise<void>;
  verify(pin: string): Promise<void>;
  getStatus(): Promise<PinStatus>;
  reset(): Promise<void>;
}
