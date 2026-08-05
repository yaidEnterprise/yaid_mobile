import { IIdentityRepository } from '../../../domain/interfaces/repositories/identity_repository';
import { Identity } from '../../../domain/entities/identity';

const STORAGE_KEY = 'identity';

export class IdentityRepositoryMock implements IIdentityRepository {
  private readonly store = new Map<string, Identity>();

  async save(identity: Identity): Promise<void> {
    this.store.set(STORAGE_KEY, identity);
  }

  async load(): Promise<Identity | null> {
    return this.store.get(STORAGE_KEY) ?? null;
  }

  async exists(): Promise<boolean> {
    return this.store.has(STORAGE_KEY);
  }

  async clear(): Promise<void> {
    this.store.delete(STORAGE_KEY);
  }
}
