import { GetProofSessionUseCase, GetProofSessionInput } from './get_proof_session_usecase';
import { GetProofSessionViewModel } from './get_proof_session_viewmodel';
import {
  SessionExpiredError,
  SessionIneligibleError,
  SessionNotFoundError,
} from '../../../shared/domain/errors/presentation_errors';

export type GetProofSessionScreenResult =
  | { kind: 'success'; sessionToken: string; companyName: string; proofTypeLabel: string; canDecide: boolean }
  | { kind: 'needs_identity'; companyName: string }
  | { kind: 'needs_credential'; companyName: string }
  | { kind: 'ineligible'; companyName: string; proofTypeLabel: string }
  | { kind: 'expired' };

export class GetProofSessionController {
  constructor(
    private readonly useCase: GetProofSessionUseCase,
    private readonly viewModel: GetProofSessionViewModel,
  ) {}

  async execute(input: GetProofSessionInput): Promise<GetProofSessionScreenResult> {
    const result = await this.useCase.execute(input);

    if (result.ok) {
      const display = this.viewModel.fromSession(result.session);
      return {
        kind: 'success',
        sessionToken: result.session.token,
        companyName: display.companyName,
        proofTypeLabel: display.proofTypeLabel,
        canDecide: display.canDecide,
      };
    }

    if ('reason' in result) {
      if (result.reason === 'needs_identity') {
        return { kind: 'needs_identity', companyName: result.companyName };
      }
      return { kind: 'needs_credential', companyName: result.companyName };
    }

    if (result.error instanceof SessionIneligibleError) {
      return { kind: 'ineligible', companyName: '', proofTypeLabel: '' };
    }
    if (result.error instanceof SessionExpiredError || result.error instanceof SessionNotFoundError) {
      return { kind: 'expired' };
    }

    throw result.error;
  }
}
