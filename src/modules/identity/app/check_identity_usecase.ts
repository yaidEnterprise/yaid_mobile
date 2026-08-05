import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';

export type CheckIdentityInput = Record<string, never>;

export interface CheckIdentityOutput {
  exists: boolean;
}

export class CheckIdentityUseCase {
  constructor(private readonly identityRepository: IIdentityRepository) {}

  async execute(_input: CheckIdentityInput): Promise<CheckIdentityOutput> {
    const exists = await this.identityRepository.exists();
    return { exists };
  }
}
