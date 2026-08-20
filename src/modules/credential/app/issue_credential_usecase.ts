import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ICredentialRepository } from '../../../shared/domain/interfaces/repositories/credential_repository';
import { IImageProcessor } from '../../../shared/domain/interfaces/providers/image_processor';
import { IYaIDApi } from '../../../shared/domain/interfaces/providers/yaid_api';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { CredentialAlreadyExistsError } from '../../../shared/domain/errors/credential_errors';

export interface IssueCredentialInput {
  pin: string;
  documentImage: string;
}

export interface IssueCredentialOutput {
  ageOver18: boolean;
  issuedAt: Date;
}

export class IssueCredentialUseCase {
  constructor(
    private readonly pinLock: IPinLock,
    private readonly identityRepository: IIdentityRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly imageProcessor: IImageProcessor,
    private readonly yaIDApi: IYaIDApi,
    private readonly clock: IClock,
  ) {}

  async execute(input: IssueCredentialInput): Promise<IssueCredentialOutput> {
    await this.pinLock.verify(input.pin);

    if (await this.credentialRepository.exists()) {
      throw new CredentialAlreadyExistsError();
    }

    const identity = await this.identityRepository.load();
    if (identity === null) {
      throw new Error('IssueCredentialUseCase: no identity found');
    }

    const compressed = await this.imageProcessor.compress(input.documentImage);

    const credential = await this.yaIDApi.issueCredential({
      did: identity.did,
      seed: identity.seed,
      documentImage: compressed,
      clock: this.clock,
    });

    await this.credentialRepository.save(credential);

    return { ageOver18: credential.ageOver18, issuedAt: credential.issuedAt };
  }
}
