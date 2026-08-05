import { createClock, createPinLock } from '../../../shared/environments';
import { DefinePinUseCase } from './define_pin_usecase';
import { DefinePinViewModel } from './define_pin_viewmodel';
import { DefinePinController } from './define_pin_controller';

export function DefinePinPresenter(): DefinePinController {
  const clock = createClock();
  const pinLock = createPinLock(clock);

  const useCase = new DefinePinUseCase(pinLock);
  const viewModel = new DefinePinViewModel();
  return new DefinePinController(useCase, viewModel);
}
