import { VerifyPinUseCase, VerifyPinInput } from './verify_pin_usecase';
import { VerifyPinViewModel } from './verify_pin_viewmodel';
import { VerifyPinResult } from '../../../shared/result/verify_pin_result';
import { PinWrongError, PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';

export class VerifyPinController {
  constructor(
    private readonly useCase: VerifyPinUseCase,
    private readonly viewModel: VerifyPinViewModel,
  ) {}

  async execute(input: VerifyPinInput): Promise<VerifyPinResult> {
    try {
      const outcome = await this.useCase.execute(input);
      if (outcome.kind === 'cancelled') {
        return { kind: 'cancelled' };
      }
      return { kind: 'success' };
    } catch (error) {
      if (error instanceof PinWrongError) {
        const display = this.viewModel.fromWrongError(error);
        return { kind: 'wrong', attemptsRemaining: display.attemptsRemaining };
      }
      if (error instanceof PinBackoffActiveError) {
        const display = this.viewModel.fromBackoffError(error);
        return { kind: 'locked', remainingMs: display.remainingMs };
      }
      throw error;
    }
  }
}
