import { CancelProofSessionUseCase, CancelProofSessionInput } from './cancel_proof_session_usecase';

export type CancelProofSessionScreenResult = { kind: 'success' };

export class CancelProofSessionController {
  constructor(private readonly useCase: CancelProofSessionUseCase) {}

  async execute(input: CancelProofSessionInput): Promise<CancelProofSessionScreenResult> {
    await this.useCase.execute(input);
    return { kind: 'success' };
  }
}
