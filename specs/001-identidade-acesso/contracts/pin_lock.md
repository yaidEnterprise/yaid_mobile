# Contract: IPinLock

**Defined in**: D1 | **Consumed by**: D2 (IssueCredentialUseCase), D3 (PresentProofUseCase), D4 (RevokeCredentialUseCase)

This contract describes the `IPinLock` port that D1 establishes as the sole authentication barrier for all sensitive operations in YaID Wallet.

---

## Interface

```typescript
// src/shared/domain/interfaces/providers/pin_lock.ts

interface PinStatus {
  isLocked: boolean;
  lockedUntilMs: number | null;
  attemptsRemaining: number;   // 0–5
  lockoutCount: number;        // total lockout events; determines next lockout duration
}

interface IPinLock {
  initialize(pin: string): Promise<void>;
  verify(pin: string): Promise<void>;
  getStatus(): Promise<PinStatus>;
}
```

---

## Method Contracts

### `initialize(pin: string): Promise<void>`

Stores the PIN and resets attempt state (`attemptCount = 0`, `lockoutCount = 0`, `lockedUntilMs = null`). Called once by `DefinePinUseCase` during onboarding.

**Precondition**: `pin` is a 6-digit numeric string (validation happens in `DefinePinUseCase` before calling this method).

**Postcondition**: `verify(pin)` will succeed; `getStatus()` returns clean state.

### `verify(pin: string): Promise<void>`

Authenticates the person. Resolves silently on success. Throws on any failure.

| Outcome | Condition | Thrown error |
|---|---|---|
| Success | PIN matches and no active lockout | (resolves) |
| Wrong PIN | PIN does not match; attempts < 5 | `PinWrongError({ attemptsRemaining })` |
| Lockout triggered | PIN does not match; this was the 5th incorrect attempt | `PinBackoffActiveError({ lockedUntilMs })` |
| Locked | Called during active lockout | `PinBackoffActiveError({ lockedUntilMs })` |
| Not initialized | No PIN has been stored | `PinNotInitializedError` |

**On success**: `attemptCount` resets to 0. `lockoutCount` is NOT decremented.

**On wrong (no lockout)**: `attemptCount` increments. `attemptsRemaining` decreases.

**On lockout trigger** (5th wrong attempt): `lockedUntilMs` is set to `clock.nowMs() + duration`, `lockoutCount` increments, `attemptCount` resets to 0. Subsequent calls throw `PinBackoffActiveError` until `clock.nowMs() >= lockedUntilMs`.

**On lockout expiry**: The first call after `lockedUntilMs` has passed: if the PIN is correct, resolves. If wrong, this counts as attempt 1 of the new sequence.

### `getStatus(): Promise<PinStatus>`

Returns the current attempt and lockout state. Does NOT consume an attempt. Used by the PIN screen to render "X tentativas restantes" or "bloqueado por Y minutos."

---

## Lockout Duration Schedule

Defined in `PinLockConcrete`; the interface is schedule-agnostic.

| `lockoutCount` (0-indexed) | Duration |
|---|---|
| 0 | 60 000 ms (1 minute) |
| 1 | 300 000 ms (5 minutes) |
| 2 | 900 000 ms (15 minutes) |
| ≥ 3 | 3 600 000 ms (1 hour) |

`lockoutCount` only grows; a correct PIN does not reset it.

---

## Invariants (regression tests required)

1. **PIN failure never deletes the identity** (FR-025, SC-006): `IIdentityRepository.exists()` returns `true` before and after any number of wrong PIN attempts.
2. **Lockout survives app restart** (FR-023): Serialized `{ lockoutCount, lockedUntilMs }` is persisted in secure storage. After a simulated restart (clearing the fake's in-memory state and reloading from persisted state), `getStatus()` returns the same locked state.
3. **Lockout duration escalates** (FR-021): Each lockout triggers a duration ≥ the previous lockout duration.
4. **`getStatus()` never consumes an attempt**: calling `getStatus()` 100 times never decrements `attemptsRemaining`.
5. **Success resets attempt count**: after a `verify()` success following 3 wrong attempts, `attemptsRemaining` returns to 5.

---

## Concrete Implementation

`PinLockConcrete` (`src/shared/infra/providers/pin_lock_concrete.ts`):
- Uses `SecureStoreClient` with keys `yaid.pin.value` and `yaid.pin.state`
- `IClock` injected at construction by the presenter
- Persists `{ attemptCount, lockoutCount, lockedUntilMs }` as JSON string

---

## Fake Implementation

`PinLockMock` (`src/shared/infra/providers/mock/pin_lock_mock.ts`):
- In-memory state; clock injected at construction (typically `ClockMock`)
- `ClockMock` exposes `advance(ms: number)` to simulate lockout expiry in tests
- Fake honours the full contract: same lockout schedule, same error types, same persistence semantics (modelled via the injected clock)

**Fake contract test** (`tests/shared/infra/providers/mock/pin_lock_mock.test.ts`):
- initialize → verify(correct) → success
- verify(wrong) × 5 → fifth throws `PinBackoffActiveError`
- verify during lockout → `PinBackoffActiveError`
- advance clock past lockout → verify(correct) → success
- verify(correct) after 3 wrong → attemptsRemaining resets to 5
- lockout escalation: second lockout duration > first
