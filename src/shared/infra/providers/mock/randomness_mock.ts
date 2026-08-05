import { IRandomness } from '../../../domain/interfaces/providers/randomness';

export class RandomnessMock implements IRandomness {
  getBytes(n: number): Uint8Array {
    return new Uint8Array(n);
  }
}
