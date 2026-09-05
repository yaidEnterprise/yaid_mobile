import { IssueCredentialUseCase, IssueCredentialInput } from './issue_credential_usecase';
import { IssueCredentialViewModel } from './issue_credential_viewmodel';
import { IssueCredentialResult } from '../../../shared/result/issue_credential_result';
import { PinWrongError, PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';
import { IssuanceApiError } from '../../../shared/domain/errors/credential_errors';

export class IssueCredentialController {
  constructor(
    private readonly useCase: IssueCredentialUseCase,
    private readonly viewModel: IssueCredentialViewModel,
  ) {}

  async execute(input: IssueCredentialInput): Promise<IssueCredentialResult> {
    try {
      const output = await this.useCase.execute(input);
      const display = this.viewModel.fromOutput(output);
      return { kind: 'success', ageOver18: display.ageOver18, issuedAt: display.issuedAt };
    } catch (error) {
      if (error instanceof PinWrongError) {
        return { kind: 'wrong_pin', attemptsRemaining: error.attemptsRemaining };
      }
      if (error instanceof PinBackoffActiveError) {
        const display = this.viewModel.fromBackoffError(error);
        return { kind: 'locked', remainingMs: display.remainingMs };
      }
      if (error instanceof IssuanceApiError) {
        return { kind: 'api_error', cause: error.cause };
      }
      throw error;
    }
  }
}
