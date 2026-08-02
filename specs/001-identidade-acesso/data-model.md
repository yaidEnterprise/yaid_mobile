# Data Model — D1: Identidade e Acesso

**Branch**: `001-identidade-acesso` | **Date**: 2026-08-02

---

## Entities

### `Identity`

The person's Ed25519 identity on this device. Created once; never transmitted.

```typescript
// src/shared/domain/entities/identity.ts
interface Identity {
  seed: Uint8Array;       // 32 bytes — Ed25519 private key material; used by ISigner.sign()
  publicKey: Uint8Array;  // 32 bytes — derived from seed; used to build the DID
  did: string;            // "did:yaid:user:<64 hex lowercase>" — autocertifying identifier
}
```

**Invariants**:
- `did` format: `/^did:yaid:user:[0-9a-f]{64}$/` — lowercase only (server validates with this regex)
- `did` derivation: `did:yaid:user:` + `toHexLower(publicKey)` — no `0x` prefix
- `seed.length === 32` and `publicKey.length === 32`
- `publicKey === ed25519.getPublicKey(seed)` — derived, never stored independently from seed
- One identity per installation; `IIdentityRepository.save()` overwrites any prior value

**ViewModel boundary rule (§6.2)**: The `seed` and `publicKey` fields MUST be stripped by `CreateIdentityViewModel` before the entry adapter sees the result. The entry adapter receives only `{ did: string }`.

---

## Enums

### `Stage`

```typescript
// src/shared/domain/enums/stage.ts
enum Stage {
  Test  = 'test',
  Dev   = 'dev',
  Homol = 'homol',
  Prod  = 'prod',
}
```

Read from `EXPO_PUBLIC_STAGE` by `shared/environments.ts`. `Stage.Test` always resolves every port to its fake.

---

## Domain Errors

```typescript
// src/shared/domain/errors/identity_errors.ts

class IdentityAlreadyExistsError extends Error {
  readonly kind = 'identity_already_exists';
}

class IdentityCreationFailedError extends Error {
  readonly kind = 'identity_creation_failed';
  constructor(readonly cause: unknown) { super(); }
}
```

```typescript
// src/shared/domain/errors/pin_errors.ts

class PinNotInitializedError extends Error {
  readonly kind = 'pin_not_initialized';
}

class PinWrongError extends Error {
  readonly kind = 'pin_wrong';
  constructor(readonly attemptsRemaining: number) { super(); }
  // attemptsRemaining: how many incorrect attempts the person has before the next lockout
}

class PinBackoffActiveError extends Error {
  readonly kind = 'pin_backoff_active';
  constructor(readonly lockedUntilMs: number) { super(); }
  // lockedUntilMs: epoch ms — the screen computes remainingMs = lockedUntilMs - Date.now()
}

class PinObviousError extends Error {
  readonly kind = 'pin_obvious';
  // thrown by DefinePinUseCase when the PIN matches a trivially guessable pattern
}

class PinMismatchError extends Error {
  readonly kind = 'pin_mismatch';
  // thrown by DefinePinUseCase when pin !== confirmation
}
```

---

## Port Interfaces

All interfaces live in `src/shared/domain/interfaces/`. This section is authoritative — downstream domains (D2, D3, D4) consume these interfaces without modification (except where explicitly extended in their own plans).

### `IIdentityRepository`

```typescript
// src/shared/domain/interfaces/repositories/identity_repository.ts
interface IIdentityRepository {
  save(identity: Identity): Promise<void>;
  load(): Promise<Identity | null>;  // null if no identity has been created
  exists(): Promise<boolean>;        // convenience check without loading seed
  clear(): Promise<void>;            // removes any stored identity; idempotent
}
```

**Consumed by**: D2 (`IssueCredentialUseCase` reads `seed` and `did`), D3 (`PresentProofUseCase`), D4 (`RevokeCredentialUseCase`).

### `ISigner`

```typescript
// src/shared/domain/interfaces/providers/signer.ts
interface ISigner {
  getPublicKey(seed: Uint8Array): Uint8Array;
  // synchronous — @noble/ed25519's getPublicKeySync is deterministic and < 1 ms

  sign(payload: Uint8Array, seed: Uint8Array): Promise<Uint8Array>;
  // returns 64-byte Ed25519 signature; callers encode to base64url for HTTP
}
```

**Consumed by**: D2 (signs body payload and DID-auth header), D3 (signs DID-auth header and VP proof), D4 (signs DID-auth header and body payload).

**Fake**: Uses a fixed 32-byte test seed; `sign()` is deterministic — enables fixed-vector tests.

### `IRandomness`

```typescript
// src/shared/domain/interfaces/providers/randomness.ts
interface IRandomness {
  getBytes(n: number): Uint8Array;
  // returns n cryptographically secure random bytes
}
```

**Used only in D1** (`CreateIdentityUseCase`) to generate the seed. Fake returns a fixed deterministic sequence.

### `IClock`

```typescript
// src/shared/domain/interfaces/providers/clock.ts
interface IClock {
  nowMs(): number;       // epoch milliseconds
  nowSeconds(): number;  // epoch seconds (integer) — used for DID-auth timestamp header
}
```

**Used in D1** (`PinLockConcrete` compares `lockedUntilMs` against `clock.nowMs()`). Used in D2, D3, D4 for DID-auth timestamp generation. Fake exposes `advance(ms: number)` for lockout expiry tests.

### `IPinLock`

```typescript
// src/shared/domain/interfaces/providers/pin_lock.ts

interface PinStatus {
  isLocked: boolean;
  lockedUntilMs: number | null;  // null when not locked
  attemptsRemaining: number;     // 0–5; 5 when clean state
  lockoutCount: number;          // total number of times the person has been locked out
}

interface IPinLock {
  initialize(pin: string): Promise<void>;
  // Stores the PIN and resets attempt state.
  // Called once during onboarding by DefinePinUseCase.
  // Idempotent: calling again replaces the previous PIN (future change-PIN feature).

  verify(pin: string): Promise<void>;
  // Succeeds silently. Throws:
  //   PinNotInitializedError   — no PIN stored yet (should not happen post-onboarding)
  //   PinWrongError            — incorrect PIN, no active lockout
  //   PinBackoffActiveError    — lockout period has not elapsed
  // On success: resets attemptCount to 0.
  // On wrong (no lockout): increments attemptCount.
  // On wrong (exhausting attempts): triggers lockout, resets attemptCount.

  getStatus(): Promise<PinStatus>;
  // Returns current state without consuming an attempt.
  // Used by the PIN screen to render remaining attempts or remaining lockout time.
}
```

**Consumed by**: D2 (`IssueCredentialUseCase`), D3 (`PresentProofUseCase`), D4 (`RevokeCredentialUseCase`) — each verifies the PIN before performing its sensitive operation.

**Backoff schedule** (in `PinLockConcrete`; the interface is agnostic):

| Lockout # | Duration |
|---|---|
| 0 (first) | 1 minute |
| 1 | 5 minutes |
| 2 | 15 minutes |
| 3+ | 1 hour |

---

## Use Case Input / Output DTOs

### `DefinePinUseCase`

```typescript
// in modules/access/app/define_pin_usecase.ts

interface DefinePinInput {
  pin: string;           // 6-digit string from the screen
  confirmation: string;  // repeat entry for confirmation
}

interface DefinePinOutput {
  // empty — success is signalled by the result type; no display data needed
}
```

### `CreateIdentityUseCase`

```typescript
// in modules/identity/app/create_identity_usecase.ts

// No input — the use case reads nothing from outside; it generates all values
type CreateIdentityInput = Record<string, never>;

interface CreateIdentityOutput {
  did: string;  // the only field; used by the home screen to confirm identity exists
  // seed and publicKey are NEVER in the output; ViewModel enforces this
}
```

---

## State Transitions

```
App installed (no identity, no PIN)
  │
  ├── define-pin.tsx: DefinePinUseCase.execute({ pin, confirmation })
  │     │
  │     ├── PinMismatchError    → inform person, allow retry (no attempt cost)
  │     ├── PinObviousError     → inform person, allow retry
  │     └── success             → PIN stored in Keychain; navigate to create-identity.tsx
  │
  └── create-identity.tsx: CreateIdentityUseCase.execute({})
        │
        ├── IdentityCreationFailedError → visible error screen (FR-009); first use restarts
        └── success                     → Identity stored in Keychain; navigate to index.tsx

index.tsx (home screen states)
  │
  ├── no identity  → welcome + "Começar" button → navigate to define-pin.tsx
  └── identity, no credential → "Verificar meu documento" button (→ D2)

PIN verification (invoked by D2, D3, D4)
  │
  ├── PinNotInitializedError  → should not occur post-onboarding; treat as fatal
  ├── PinWrongError           → display attempts remaining; allow retry
  ├── PinBackoffActiveError   → display remaining lockout time; input disabled
  └── success                 → proceed with the sensitive operation
```
