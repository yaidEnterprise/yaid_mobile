# Data Model — Revogação de Credencial (D4)

**Branch**: `004-revogacao` | **Date**: 2026-08-02

---

## Entities

### `Credential` (existing — D2 defines it; D4 reads and deletes it)

D4 does not change the shape of `Credential`. The entity must include a `vcId` field for revocation — this is a design requirement that D2 (IssueCredential) must satisfy when it populates the entity at issuance time.

```typescript
// src/shared/domain/entities/credential.ts
interface Credential {
  vcId: string;        // VC identity: `id` field (pre-Epic 9) or `jti` JWT claim (post-Epic 9)
  raw: string;         // Full credential as received from the API (JWT string post-Epic 9)
  proofType: ProofType; // canonical enum — see ProofType below
  issuedAt: Date;
  holder: string;      // DID of the credential holder (did:yaid:user:<hex64>)
}
```

**Invariants**:
- `vcId` is non-empty and matches the server-side identity of the credential.
- `raw` is stored exactly as received — no reserialisation (per API contract: "the issuer's signature covers the exact received representation").
- `holder` matches the `Identity.did` of this device.
- After a successful revocation, no `Credential` instance exists in `CredentialRepository`. There is no "revoked" state locally; absence is the terminal state.

### `Identity` (existing — D1 defines it; D4 reads it for did + seed)

```typescript
// src/shared/domain/entities/identity.ts
interface Identity {
  seed: Uint8Array;       // 32 bytes — passed to IYaIDApi.revokeCredential() for signing
  publicKey: Uint8Array;  // 32 bytes — derived from seed at load time
  did: string;            // "did:yaid:user:<64 hex lowercase>"
}
```

D4 calls `IIdentityRepository.load()` and passes the full entity to `IYaIDApi.revokeCredential({ did, seed, vcId, clock })`. The concrete uses `seed` internally for all Ed25519 operations. Seed never reaches the ViewModel boundary.

---

## Enums

### `ProofType` (existing — D2 defines it)

```typescript
// src/shared/domain/enums/proof_type.ts
enum ProofType {
  Personhood = 'personhood',
  AgeOver18  = 'age_over_18',   // canonical snake_case; adapter converts to camelCase for issuance
}
```

D4 does not use `proofType` in any operation. It may be needed by the ViewModel if the result screen displays which type of credential was revoked.

---

## Domain Errors (new for D4)

These live in `src/shared/domain/errors/`. D4 introduces the following errors:

### `CredentialNotFoundError`

Thrown by `CredentialRepository.find()` when no credential exists. Used in the use case to handle the "no credential to revoke" path (US 5).

```typescript
class CredentialNotFoundError extends Error {
  readonly kind = 'credential_not_found';
}
```

### `PinWrongError`

Defined in D1 (contracts/pin_lock.md). Reproduced here for reference.

```typescript
class PinWrongError extends Error {
  readonly kind = 'pin_wrong';
  readonly attemptsRemaining: number; // attempts left before the next lockout (0-4)
}
```

### `PinBackoffActiveError`

Defined in D1. Reproduced here for reference.

```typescript
class PinBackoffActiveError extends Error {
  readonly kind = 'pin_backoff_active';
  readonly lockedUntilMs: number; // epoch ms when next attempt is accepted
}
```

### `RevocationApiError`

Thrown by `YaIDApi.revokeCredential()` when the API returns a non-success response. Wraps the raw error message from the API.

```typescript
class RevocationApiError extends Error {
  readonly kind = 'revocation_api_error';
  readonly isClockSkew: boolean;  // true when cause is 'Request expired'
  readonly isNetworkError: boolean;
}
```

*Note*: `CredentialNotFoundError`, `PinWrongError`, and `PinBackoffActiveError` may already exist (partially) after D1 and D2. D4 confirms and, if necessary, extends them.

---

## Port Interface Additions

### `CredentialRepository` — new method: `delete()`

```typescript
// src/shared/domain/interfaces/repositories/credential_repository.ts
interface CredentialRepository {
  find(): Promise<Credential>;           // throws CredentialNotFoundError if absent
  save(credential: Credential): Promise<void>;
  delete(): Promise<void>;               // NEW — removes the credential from storage
}
```

`delete()` is idempotent: calling it when no credential exists must NOT throw.

### `IYaIDApi` — new method: `revokeCredential()`

Same pattern as D2's `issueCredential`: the interface takes `seed` and `clock`; the concrete computes all signatures internally.

```typescript
// src/shared/domain/interfaces/providers/yaid_api.ts
interface IYaIDApi {
  // ... existing methods (issueCredential, getProofSession, getChallenge, verifyPresentation, cancelProofSession)

  revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }>; // throws RevocationApiError
}

interface RevokeCredentialParams {
  did: string;           // used in X-YaID-DID header and auth payload
  seed: Uint8Array;      // concrete uses for all Ed25519 signing (auth header + body sig)
  vcId: string;          // body: credential identity; also the body-signature payload
  clock: IClock;         // concrete uses clock.nowSeconds() for the auth timestamp
}
```

`revokeCredential()` throws `RevocationApiError` on any non-`{ revoked: true }` response. See [research.md §6](./research.md) for the full signing sequence inside the concrete.

---

## Use Case Input / Output DTOs

These are the types that cross the use case boundary. They live in the use case file itself (not in `shared/`).

### Input

```typescript
interface RevokeCredentialInput {
  pin: string;   // 6-digit string from the entry adapter
}
```

### Output (success)

```typescript
interface RevokeCredentialOutput {
  revokedAt: Date;     // timestamp of the confirmed revocation
  proofType: ProofType; // which type of credential was revoked (for display in ViewModel)
}
```

The `raw` credential and `vcId` are NOT in the output — they serve no purpose after revocation and must not leak to the ViewModel or screen.

---

## State Transitions

```
Credential present
  │
  ├── RevokeCredentialUseCase.execute({ pin })
  │     │
  │     ├── PinLock.verify(pin) fails
  │     │     → Credential unchanged; PinWrongError or PinBackoffActiveError propagates to controller
  │     │
  │     ├── YaIDApi.revokeCredential(...) fails
  │     │     → Credential unchanged; RevocationApiError propagates to controller
  │     │
  │     └── YaIDApi returns { revoked: true }
  │           → CredentialRepository.delete() called
  │           → RevokeCredentialOutput returned
  │
No credential (terminal state — permanent)
```

The credential has no intermediate "revoking" state. Either it exists or it doesn't.
