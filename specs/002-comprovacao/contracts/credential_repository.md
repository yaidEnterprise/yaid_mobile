# Contract: ICredentialRepository

**Defined in**: D2 | **Consumed by**: D3 (load for eligibility + VP assembly), D4 (load vcId, delete after revocation)

---

## Interface

```typescript
// src/shared/domain/interfaces/repositories/credential_repository.ts
interface ICredentialRepository {
  save(credential: Credential): Promise<void>;
  load(): Promise<Credential | null>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
}
```

---

## Method Contracts

### `save(credential)`

Persists the credential to an encrypted file in the app sandbox. Overwrites any existing credential (only possible post-revocation, since D2 blocks when a credential exists). The `raw` field is stored verbatim — no reserialisation.

### `load(): Promise<Credential | null>`

Returns the full `Credential` entity, or `null` if no credential exists. The `raw` field is returned exactly as stored (needed by D3 to assemble the VP's `verifiableCredential` array and by D4 to extract `vcId`).

### `exists(): Promise<boolean>`

Checks credential presence without loading or decrypting the full file. Used by: home screen state check, D3 session guard, D2 guard (FR-005), D4 guard (FR-011).

### `delete(): Promise<void>`

Removes the credential file and deletes the encryption key from Keychain. **Idempotent** — calling when no credential exists does not throw. Used by D4 (`RevokeCredentialUseCase`) only after `{ revoked: true }` confirmation from the API.

---

## Concrete Implementation

`CredentialRepositoryConcrete` (`src/shared/infra/repositories/credential_repository_concrete.ts`):
- Credential stored as AES-256-GCM encrypted JSON at `FileSystem.documentDirectory + 'yaid_credential.enc'`
- Encryption key (32 random bytes) stored in Keychain under `yaid.credential.key`
- `save()` generates a new random nonce per write; stores `{ nonce, ciphertext }` as JSON
- `delete()` calls `FileSystem.deleteAsync(path, { idempotent: true })` then removes the Keychain key

---

## Fake Implementation

`CredentialRepositoryMock` (`src/shared/infra/repositories/mock/credential_repository_mock.ts`):
- In-memory single-slot store (`credential: Credential | null`)
- All methods are synchronous internally; returns Promises for interface compatibility
- `delete()` sets the slot to `null`

**Fake contract test** (`tests/shared/infra/repositories/mock/credential_repository_mock.test.ts`):
- save → load returns same entity (including `raw` verbatim)
- load when empty → null
- exists when empty → false; exists after save → true
- delete after save → exists false; load null
- delete when empty → does not throw
