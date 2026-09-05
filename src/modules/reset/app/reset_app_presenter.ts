import {
  createClock,
  createPinLock,
  createIdentityRepository,
  createCredentialRepository,
} from '../../../shared/environments';
import { ResetAppUseCase } from './reset_app_usecase';
import { ResetAppController } from './reset_app_controller';

export function ResetAppPresenter(): ResetAppController {
  const clock = createClock();
  const pinLock = createPinLock(clock);
  const identityRepository = createIdentityRepository();
  const credentialRepository = createCredentialRepository();

  const useCase = new ResetAppUseCase(identityRepository, credentialRepository, pinLock);
  return new ResetAppController(useCase);
}
