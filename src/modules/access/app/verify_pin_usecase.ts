import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';

export interface VerifyPinInput {
  pin: string | null;
}

export type VerifyPinOutcome = { kind: 'success' } | { kind: 'cancelled' };

export class VerifyPinUseCase {
  constructor(private readonly pinLock: IPinLock) {}

  async execute(input: VerifyPinInput): Promise<VerifyPinOutcome> {
    if (input.pin === null) {
      return { kind: 'cancelled' };
    }

    const status = await this.pinLock.getStatus();
    if (status.isLocked) {
      throw new PinBackoffActiveError(status.lockedUntilMs!);
    }

    await this.pinLock.verify(input.pin);
    return { kind: 'success' };
  }
}
