import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { IRandomness } from '../../../shared/domain/interfaces/providers/randomness';
import { createIdentity, Identity } from '../../../shared/domain/entities/identity';
import { IdentityCreationFailedError } from '../../../shared/domain/errors/identity_errors';
import { Ed25519Client } from '../../../shared/clients/ed25519_client';

export type CreateIdentityInput = Record<string, never>;

function toHexLower(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class CreateIdentityUseCase {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly randomness: IRandomness,
  ) {}

  async execute(_input: CreateIdentityInput): Promise<Identity> {
    await this.identityRepository.clear();

    const seed = this.randomness.getBytes(32);
    const publicKey = Ed25519Client.getPublicKey(seed);
    const did = `did:yaid:user:${toHexLower(publicKey)}`;
    const identity: Identity = createIdentity({ seed, publicKey, did });

    try {
      await this.identityRepository.save(identity);
    } catch (cause) {
      throw new IdentityCreationFailedError(cause);
    }

    return identity;
  }
}
