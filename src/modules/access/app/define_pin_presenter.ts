import { environments } from '../../../shared/environments';
import { Stage } from '../../../shared/domain/enums/stage';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { ClockMock } from '../../../shared/infra/providers/mock/clock_mock';
import { PinLockMock } from '../../../shared/infra/providers/mock/pin_lock_mock';
import { ClockConcrete } from '../../../shared/infra/providers/clock_concrete';
import { PinLockConcrete } from '../../../shared/infra/providers/pin_lock_concrete';
import { DefinePinUseCase } from './define_pin_usecase';
import { DefinePinViewModel } from './define_pin_viewmodel';
import { DefinePinController } from './define_pin_controller';

export function DefinePinPresenter(): DefinePinController {
  const clock: IClock = environments.stage === Stage.Test ? new ClockMock() : new ClockConcrete();
  const pinLock: IPinLock =
    environments.stage === Stage.Test ? new PinLockMock(clock) : new PinLockConcrete(clock);

  const useCase = new DefinePinUseCase(pinLock);
  const viewModel = new DefinePinViewModel();
  return new DefinePinController(useCase, viewModel);
}
