import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ICredentialRepository } from '../../../shared/domain/interfaces/repositories/credential_repository';
import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { IYaIDApi } from '../../../shared/domain/interfaces/providers/yaid_api';
import { CredentialNotFoundError } from '../../../shared/domain/errors/credential_errors';

export interface RevokeCredentialInput {
  pin: string;
}

export interface RevokeCredentialOutput {
  revokedAt: Date;
  ageOver18: boolean;
}

export class RevokeCredentialUseCase {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly pinLock: IPinLock,
    private readonly clock: IClock,
    private readonly yaIDApi: IYaIDApi,
  ) {}

  async execute(input: RevokeCredentialInput): Promise<RevokeCredentialOutput> {
    await this.pinLock.verify(input.pin);

    const identity = await this.identityRepository.load();
    if (identity === null) {
      throw new Error('RevokeCredentialUseCase: no identity found');
    }

    const credential = await this.credentialRepository.load();
    if (credential === null) {
      throw new CredentialNotFoundError();
    }

    await this.yaIDApi.revokeCredential({
      did: identity.did,
      seed: identity.seed,
      vcId: credential.vcId,
      clock: this.clock,
    });

    await this.credentialRepository.delete();

    return { revokedAt: new Date(this.clock.nowMs()), ageOver18: credential.ageOver18 };
  }
}
