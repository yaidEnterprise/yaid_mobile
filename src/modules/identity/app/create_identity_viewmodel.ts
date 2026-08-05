import { Identity } from '../../../shared/domain/entities/identity';

export interface CreateIdentityDisplay {
  did: string;
}

export class CreateIdentityViewModel {
  toDisplay(identity: Identity): CreateIdentityDisplay {
    return { did: identity.did };
  }
}
