import { IIdentityRepository } from '../../domain/interfaces/repositories/identity_repository';
import { createIdentity, Identity } from '../../domain/entities/identity';
import { SecureStoreClient } from '../../clients/secure_store_client';
import { Ed25519Client } from '../../clients/ed25519_client';

const SEED_KEY = 'yaid.identity.seed';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Buffer and btoa/atob are not guaranteed to exist in the Hermes runtime, so
// base64 is encoded/decoded by hand rather than relying on either.
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]!;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];

    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 0x03) << 4) | ((b2 ?? 0) >> 4)];
    result += b2 === undefined ? '=' : BASE64_CHARS[((b2 & 0x0f) << 2) | ((b3 ?? 0) >> 6)];
    result += b3 === undefined ? '=' : BASE64_CHARS[b3 & 0x3f];
  }
  return result;
}

function base64ToBytes(base64: string): Uint8Array {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function toBase64Url(bytes: Uint8Array): string {
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(base64);
}

function toHexLower(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class IdentityRepositoryConcrete implements IIdentityRepository {
  async save(identity: Identity): Promise<void> {
    await SecureStoreClient.setItem(SEED_KEY, toBase64Url(identity.seed));
  }

  async load(): Promise<Identity | null> {
    const stored = await SecureStoreClient.getItem(SEED_KEY);
    if (stored === null) {
      return null;
    }
    const seed = fromBase64Url(stored);
    const publicKey = Ed25519Client.getPublicKey(seed);
    const did = `did:yaid:user:${toHexLower(publicKey)}`;
    return createIdentity({ seed, publicKey, did });
  }

  async exists(): Promise<boolean> {
    return (await SecureStoreClient.getItem(SEED_KEY)) !== null;
  }

  async clear(): Promise<void> {
    await SecureStoreClient.deleteItem(SEED_KEY);
  }
}
