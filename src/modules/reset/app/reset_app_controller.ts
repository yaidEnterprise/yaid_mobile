import { ResetAppUseCase, ResetAppInput, ResetAppOutput } from './reset_app_usecase';

export class ResetAppController {
  constructor(private readonly useCase: ResetAppUseCase) {}

  async execute(input: ResetAppInput): Promise<ResetAppOutput> {
    return this.useCase.execute(input);
  }
}
