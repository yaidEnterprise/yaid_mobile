import { PresentProofUseCase, PresentProofInput } from './present_proof_usecase';
import { PresentProofViewModel } from './present_proof_viewmodel';
import { PinWrongError, PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';
import { AuthClockSkewError, PresentationRejectedError } from '../../../shared/domain/errors/presentation_errors';

export type PresentProofScreenResult =
  | { kind: 'success'; verifiedAtLabel: string }
  | { kind: 'wrong_pin'; attemptsRemaining: number }
  | { kind: 'locked'; lockedUntilMs: number }
  | { kind: 'rejected' }
  | { kind: 'clock_skew' };

export class PresentProofController {
  constructor(
    private readonly useCase: PresentProofUseCase,
    private readonly viewModel: PresentProofViewModel,
  ) {}

  async execute(input: PresentProofInput): Promise<PresentProofScreenResult> {
    try {
      const output = await this.useCase.execute(input);
      const display = this.viewModel.fromOutput(output);
      return { kind: 'success', verifiedAtLabel: display.verifiedAtLabel };
    } catch (error) {
      if (error instanceof PinWrongError) {
        return { kind: 'wrong_pin', attemptsRemaining: error.attemptsRemaining };
      }
      if (error instanceof PinBackoffActiveError) {
        return { kind: 'locked', lockedUntilMs: error.lockedUntilMs };
      }
      if (error instanceof AuthClockSkewError) {
        return { kind: 'clock_skew' };
      }
      if (error instanceof PresentationRejectedError) {
        return { kind: 'rejected' };
      }
      throw error;
    }
  }
}
