# Contract: IIdentityRepository

**Defined in**: D1 | **Consumed by**: D2, D3, D4

This contract describes the `IIdentityRepository` port interface that D1 establishes and that downstream domains use without modification.

---

## Interface

```typescript
// src/shared/domain/interfaces/repositories/identity_repository.ts
interface IIdentityRepository {
  save(identity: Identity): Promise<void>;
  load(): Promise<Identity | null>;
  exists(): Promise<boolean>;
  clear(): Promise<void>;
}
```

---

## Method Contracts

### `save(identity: Identity): Promise<void>`

Persists the identity to OS secure storage. Overwrites any existing entry. Atomic: either the full identity is written or no change occurs (expose-secure-store's internal atomicity).

**Throws**: `IdentityCreationFailedError` if secure storage write fails.

### `load(): Promise<Identity | null>`

Returns the stored identity, or `null` if no identity has been created. The returned `Identity` includes `seed`, `publicKey`, and `did`.

**Note for callers**: The `seed` field is sensitive. Every use case that calls `load()` MUST pass the seed only to `ISigner.sign()`. The seed MUST NOT appear in any ViewModel output or result type.

### `exists(): Promise<boolean>`

Convenience check that avoids loading the seed when only presence is needed (e.g., home screen state decision, D3 session check).

### `clear(): Promise<void>`

Removes all stored identity data. Idempotent — calling when no identity exists does not throw.

**Used by**: `CreateIdentityUseCase` at the start of onboarding to ensure no stale state (FR-010).

---

## Concrete Implementation

`IdentityRepositoryConcrete` (`src/shared/infra/repositories/identity_repository_concrete.ts`):
- Uses `SecureStoreClient` (thin wrapper over `expo-secure-store`) under key `yaid.identity.seed`
- Stores only the seed (32 bytes as base64url); derives `publicKey` and `did` on load via `ISigner.getPublicKey()`
- `exists()` checks for key presence without decoding the value
- `accessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` (non-syncable, device-restricted)

**Why store only seed**: publicKey is 32 bytes derivable in < 1 ms; DID is deterministic from publicKey. Storing all three would add no security value and waste space.

---

## Fake Implementation

`IdentityRepositoryMock` (`src/shared/infra/repositories/mock/identity_repository_mock.ts`):
- In-memory `Map<string, Identity>` keyed by a single `'identity'` key
- `clear()` empties the map
- Behaviour mirrors the concrete exactly (idempotent save, null-safe load, idempotent clear)

**Fake contract test** (`tests/shared/infra/repositories/mock/identity_repository_mock.test.ts`):
- save → load returns same entity
- load when empty → returns null
- exists when empty → false; exists after save → true
- clear after save → exists returns false; load returns null
- save twice → second write wins
