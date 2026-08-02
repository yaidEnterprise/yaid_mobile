# Contract: IYaIDApi — D3 Methods

**Defined in**: D3 | **Prior method**: D2 defines `issueCredential` | **Extended by**: D4 (adds `revokeCredential`)

This document covers the 4 methods added to `IYaIDApi` in D3: `getProofSession`, `getChallenge`, `verifyPresentation`, `cancelProofSession`.

---

## Method 1: `getProofSession`

### Route

`GET /api/proof-sessions/{sessionToken}` — **public route, no DID-auth** (MOBILE-API-CONTRACT.md §4.2).

### Interface

```typescript
interface GetProofSessionParams {
  sessionToken: string;
}

// IYaIDApi
getProofSession(params: GetProofSessionParams): Promise<ProofSession>;
```

### `YaIDApiConcrete.getProofSession` — Internal Sequence

```
1. GET /api/proof-sessions/{params.sessionToken}
      No authentication headers
2. 200 → proofSessionDtoToEntity(body) → ProofSession
3. 404 → throw SessionNotFoundError
4. other errors → throw SessionNotFoundError (fail-safe for unexpected codes)
```

**No DID-auth on this route**. No seed, no clock, no timestamp header required.

### Response Shape

```jsonc
{
  "token": "abc123",
  "status": "waiting_user",
  "proofType": "age_over_18",
  "companyName": "Empresa Parceira",
  "expiresAt": "2026-08-02T15:30:00Z"
}
```

### Fake Behaviour

`YaIDApiMock.getProofSession()`:
- Default: returns a scripted `ProofSession` with `status: WaitingUser`, `proofType: Personhood`
- Can be configured to return any `ProofSessionStatus` (for testing terminal-state handling)
- Can be configured to throw `SessionNotFoundError`
- Call count and last params recorded for assertion

---

## Method 2: `getChallenge`

### Route

`GET /api/proof-sessions/{sessionToken}/challenge` — **DID-authenticated** (MOBILE-API-CONTRACT.md §4.3).

### Interface

```typescript
interface GetChallengeParams {
  did: string;
  seed: Uint8Array;   // concrete uses for DID-auth header computation
  sessionToken: string;
  clock: IClock;
}

// IYaIDApi
getChallenge(params: GetChallengeParams): Promise<{ nonce: string }>;
```

### `YaIDApiConcrete.getChallenge` — Internal Signing Sequence

```
1. timestamp   = clock.nowSeconds().toString()
2. authPayload = `${timestamp}:GET:/api/proof-sessions/${sessionToken}/challenge`
3. authSig     = ed25519.sign(authPayload, seed) → base64url (no padding)
4. GET /api/proof-sessions/{sessionToken}/challenge
      Headers: X-YaID-DID: {did}
               X-YaID-Timestamp: {timestamp}
               X-YaID-Signature: {authSig}
5. 200 → { nonce: body.nonce }
6. 401 with "Request expired" → throw AuthClockSkewError
7. 404 → throw SessionExpiredError
8. other 4xx/5xx → throw SessionExpiredError (session irrecoverable)
```

**CRITICAL**: This call is **irreversible**. After it resolves, the session transitions to `opened` on the server. The concrete must never call this method unless the use case has already verified the PIN. This responsibility belongs to `PresentProofUseCase`.

### Fake Behaviour

`YaIDApiMock.getChallenge()`:
- Default: returns `{ nonce: 'test-nonce-fixed' }` (fixed value for use in fixed-vector tests)
- Can be configured to throw `AuthClockSkewError` or `SessionExpiredError`
- Call count recorded — the fixed-vector VP test asserts `getChallenge` was called exactly once

---

## Method 3: `verifyPresentation`

### Route

`POST /api/presentations/verify` — **DID-authenticated** (MOBILE-API-CONTRACT.md §4.4).

### Interface

```typescript
interface VerifyPresentationParams {
  did: string;
  seed: Uint8Array;
  sessionToken: string;
  vp: VerifiablePresentation;
  clock: IClock;
}

// IYaIDApi
verifyPresentation(params: VerifyPresentationParams): Promise<{ verifiedAt: Date }>;
```

### `YaIDApiConcrete.verifyPresentation` — Internal Signing Sequence

```
1. timestamp    = clock.nowSeconds().toString()
2. authPayload  = `${timestamp}:POST:/api/presentations/verify`
3. authSig      = ed25519.sign(authPayload, seed) → base64url (no padding)
4. POST /api/presentations/verify
      Headers: X-YaID-DID: {did}
               X-YaID-Timestamp: {timestamp}
               X-YaID-Signature: {authSig}
      Body: params.vp (the full VP object including the `proof` field)
5. 200 with { valid: true } → { verifiedAt: new Date(body.verifiedAt) }
6. 200 with { valid: false } → throw PresentationRejectedError
7. 401 with "Request expired" → throw AuthClockSkewError
8. other errors → throw PresentationRejectedError (fail-safe terminal)
```

**No body signature on this route** (unlike `issueCredential`). The VP object already contains a `proof.signatureValue`. The DID-auth header (auth over the timestamp + method + path) is the only extra signature.

### Request Body Shape

The full `VerifiablePresentation` object is sent as-is:

```jsonc
{
  "holder": "did:yaid:user:<hex64>",
  "challenge": "<nonce>",
  "verifiableCredential": [{ /* parsed VC object */ }],
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-08-02T15:25:00Z",
    "verificationMethod": "did:yaid:user:<hex64>#key-1",
    "proofPurpose": "authentication",
    "signatureValue": "<base64url>"
  }
}
```

### Fake Behaviour

`YaIDApiMock.verifyPresentation()`:
- Default: returns `{ verifiedAt: new Date(clockMock.nowMs()) }`
- Can be configured to throw `PresentationRejectedError` or `AuthClockSkewError`
- Does NOT validate the VP structure or signatureValue (trusts the use case tests to cover that)
- Call count and last VP recorded for fixed-vector assertion

---

## Method 4: `cancelProofSession`

### Route

`POST /api/proof-sessions/{sessionToken}/cancel` — **DID-authenticated** (MOBILE-API-CONTRACT.md §4.5).

### Interface

```typescript
interface CancelProofSessionParams {
  did: string;
  seed: Uint8Array;
  sessionToken: string;
  clock: IClock;
}

// IYaIDApi
cancelProofSession(params: CancelProofSessionParams): Promise<void>;
```

### `YaIDApiConcrete.cancelProofSession` — Internal Signing Sequence

```
1. timestamp    = clock.nowSeconds().toString()
2. authPayload  = `${timestamp}:POST:/api/proof-sessions/${sessionToken}/cancel`
3. authSig      = ed25519.sign(authPayload, seed) → base64url (no padding)
4. POST /api/proof-sessions/{sessionToken}/cancel
      Headers: X-YaID-DID: {did}
               X-YaID-Timestamp: {timestamp}
               X-YaID-Signature: {authSig}
      Body: {} (empty body; the sessionToken is in the URL)
5. 200 → resolve (void)
6. 404 → resolve (void, idempotent — session already gone)
7. other errors → resolve (void, best-effort — cancel failure does not block user)
```

**Cancel is best-effort**: a network failure or server error on cancel MUST NOT show an error screen. The person tapped "Recusar" and that decision stands. The entry adapter should still navigate to the refusal result screen regardless.

**No PIN required**: `CancelProofSessionUseCase` does not call `IPinLock.verify()`. See [research.md §6](../research.md).

### Fake Behaviour

`YaIDApiMock.cancelProofSession()`:
- Default: resolves immediately (void)
- Can be configured to throw (to test that CancelProofSessionUseCase still resolves — best-effort)
- Call count recorded

---

## Summary Table

| Method | Route | Auth | Body sig | Reversible |
|---|---|---|---|---|
| `getProofSession` | GET /proof-sessions/{t} | none | — | n/a |
| `getChallenge` | GET /proof-sessions/{t}/challenge | DID-auth | — | **NO** |
| `verifyPresentation` | POST /presentations/verify | DID-auth | — | yes |
| `cancelProofSession` | POST /proof-sessions/{t}/cancel | DID-auth | — | no (idempotent) |
