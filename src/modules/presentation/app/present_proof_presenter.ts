import {
  createClock,
  createPinLock,
  createIdentityRepository,
  createCredentialRepository,
  createYaIDApi,
} from '../../../shared/environments';
import { PresentProofUseCase } from './present_proof_usecase';
import { PresentProofViewModel } from './present_proof_viewmodel';
import { PresentProofController } from './present_proof_controller';

export function PresentProofPresenter(): PresentProofController {
  const clock = createClock();
  const pinLock = createPinLock(clock);
  const identityRepository = createIdentityRepository();
  const credentialRepository = createCredentialRepository();
  const yaIDApi = createYaIDApi();

  const useCase = new PresentProofUseCase(pinLock, identityRepository, credentialRepository, yaIDApi, clock);
  const viewModel = new PresentProofViewModel();
  return new PresentProofController(useCase, viewModel);
}
