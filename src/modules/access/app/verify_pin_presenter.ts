import { createClock, createPinLock } from '../../../shared/environments';
import { VerifyPinUseCase } from './verify_pin_usecase';
import { VerifyPinViewModel } from './verify_pin_viewmodel';
import { VerifyPinController } from './verify_pin_controller';

export function VerifyPinPresenter(): VerifyPinController {
  const clock = createClock();
  const pinLock = createPinLock(clock);

  const useCase = new VerifyPinUseCase(pinLock);
  const viewModel = new VerifyPinViewModel(clock);
  return new VerifyPinController(useCase, viewModel);
}
