import { createIdentityRepository, createRandomness } from '../../../shared/environments';
import { CreateIdentityUseCase } from './create_identity_usecase';
import { CreateIdentityViewModel } from './create_identity_viewmodel';
import { CreateIdentityController } from './create_identity_controller';

export function CreateIdentityPresenter(): CreateIdentityController {
  const randomness = createRandomness();
  const identityRepository = createIdentityRepository();

  const useCase = new CreateIdentityUseCase(identityRepository, randomness);
  const viewModel = new CreateIdentityViewModel();
  return new CreateIdentityController(useCase, viewModel);
}
