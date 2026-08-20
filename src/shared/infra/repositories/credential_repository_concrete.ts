import { getRandomBytes } from 'expo-crypto';
import { ICredentialRepository } from '../../domain/interfaces/repositories/credential_repository';
import { Credential, createCredential } from '../../domain/entities/credential';
import { FileSystemClient } from '../../clients/file_system_client';
import { SecureStoreClient } from '../../clients/secure_store_client';
import { AesGcmClient } from '../../clients/aes_gcm_client';

const ENCRYPTION_KEY_ID = 'yaid.credential.key';
const FILE_NAME = 'yaid_credential.enc';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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

interface EncryptedFile {
  nonce: string;
  ciphertext: string;
}

async function getOrCreateKey(): Promise<Uint8Array> {
  const stored = await SecureStoreClient.getItem(ENCRYPTION_KEY_ID);
  if (stored !== null) {
    return base64ToBytes(stored);
  }
  const rawKey = getRandomBytes(32);
  await SecureStoreClient.setItem(ENCRYPTION_KEY_ID, bytesToBase64(rawKey));
  return rawKey;
}

export class CredentialRepositoryConcrete implements ICredentialRepository {
  private filePath(): string {
    return `${FileSystemClient.documentDirectory()}${FILE_NAME}`;
  }

  async save(credential: Credential): Promise<void> {
    const key = await getOrCreateKey();
    const nonce = getRandomBytes(12);
    const plaintext = new TextEncoder().encode(
      JSON.stringify({
        vcId: credential.vcId,
        raw: credential.raw,
        issuedAt: credential.issuedAt.toISOString(),
        holder: credential.holder,
        ageOver18: credential.ageOver18,
      }),
    );
    const ciphertext = AesGcmClient.encrypt(key, nonce, plaintext);
    const encrypted: EncryptedFile = {
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
    };
    await FileSystemClient.writeAsString(this.filePath(), JSON.stringify(encrypted));
  }

  async load(): Promise<Credential | null> {
    if (!(await this.exists())) {
      return null;
    }
    const key = await getOrCreateKey();
    const stored = await FileSystemClient.readAsString(this.filePath());
    const encrypted = JSON.parse(stored) as EncryptedFile;
    const nonce = base64ToBytes(encrypted.nonce);
    const ciphertext = base64ToBytes(encrypted.ciphertext);
    const plaintext = AesGcmClient.decrypt(key, nonce, ciphertext);
    const json = JSON.parse(new TextDecoder().decode(plaintext));
    return createCredential({
      vcId: json.vcId,
      raw: json.raw,
      issuedAt: new Date(json.issuedAt),
      holder: json.holder,
      ageOver18: json.ageOver18,
    });
  }

  async exists(): Promise<boolean> {
    return FileSystemClient.exists(this.filePath());
  }

  async delete(): Promise<void> {
    await FileSystemClient.delete(this.filePath());
    await SecureStoreClient.deleteItem(ENCRYPTION_KEY_ID);
  }
}
