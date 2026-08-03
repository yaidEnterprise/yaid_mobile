import { environments } from '../../../shared/environments';
import { Stage } from '../../../shared/domain/enums/stage';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { ClockMock } from '../../../shared/infra/providers/mock/clock_mock';
import { PinLockMock } from '../../../shared/infra/providers/mock/pin_lock_mock';
import { ClockConcrete } from '../../../shared/infra/providers/clock_concrete';
import { PinLockConcrete } from '../../../shared/infra/providers/pin_lock_concrete';
import { VerifyPinUseCase } from './verify_pin_usecase';
import { VerifyPinViewModel } from './verify_pin_viewmodel';
import { VerifyPinController } from './verify_pin_controller';

export function VerifyPinPresenter(): VerifyPinController {
  const clock: IClock = environments.stage === Stage.Test ? new ClockMock() : new ClockConcrete();
  const pinLock: IPinLock =
    environments.stage === Stage.Test ? new PinLockMock(clock) : new PinLockConcrete(clock);

  const useCase = new VerifyPinUseCase(pinLock);
  const viewModel = new VerifyPinViewModel(clock);
  return new VerifyPinController(useCase, viewModel);
}
