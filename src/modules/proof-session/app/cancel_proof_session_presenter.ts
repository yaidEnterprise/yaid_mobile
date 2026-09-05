import { createClock, createIdentityRepository, createYaIDApi } from '../../../shared/environments';
import { CancelProofSessionUseCase } from './cancel_proof_session_usecase';
import { CancelProofSessionController } from './cancel_proof_session_controller';

export function CancelProofSessionPresenter(): CancelProofSessionController {
  const clock = createClock();
  const identityRepository = createIdentityRepository();
  const yaIDApi = createYaIDApi();

  const useCase = new CancelProofSessionUseCase(identityRepository, yaIDApi, clock);
  return new CancelProofSessionController(useCase);
}
