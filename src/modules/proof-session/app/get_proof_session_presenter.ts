import {
  createYaIDApi,
  createIdentityRepository,
  createCredentialRepository,
} from '../../../shared/environments';
import { GetProofSessionUseCase } from './get_proof_session_usecase';
import { GetProofSessionViewModel } from './get_proof_session_viewmodel';
import { GetProofSessionController } from './get_proof_session_controller';

export function GetProofSessionPresenter(): GetProofSessionController {
  const yaIDApi = createYaIDApi();
  const identityRepository = createIdentityRepository();
  const credentialRepository = createCredentialRepository();

  const useCase = new GetProofSessionUseCase(yaIDApi, identityRepository, credentialRepository);
  const viewModel = new GetProofSessionViewModel();
  return new GetProofSessionController(useCase, viewModel);
}
