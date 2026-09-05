import { gcm } from '@noble/ciphers/aes.js';

export const AesGcmClient = {
  encrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array {
    return gcm(key, nonce).encrypt(plaintext);
  },
  decrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    return gcm(key, nonce).decrypt(ciphertext);
  },
};
