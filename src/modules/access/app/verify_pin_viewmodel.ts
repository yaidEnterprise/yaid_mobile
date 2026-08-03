import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { PinWrongError, PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';

export interface WrongPinDisplay {
  attemptsRemaining: number;
}

export interface LockedPinDisplay {
  remainingMs: number;
}

export class VerifyPinViewModel {
  constructor(private readonly clock: IClock) {}

  fromWrongError(error: PinWrongError): WrongPinDisplay {
    return { attemptsRemaining: error.attemptsRemaining };
  }

  fromBackoffError(error: PinBackoffActiveError): LockedPinDisplay {
    return { remainingMs: error.lockedUntilMs - this.clock.nowMs() };
  }
}
