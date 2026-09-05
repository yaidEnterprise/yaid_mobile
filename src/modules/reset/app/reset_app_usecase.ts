import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ICredentialRepository } from '../../../shared/domain/interfaces/repositories/credential_repository';
import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';

export type ResetAppInput = Record<string, never>;
export type ResetAppOutput = Record<string, never>;

export class ResetAppUseCase {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly pinLock: IPinLock,
  ) {}

  async execute(_input: ResetAppInput): Promise<ResetAppOutput> {
    await this.credentialRepository.delete();
    await this.pinLock.reset();
    await this.identityRepository.clear();
    return {};
  }
}
