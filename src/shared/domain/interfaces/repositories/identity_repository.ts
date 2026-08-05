import { Identity } from '../../entities/identity';

export interface IIdentityRepository {
  save(identity: Identity): Promise<void>;
  load(): Promise<Identity | null>;
  exists(): Promise<boolean>;
  clear(): Promise<void>;
}
