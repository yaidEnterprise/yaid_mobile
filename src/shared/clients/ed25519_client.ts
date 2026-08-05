import './_setup_ed25519';
import { getPublicKey, signAsync } from '@noble/ed25519';

export const Ed25519Client = {
  getPublicKey(seed: Uint8Array): Uint8Array {
    return getPublicKey(seed);
  },
  sign(payload: Uint8Array, seed: Uint8Array): Promise<Uint8Array> {
    return signAsync(payload, seed);
  },
};
