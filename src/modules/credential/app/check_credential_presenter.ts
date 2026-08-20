import { createCredentialRepository } from '../../../shared/environments';
import { CheckCredentialUseCase } from './check_credential_usecase';
import { CheckCredentialController } from './check_credential_controller';

export function CheckCredentialPresenter(): CheckCredentialController {
  const credentialRepository = createCredentialRepository();
  const useCase = new CheckCredentialUseCase(credentialRepository);
  return new CheckCredentialController(useCase);
}
