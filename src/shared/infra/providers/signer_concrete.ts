import './_setup_ed25519';
import { getPublicKey, signAsync } from '@noble/ed25519';
import { ISigner } from '../../domain/interfaces/providers/signer';

export class SignerConcrete implements ISigner {
  getPublicKey(seed: Uint8Array): Uint8Array {
    return getPublicKey(seed);
  }

  async sign(payload: Uint8Array, seed: Uint8Array): Promise<Uint8Array> {
    return signAsync(payload, seed);
  }
}
