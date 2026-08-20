import { CheckCredentialUseCase, CheckCredentialInput, CheckCredentialOutput } from './check_credential_usecase';

export class CheckCredentialController {
  constructor(private readonly useCase: CheckCredentialUseCase) {}

  async execute(input: CheckCredentialInput): Promise<CheckCredentialOutput> {
    return this.useCase.execute(input);
  }
}
