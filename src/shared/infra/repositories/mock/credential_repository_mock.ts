import { ICredentialRepository } from '../../../domain/interfaces/repositories/credential_repository';
import { Credential } from '../../../domain/entities/credential';

export class CredentialRepositoryMock implements ICredentialRepository {
  private slot: Credential | null = null;

  async save(credential: Credential): Promise<void> {
    this.slot = credential;
  }

  async load(): Promise<Credential | null> {
    return this.slot;
  }

  async exists(): Promise<boolean> {
    return this.slot !== null;
  }

  async delete(): Promise<void> {
    this.slot = null;
  }
}
