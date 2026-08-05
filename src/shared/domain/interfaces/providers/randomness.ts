export interface IRandomness {
  getBytes(n: number): Uint8Array;
}
