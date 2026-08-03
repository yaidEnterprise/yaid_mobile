import { environments } from '../../../shared/environments';
import { Stage } from '../../../shared/domain/enums/stage';
import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ISigner } from '../../../shared/domain/interfaces/providers/signer';
import { IdentityRepositoryMock } from '../../../shared/infra/repositories/mock/identity_repository_mock';
import { SignerMock } from '../../../shared/infra/providers/mock/signer_mock';
import { IdentityRepositoryConcrete } from '../../../shared/infra/repositories/identity_repository_concrete';
import { SignerConcrete } from '../../../shared/infra/providers/signer_concrete';
import { CheckIdentityUseCase } from './check_identity_usecase';
import { CheckIdentityController } from './check_identity_controller';

export function CheckIdentityPresenter(): CheckIdentityController {
  const isTest = environments.stage === Stage.Test;
  const signer: ISigner = isTest ? new SignerMock() : new SignerConcrete();
  const identityRepository: IIdentityRepository = isTest
    ? new IdentityRepositoryMock()
    : new IdentityRepositoryConcrete(signer);

  const useCase = new CheckIdentityUseCase(identityRepository);
  return new CheckIdentityController(useCase);
}
