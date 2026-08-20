import { ICredentialRepository } from '../../../shared/domain/interfaces/repositories/credential_repository';

export type CheckCredentialInput = Record<string, never>;

export type CheckCredentialOutput =
  | { exists: false }
  | { exists: true; ageOver18: boolean; issuedAt: Date };

export class CheckCredentialUseCase {
  constructor(private readonly credentialRepository: ICredentialRepository) {}

  async execute(_input: CheckCredentialInput): Promise<CheckCredentialOutput> {
    const credential = await this.credentialRepository.load();
    if (credential === null) {
      return { exists: false };
    }
    return { exists: true, ageOver18: credential.ageOver18, issuedAt: credential.issuedAt };
  }
}
