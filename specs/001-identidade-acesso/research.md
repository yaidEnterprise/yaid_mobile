# Research — D1: Identidade e Acesso

**Branch**: `001-identidade-acesso` | **Date**: 2026-08-02

Resolves all open questions required before implementation begins.

---

## 1. Biblioteca Ed25519 para React Native / Expo

**Decision**: `@noble/ed25519` v2.x

**Rationale**:
- Pure JavaScript — zero native modules, no linking step, works in Expo Go and development builds equally
- Synchronous `getPublicKey(seed)` available (`ed.getPublicKeySync`), enabling instantaneous identity creation (SC-003)
- Async `sign(message, privateKey)` for signing operations
- Well-audited, MIT-licensed, maintained by Paul Miller (noble/curves family)
- React Native's JS engine (Hermes) supports the required TypeScript/bigint features in SDK 52+

**Alternatives considered**:
- `tweetnacl`: works in RN but uses `nacl.sign.keyPair.fromSeed()` pattern with a different API shape; older codebase, less maintained
- `libsodium-wrappers`: requires `Buffer` polyfills in React Native and a more complex setup; overkill for Ed25519 only
- `@stablelib/ed25519`: smaller but less community traction

**`ISigner` implementation note**: The concrete wraps `@noble/ed25519`. The fake uses a hardcoded 32-byte seed so tests produce deterministic signatures.

---

## 2. Armazenamento da seed e do estado de tentativas

**Decision**: `expo-secure-store` with three keys: `yaid.identity.seed`, `yaid.pin.value`, `yaid.pin.state`

**Key layout**:

| Key | Value | Encoding |
|---|---|---|
| `yaid.identity.seed` | 32-byte seed | base64url (43 chars, well under 2 KB) |
| `yaid.pin.value` | 6-digit PIN | UTF-8 string (6 chars) |
| `yaid.pin.state` | JSON: `{ attemptCount, lockoutCount, lockedUntilMs }` | JSON string (~60 chars) |

**Android 2 KB limit**: All three values are far below the limit. No chunking required.

**Options for expo-secure-store** used:
- `accessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` — enforces non-syncable, device-restricted (matches T3 requirement).

---

## 3. Armazenamento do PIN — hash vs. texto plano no Keychain

**Decision**: PIN stored as UTF-8 plaintext in Keychain (not hashed with PBKDF2 or bcrypt).

**Rationale**: The iOS Keychain and Android Keystore provide hardware-backed encryption at rest. Storing the PIN directly in the Keychain means:
- It is encrypted by the device's secure enclave key, not accessible without the device being unlocked
- No additional crypto library needed for PIN management
- On a non-rooted/jailbroken device, extracting the Keychain requires the device itself

ARCHITECTURE.md §4.4 already concedes that "a root or jailbreak device defeats the entire model." A bcrypt hash would add negligible marginal security once Keychain access is already compromised.

**Alternative considered**: PBKDF2 with a random salt stored alongside the hash. Rejected: adds a crypto-library dependency and complexity with no real security gain given the existing Keychain protection.

---

## 4. Política de tentativas e bloqueio — valores numéricos

**Decision**: 5 attempts before first lockout; lockout durations: 1 min → 5 min → 15 min → 1 h → 1 h (for all subsequent).

**Source**: D1 spec FR-020 (5 attempts) and FR-021 (escalation schedule). These values are documented in the spec assumptions section: "toleram erro humano genuíno e tornam a busca exaustiva de seis dígitos inviável."

**`PinLockConcrete` implementation**:
1. On wrong PIN: increment `attemptCount` in secure store.
2. If `attemptCount` reaches 5: compute `lockedUntilMs = now + lockoutDurationMs(lockoutCount)`, increment `lockoutCount`, reset `attemptCount` to 0.
3. On correct PIN: reset `attemptCount` to 0 (lockout count is NOT reset — it escalates permanently).
4. On any call while `lockedUntilMs > now`: throw `PinBackoffActiveError`.

**Duration table**:

| Lockout # (0-indexed) | Duration |
|---|---|
| 0 | 60 000 ms (1 min) |
| 1 | 300 000 ms (5 min) |
| 2 | 900 000 ms (15 min) |
| 3+ | 3 600 000 ms (1 h) |

The `IClock` port is injected into `PinLockConcrete` at construction (by the presenter). The fake uses a manually-advanceable clock for deterministic lockout tests.

---

## 5. Estrutura de telas do onboarding e percepção de instantaneidade

**Decision**: Two-screen sequence: `define-pin.tsx` → `create-identity.tsx` → `index.tsx`.

**Flow**:
1. `define-pin.tsx`: user enters 6-digit PIN, confirms by re-entering. On match, calls `DefinePinController.execute({ pin, confirmation })`. On success, navigates to `create-identity.tsx`.
2. `create-identity.tsx`: calls `CreateIdentityController.execute({})` immediately on mount (no user action required). `@noble/ed25519`'s `getPublicKeySync` is synchronous and completes in < 1 ms. The screen instantly navigates to `index.tsx` on success. The person effectively never "sees" `create-identity.tsx` — it's a routing waypoint.

**Why two separate screens**: The architecture defines `identity/` and `access/` as separate modules. Each module has its own presenter (composition root). A single screen calling two presenters would constitute cross-module coupling. Using two screens keeps each screen in its module's domain.

**SC-003 compliance**: No loading indicator is shown. The navigation from `create-identity.tsx` to `index.tsx` fires synchronously (no async wait needed; noble/ed25519's key derivation is sync). The person perceives the transition from PIN confirmation to the home screen as instant.

---

## 6. Validação de senhas óbvias (FR-014)

**Decision**: Reject PINs where all 6 digits are equal OR the digits form a strictly ascending or descending consecutive sequence.

**Rejection rules** (implemented in `DefinePinUseCase`):
- All same: `111111`, `000000`, `999999` → rejected
- Ascending: `123456`, `234567` → rejected
- Descending: `987654`, `876543` → rejected

**Not rejected**: `112233`, `121212`, `102030` — non-obvious patterns are accepted. The goal is to block the most trivially guessable PINs without being prescriptive about what constitutes a "strong" PIN.

**Error message**: "Essa combinação é fácil de adivinhar. Escolha dígitos menos previsíveis." (FR-014 — explains the reason, allows a new choice.)

---

## 7. Rollback se o onboarding for interrompido (FR-010)

**Decision**: `IIdentityRepository.clear()` is called at the start of `CreateIdentityUseCase` to ensure no stale partial state before saving.

**Why**: If the person enters the PIN (step 1), the app crashes or is killed, and they reopen, `define-pin.tsx` shows again (no identity yet). When they complete the PIN again, `CreateIdentityUseCase` runs fresh. If a partial seed entry existed from the previous crash (unlikely since the save is atomic in expo-secure-store), `clear()` removes it before the new identity is written.

**Result**: A partial or stale `yaid.identity.seed` entry can never cause the home screen to show "identity exists" incorrectly. The home screen's "identity check" calls `IIdentityRepository.exists()`, which is authoritative.
