# Contract: Port Additions for D4

**Branch**: `004-revogacao` | **Date**: 2026-08-02

These are the new methods added to existing shared port interfaces. Both additions must be implemented in their respective fakes before any use-case test can run.

---

## `CredentialRepository.delete()`

### Interface addition

```typescript
// src/shared/domain/interfaces/repositories/credential_repository.ts
interface CredentialRepository {
  find(): Promise<Credential>;           // existing
  save(credential: Credential): Promise<void>;  // existing
  delete(): Promise<void>;               // NEW — D4
}
```

### Semantics

- Removes the stored credential permanently.
- **Idempotent**: calling `delete()` when no credential exists must NOT throw. It resolves successfully.
- After `delete()`, a subsequent `find()` must throw `CredentialNotFoundError`.

### Fake addition (`CredentialRepositoryMock`)

```typescript
// src/shared/infra/mock/credential_repository_mock.ts
class CredentialRepositoryMock implements CredentialRepository {
  private credential: Credential | null = null;

  async find(): Promise<Credential> {
    if (!this.credential) throw new CredentialNotFoundError();
    return this.credential;
  }

  async save(credential: Credential): Promise<void> {
    this.credential = credential;
  }

  async delete(): Promise<void> {           // NEW
    this.credential = null;
  }
}
```

### Fake contract tests (mandatory)

The fake's own test file must verify:
1. `delete()` after `save()` → subsequent `find()` throws `CredentialNotFoundError`
2. `delete()` on empty repository → resolves without throwing
3. `delete()` called twice → resolves without throwing on second call

---

## `IYaIDApi.revokeCredential()`

Same interface pattern as D2's `issueCredential`: the concrete handles all signing; the interface takes `seed` and `clock`.

### Interface addition

```typescript
// src/shared/domain/interfaces/providers/yaid_api.ts
interface IYaIDApi {
  // ... existing methods

  revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }>;
  // throws RevocationApiError on any non-{ revoked: true } response
}

interface RevokeCredentialParams {
  did: string;        // did:yaid:user:<hex64> — used in X-YaID-DID header and auth payload
  seed: Uint8Array;   // concrete computes auth header sig + body sig with this
  vcId: string;       // body: credential identity; also the body-signature input
  clock: IClock;      // concrete calls clock.nowSeconds() for the auth timestamp
}
```

### Concrete responsibility (`YaIDApiConcrete`)

The concrete computes all signatures and assembles the request (see [research.md §6](../research.md)):

```
POST /api/credentials/revoke
Headers:
  X-YaID-DID:       params.did
  X-YaID-Timestamp: clock.nowSeconds().toString()
  X-YaID-Signature: base64url( ed25519.sign(`${ts}:POST:/api/credentials/revoke`, seed) )
  Content-Type:     application/json
Body:
  { "vcId": params.vcId, "bodySignature": base64url( ed25519.sign(vcId, seed) ) }

200 { revoked: true }                             → return { revoked: true }
401 { "error": "Request expired" }                → throw RevocationApiError { isClockSkew: true }
401 other                                         → throw RevocationApiError
502 { "error": "Blockchain revocation failed" }   → throw RevocationApiError
Network error / timeout                           → throw RevocationApiError { isNetworkError: true }
```

Error normalisation follows MOBILE-API-CONTRACT.md §7: both Form A (`"error": "string"`) and Form B (`"error": { "code": ... }`) are tolerated.

### Fake addition (`YaIDApiMock`)

```typescript
class YaIDApiMock implements IYaIDApi {
  // ... existing scripted methods

  private revokeResponse:
    | { revoked: true }
    | RevocationApiError = { revoked: true };

  scriptRevokeCredential(response: { revoked: true } | RevocationApiError): void {
    this.revokeResponse = response;
  }

  async revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }> {
    this.lastRevokeParams = params;  // stored for assertion
    if (this.revokeResponse instanceof RevocationApiError) throw this.revokeResponse;
    return this.revokeResponse;
  }
}
```

The mock does NOT validate signatures. It records call params for assertion.

### Fake contract tests (mandatory)

1. Default response `{ revoked: true }` is returned correctly
2. Scripted `RevocationApiError` is thrown as-is
3. `lastRevokeParams.vcId` and `lastRevokeParams.did` accessible after call (for use-case test assertions)

---

## No new `PinLock` methods

`PinLock.verify(pin: string): Promise<void>` is existing. D4 relies on this method's existing contract. If D1 has not yet defined the `PinBackoffActiveError` type (only `PinWrongError`), D4 adds `PinBackoffActiveError` to the error vocabulary. No new method on the interface.
