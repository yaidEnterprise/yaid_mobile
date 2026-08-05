import { DefinePinUseCase, DefinePinInput } from './define_pin_usecase';
import { DefinePinViewModel } from './define_pin_viewmodel';
import { DefinePinResult } from '../../../shared/result/define_pin_result';
import { PinMismatchError, PinObviousError } from '../../../shared/domain/errors/pin_errors';

export class DefinePinController {
  constructor(
    private readonly useCase: DefinePinUseCase,
    private readonly viewModel: DefinePinViewModel,
  ) {}

  async execute(input: DefinePinInput): Promise<DefinePinResult> {
    try {
      const output = await this.useCase.execute(input);
      this.viewModel.toDisplay(output);
      return { kind: 'success' };
    } catch (error) {
      if (error instanceof PinMismatchError) {
        return { kind: 'mismatch', message: 'Os dígitos não coincidem. Digite novamente para confirmar.' };
      }
      if (error instanceof PinObviousError) {
        return {
          kind: 'obvious',
          message: 'Essa combinação é fácil de adivinhar. Escolha dígitos menos previsíveis.',
        };
      }
      throw error;
    }
  }
}
