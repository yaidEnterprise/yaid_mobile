import { getRandomBytes } from 'expo-crypto';
import { IRandomness } from '../../domain/interfaces/providers/randomness';

export class RandomnessConcrete implements IRandomness {
  getBytes(n: number): Uint8Array {
    return getRandomBytes(n);
  }
}
