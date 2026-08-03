import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { PinMismatchError, PinObviousError } from '../../../shared/domain/errors/pin_errors';

export interface DefinePinInput {
  pin: string;
  confirmation: string;
}

export type DefinePinOutput = Record<string, never>;

function isAllSameDigit(pin: string): boolean {
  return pin.split('').every((digit) => digit === pin[0]);
}

function isStrictlyAscending(pin: string): boolean {
  const digits = pin.split('').map(Number);
  return digits.every((digit, index) => index === 0 || digit === digits[index - 1]! + 1);
}

function isStrictlyDescending(pin: string): boolean {
  const digits = pin.split('').map(Number);
  return digits.every((digit, index) => index === 0 || digit === digits[index - 1]! - 1);
}

function isObvious(pin: string): boolean {
  return isAllSameDigit(pin) || isStrictlyAscending(pin) || isStrictlyDescending(pin);
}

export class DefinePinUseCase {
  constructor(private readonly pinLock: IPinLock) {}

  async execute(input: DefinePinInput): Promise<DefinePinOutput> {
    if (input.pin !== input.confirmation) {
      throw new PinMismatchError();
    }
    if (isObvious(input.pin)) {
      throw new PinObviousError();
    }
    await this.pinLock.initialize(input.pin);
    return {};
  }
}
