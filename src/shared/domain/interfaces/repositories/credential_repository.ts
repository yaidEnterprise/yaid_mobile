import { Credential } from '../../entities/credential';

export interface ICredentialRepository {
  save(credential: Credential): Promise<void>;
  load(): Promise<Credential | null>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
}
