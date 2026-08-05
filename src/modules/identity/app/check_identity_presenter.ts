import { createIdentityRepository } from '../../../shared/environments';
import { CheckIdentityUseCase } from './check_identity_usecase';
import { CheckIdentityController } from './check_identity_controller';

export function CheckIdentityPresenter(): CheckIdentityController {
  const identityRepository = createIdentityRepository();
  const useCase = new CheckIdentityUseCase(identityRepository);
  return new CheckIdentityController(useCase);
}
