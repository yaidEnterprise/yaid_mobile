export class PinNotInitializedError extends Error {
  readonly kind = 'pin_not_initialized';
}

export class PinWrongError extends Error {
  readonly kind = 'pin_wrong';
  constructor(readonly attemptsRemaining: number) {
    super();
  }
}

export class PinBackoffActiveError extends Error {
  readonly kind = 'pin_backoff_active';
  constructor(readonly lockedUntilMs: number) {
    super();
  }
}

export class PinObviousError extends Error {
  readonly kind = 'pin_obvious';
}

export class PinMismatchError extends Error {
  readonly kind = 'pin_mismatch';
}
