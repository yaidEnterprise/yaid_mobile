# Research — Revogação de Credencial (D4)

**Branch**: `004-revogacao` | **Date**: 2026-08-02

This document resolves every design question that was open before implementation can begin. Each section leads with the decision, then the rationale and alternatives evaluated.

---

## 1. `vcId` para revogação no formato pós-Epic 9

**Decision**: The `Credential` entity stores a `vcId: string` field populated at issuance time. `RevokeCredentialUseCase` reads `credential.vcId` directly — it does not parse the raw credential.

**Why**: The architecture mandates building against the post-Epic 9 JWT format (T9). Under that format, the VC is a compact JWT string and its identity is the `jti` claim in the JWT payload (not the top-level `id` field of the pre-Epic 9 JSON object). Parsing the JWT inside the use case would couple it to the credential wire format — a transport concern that belongs in the infra layer. Storing `vcId` as an explicit entity field decouples D4 from both the current and future wire formats.

**How it works across both eras**:

| Era | API response | vcId source |
|---|---|---|
| Pre-Epic 9 (JSON VC) | `{ "id": "uuid", ... }` | `response.id` |
| Post-Epic 9 (JWT VC) | `"<header>.<payload>.<sig>"` | `jti` claim from decoded JWT payload |

In both cases, `IssueCredentialUseCase` (D2) extracts the value and stores it in `credential.vcId`. D4 is oblivious to the format.

**Alternatives considered**:
- Parse `jti` from the raw JWT at revocation time (inside use case): rejected — couples use case to JWT format, violates Iron Rule (T5).
- Store the entire decoded JWT object as the entity: rejected — the `Credential` entity must be format-agnostic; the `raw` field carries the wire representation.

**Open API question**: Architecture open question #2 notes that the API's `/revoke` route currently looks up credentials by the `id` field of the JSON VC. When the VC becomes a JWT, the server must accept the `jti` claim as the lookup key. This is an API-side concern; from the app's perspective, we always send `vcId` in the request body. The app is unblocked.

---

## 2. Backoff progressivo para PIN incorreto

**Decision**: `PinLock.verify(pin: string): Promise<void>` throws typed domain errors that include backoff state. The concrete implementation persists the attempt counter and last-failure timestamp in OS Secure Storage. The fake implements identical semantics in memory.

**Error types emitted by `IPinLock.verify()`** — defined in D1 (contracts/pin_lock.md); reproduced here for clarity:

| Error | Thrown when | Payload |
|---|---|---|
| `PinWrongError` | PIN is incorrect; no active lockout | `{ attemptsRemaining: number }` — attempts left before the next lockout |
| `PinBackoffActiveError` | Called while a lockout period is active | `{ lockedUntilMs: number }` — epoch ms when next attempt is accepted |

**Lockout schedule** (D1 spec FR-020, FR-021 — canonical source; this table is a read-only reference):

| Wrong attempt count | Lockout duration |
|---|---|
| 1–4 | None (no lockout) |
| 5 (1st lockout) | 1 min |
| 5 again (2nd lockout) | 5 min |
| 5 again (3rd lockout) | 15 min |
| 5 again (4th lockout) | 1 h |
| 5 again (5th+ lockout) | 1 h (repeated) |

The lockout counter (`lockoutCount`) persists across app restarts in Secure Storage under `yaid.pin.state`. The only way to reset attempt count is a correct PIN. D4 does not define or change this schedule — it reuses `IPinLock` as defined in D1.

**Alternatives considered**:
- Wipe identity after N failed attempts: explicitly rejected by the constitution ("PIN failure MUST NEVER delete the identity") and by spec (FR-009, SC-005).

---

## 3. Caso de borda — credencial já revogada no servidor

**Decision**: If YaID returns `{ revoked: true }`, always treat as success and delete locally. If YaID returns any error (401, 502, or unrecognised), do not delete locally and return an error result. There is no special "already revoked" handling — the spec's edge case implies idempotent success.

**Why**: The API contract for `POST /api/credentials/revoke` documents only three responses: `200 { revoked: true }`, `401 { error: "..." }`, and `502 { error: "..." }`. There is no documented "already revoked" status. If YaID returns `200 { revoked: true }` for a credential it already considers revoked (idempotent behaviour), the use case naturally treats it as success. If it returns an error, the credential stays locally and the person retries.

**Concrete behaviour in the use case**:
1. Receive `{ revoked: true }` → delete from `CredentialRepository` → return `RevokeCredentialSuccess`
2. Receive any error → do NOT delete → return `RevokeCredentialFailure` with a named cause

The spec edge case ("treat already-revoked as success") is satisfied because `200 { revoked: true }` from YaID is success by definition.

---

## 4. Máquina de estados da tela `revoke.tsx`

**Decision**: A single route `src/app/credential/revoke.tsx` manages the multi-step flow via an internal React state enum. Navigation between steps is rendered via conditional composition inside the route, not via route-level transitions.

**State enum**:

```typescript
type RevokeScreenState =
  | { step: 'pin' }
  | { step: 'confirming' }                          // pin accepted; waiting for user to confirm
  | { step: 'loading' }                             // API call in progress
  | { step: 'success' }                             // credential deleted
  | { step: 'error'; cause: string; retryable: boolean }
```

**Flow diagram**:

```
[index.tsx] ──navigate──> [revoke.tsx : step=pin]
                               │ correct PIN
                               ↓
                         [step=confirming]
                          │             │
                      Confirmar       Voltar
                          │             │
                          ↓        [step=pin] or back
                     [step=loading]
                      │         │
              {revoked:true}  error
                      │         │
                [step=success] [step=error]
                      │             │
                   navigate      retry → [step=confirming]
                 to index.tsx    or dismiss
```

**Why**: The architecture mandates no state between screens (T7). There is no cross-screen store. The multi-step flow is logically one action (revoke), so one route handles all its sub-states. This matches the pattern described in ARCHITECTURE.md §15.1 ("one use case per person's intention, not per API call").

**Alternatives considered**:
- Separate routes for each step (e.g., `revoke/pin.tsx`, `revoke/confirm.tsx`): rejected — would require passing state through navigation params or a shared store, violating T7. The use case is one intent; one route.
- Navigator stack within the route: unnecessary complexity for a linear 2-step flow.

---

## 5. Rótulo do botão de abandono na tela de confirmação — conflito FR-003 × constituição

**Decision**: The abort button on the confirmation screen is labelled **"Voltar"**, not "Cancelar".

**Why this is a conflict**: FR-003 (spec) says: "The confirmation screen MUST present the options 'Confirmar' and 'Cancelar' with equivalent visual weight." The constitution (Principle VI) says: "The word 'cancelar' MUST NOT appear in any user-facing string." The constitution explicitly supersedes all other practices within the project.

**Resolution**: The intent of FR-003 is that both options (proceed / abort) have equivalent visual weight — neither is ghost, hidden, or secondary. This intent is preserved by using "Confirmar" + "Voltar" with identical tap area and primary/secondary weight (not ghost). The exact label "Cancelar" is changed to comply with the constitution.

**Label decision**:
- Confirm button: **"Confirmar revogação"** (primary weight)
- Abort button: **"Voltar"** (secondary weight, but NOT ghost — same tap area)

"Voltar" is a navigation verb, not a domain operation verb, so it does not conflict with the canonical vocabulary map.

---

## 6. Payload da assinatura de corpo (`bodySignature`)

**Decision**: `YaIDApiConcrete.revokeCredential` computes both signatures internally — the same pattern as D2's `issueCredential`. `IYaIDApi.revokeCredential()` accepts `{ did, seed, vcId, clock }`. The concrete is responsible for all protocol details.

**Source**: MOBILE-API-CONTRACT.md §3: `POST /api/credentials/revoke` body signature payload = `${vcId}` (vcId string alone, no separator, no prefix). DID-auth follows the standard pattern in §2.2.

**Signing sequence in `YaIDApiConcrete.revokeCredential`** (same pattern as D2):

```
1. timestamp     = clock.nowSeconds().toString()
2. authPayload   = `${timestamp}:POST:/api/credentials/revoke`
3. authSig       = ed25519.sign(new TextEncoder().encode(authPayload), seed) → base64url
4. bodyPayload   = vcId                      ← vcId string only, no separators
5. bodySig       = ed25519.sign(new TextEncoder().encode(bodyPayload), seed) → base64url
6. POST /api/credentials/revoke
      Headers: X-YaID-DID: {did}
               X-YaID-Timestamp: {timestamp}
               X-YaID-Signature: {authSig}
      Body: { vcId, bodySignature: bodySig }
```

The timestamp string signed in step 2 is the exact string sent in `X-YaID-Timestamp` — no reinterpretation (API contract §2.2).

**`RevokeCredentialUseCase` sequence** (use case does NOT call `ISigner` directly — same as D2):

```
1. IPinLock.verify(pin)                  ← FIRST; throws PinWrongError | PinBackoffActiveError
2. IIdentityRepository.load()           ← get { seed, publicKey, did }
3. ICredentialRepository.load()         ← get { vcId, raw, ... }
4. IYaIDApi.revokeCredential({ did, seed, vcId, clock })  ← concrete handles all signing
5. ICredentialRepository.delete()       ← only on { revoked: true } confirmation
6. return { revokedAt, proofType }
```

**Fixed-vector test requirement**: `YaIDApiMock.revokeCredential()` does not validate signatures. But a fixed-vector test in `revoke_credential_usecase.test.ts` must assert the correct `vcId` and `seed` are passed through — and a separate concrete-integration test (or manually computed vector) covers the signing. These are the silent-failure points: a locally valid signature that the server rejects returns `401` with no diagnostic.

---

## 7. `IdentityRepository` no caso de uso de revogação

**Decision**: `RevokeCredentialUseCase` calls `IIdentityRepository.load()` to obtain `{ seed, publicKey, did }` — the full `Identity` entity as defined in D1 (data-model.md). The use case passes `seed` (along with `did` and `vcId`) to `IYaIDApi.revokeCredential()`. The concrete handles all Ed25519 operations with the received seed.

**Why**: The use case is a composition of ports; the identity is a runtime value that lives in secure storage and is accessed through the port. The full entity (including seed) is needed because `IYaIDApi.revokeCredential()` takes `seed: Uint8Array` — this is the same pattern as D2's `issueCredential`, where the use case passes seed to the API port so the concrete can compute both signatures. Seed never reaches the ViewModel or entry adapter (Gate V).

**Entity shape** (D1 authoritative, `specs/001-identidade-acesso/data-model.md`):

```typescript
interface Identity {
  seed: Uint8Array;       // 32 bytes — used by ISigner.sign() and passed to IYaIDApi methods
  publicKey: Uint8Array;  // 32 bytes — derived from seed at load time
  did: string;            // "did:yaid:user:<64 hex lowercase>"
}
```

---

## 8. Tratamento de erro de relógio

**Decision**: If `YaIDApi.revokeCredential()` throws a `RequestExpiredError` (mapped from `"Request expired"` in the API response), the controller produces a `RevokeCredentialFailure` with cause `'clock_skew'`. The entry adapter renders a specific message directing the person to fix their device clock — not a generic "something went wrong" screen.

**Source**: ARCHITECTURE.md §11.1: "The app translates this specific error to guidance about the clock." The same logic applied in D3 (authorisation) applies here.
