export interface ISigner {
  getPublicKey(seed: Uint8Array): Uint8Array;
  sign(payload: Uint8Array, seed: Uint8Array): Promise<Uint8Array>;
}
