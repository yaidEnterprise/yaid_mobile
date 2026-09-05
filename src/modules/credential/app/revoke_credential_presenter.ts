import {
  createClock,
  createPinLock,
  createIdentityRepository,
  createCredentialRepository,
  createYaIDApi,
} from '../../../shared/environments';
import { RevokeCredentialUseCase } from './revoke_credential_usecase';
import { RevokeCredentialViewModel } from './revoke_credential_viewmodel';
import { RevokeCredentialController } from './revoke_credential_controller';

export function RevokeCredentialPresenter(): RevokeCredentialController {
  const clock = createClock();
  const pinLock = createPinLock(clock);
  const identityRepository = createIdentityRepository();
  const credentialRepository = createCredentialRepository();
  const yaIDApi = createYaIDApi();

  const useCase = new RevokeCredentialUseCase(identityRepository, credentialRepository, pinLock, clock, yaIDApi);
  const viewModel = new RevokeCredentialViewModel();
  return new RevokeCredentialController(useCase, viewModel);
}
