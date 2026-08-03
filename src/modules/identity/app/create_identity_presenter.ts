import { environments } from '../../../shared/environments';
import { Stage } from '../../../shared/domain/enums/stage';
import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ISigner } from '../../../shared/domain/interfaces/providers/signer';
import { IRandomness } from '../../../shared/domain/interfaces/providers/randomness';
import { IdentityRepositoryMock } from '../../../shared/infra/repositories/mock/identity_repository_mock';
import { SignerMock } from '../../../shared/infra/providers/mock/signer_mock';
import { RandomnessMock } from '../../../shared/infra/providers/mock/randomness_mock';
import { IdentityRepositoryConcrete } from '../../../shared/infra/repositories/identity_repository_concrete';
import { SignerConcrete } from '../../../shared/infra/providers/signer_concrete';
import { RandomnessConcrete } from '../../../shared/infra/providers/randomness_concrete';
import { CreateIdentityUseCase } from './create_identity_usecase';
import { CreateIdentityViewModel } from './create_identity_viewmodel';
import { CreateIdentityController } from './create_identity_controller';

export function CreateIdentityPresenter(): CreateIdentityController {
  const isTest = environments.stage === Stage.Test;

  const signer: ISigner = isTest ? new SignerMock() : new SignerConcrete();
  const randomness: IRandomness = isTest ? new RandomnessMock() : new RandomnessConcrete();
  const identityRepository: IIdentityRepository = isTest
    ? new IdentityRepositoryMock()
    : new IdentityRepositoryConcrete(signer);

  const useCase = new CreateIdentityUseCase(identityRepository, signer, randomness);
  const viewModel = new CreateIdentityViewModel();
  return new CreateIdentityController(useCase, viewModel);
}
