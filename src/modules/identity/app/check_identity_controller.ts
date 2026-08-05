import { CheckIdentityUseCase, CheckIdentityInput, CheckIdentityOutput } from './check_identity_usecase';

export class CheckIdentityController {
  constructor(private readonly useCase: CheckIdentityUseCase) {}

  async execute(input: CheckIdentityInput): Promise<CheckIdentityOutput> {
    return this.useCase.execute(input);
  }
}
