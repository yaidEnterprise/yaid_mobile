import { CreateIdentityUseCase, CreateIdentityInput } from './create_identity_usecase';
import { CreateIdentityViewModel } from './create_identity_viewmodel';
import { CreateIdentityResult } from '../../../shared/result/create_identity_result';
import { IdentityCreationFailedError } from '../../../shared/domain/errors/identity_errors';

export class CreateIdentityController {
  constructor(
    private readonly useCase: CreateIdentityUseCase,
    private readonly viewModel: CreateIdentityViewModel,
  ) {}

  async execute(input: CreateIdentityInput): Promise<CreateIdentityResult> {
    try {
      const identity = await this.useCase.execute(input);
      const display = this.viewModel.toDisplay(identity);
      return { kind: 'success', did: display.did };
    } catch (error) {
      if (error instanceof IdentityCreationFailedError) {
        return { kind: 'error', message: 'Não foi possível criar sua identidade neste aparelho. Tente novamente.' };
      }
      throw error;
    }
  }
}
