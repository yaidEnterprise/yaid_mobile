import {
  createClock,
  createPinLock,
  createIdentityRepository,
  createCredentialRepository,
  createImageProcessor,
  createYaIDApi,
} from '../../../shared/environments';
import { IssueCredentialUseCase } from './issue_credential_usecase';
import { IssueCredentialViewModel } from './issue_credential_viewmodel';
import { IssueCredentialController } from './issue_credential_controller';

export function IssueCredentialPresenter(): IssueCredentialController {
  const clock = createClock();
  const pinLock = createPinLock(clock);
  const identityRepository = createIdentityRepository();
  const credentialRepository = createCredentialRepository();
  const imageProcessor = createImageProcessor();
  const yaIDApi = createYaIDApi();

  const useCase = new IssueCredentialUseCase(
    pinLock,
    identityRepository,
    credentialRepository,
    imageProcessor,
    yaIDApi,
    clock,
  );
  const viewModel = new IssueCredentialViewModel(clock);
  return new IssueCredentialController(useCase, viewModel);
}
