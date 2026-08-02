# Contract: RevokeCredentialUseCase

**Branch**: `004-revogacao` | **Date**: 2026-08-02

---

## Signature

```typescript
class RevokeCredentialUseCase {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly pinLock: IPinLock,
    private readonly clock: IClock,
    private readonly yaIDApi: IYaIDApi,
  ) {}

  async execute(input: RevokeCredentialInput): Promise<RevokeCredentialOutput>
}
```

Note: `ISigner` is NOT injected into the use case. All Ed25519 operations are handled inside `YaIDApiConcrete` — same pattern as D2's `IssueCredentialUseCase`.

---

## Ports consumed

| Port | Methods called | Purpose |
|---|---|---|
| `IIdentityRepository` | `load()` | Retrieve `{ seed, publicKey, did }` |
| `ICredentialRepository` | `load()`, `delete()` | Read credential for `vcId`; delete on confirmed success |
| `IPinLock` | `verify(pin)` | Authenticate the person before any action |
| `IClock` | passed to IYaIDApi | Concrete uses `nowSeconds()` for the auth timestamp |
| `IYaIDApi` | `revokeCredential({ did, seed, vcId, clock })` | Concrete computes all signatures and calls the API |

---

## Execution sequence (happy path)

```
1.  IPinLock.verify(input.pin)
      → throws PinWrongError | PinBackoffActiveError on failure (abort, credential untouched)
2.  identity   = await IIdentityRepository.load()   ← { seed, publicKey, did }
3.  credential = await ICredentialRepository.load()
      → returns null if absent → throw CredentialNotFoundError
4.  result = await IYaIDApi.revokeCredential({
        did:   identity.did,
        seed:  identity.seed,    ← concrete uses this for all signing
        vcId:  credential.vcId,
        clock: this.clock,       ← concrete uses clock.nowSeconds() internally
      })
      → throws RevocationApiError on any non-{ revoked: true } response (abort, credential untouched)
5.  await ICredentialRepository.delete()
6.  return { revokedAt: new Date(), proofType: credential.proofType }
```

**Invariant**: `ICredentialRepository.delete()` is called **only** after `IYaIDApi.revokeCredential()` returns `{ revoked: true }`. If step 4 throws, step 5 is never reached.

---

## Error paths

| Error thrown by | Type | Meaning for the controller |
|---|---|---|
| `IPinLock.verify()` | `PinWrongError` | Wrong PIN; pass `attemptsRemaining` to result |
| `IPinLock.verify()` | `PinBackoffActiveError` | Must wait; pass `lockedUntilMs` to result |
| `ICredentialRepository.load()` (null) | `CredentialNotFoundError` | No credential to revoke |
| `IYaIDApi.revokeCredential()` | `RevocationApiError { isClockSkew: true }` | Device clock out of sync |
| `IYaIDApi.revokeCredential()` | `RevocationApiError { isNetworkError: true }` | No connectivity or network timeout |
| `IYaIDApi.revokeCredential()` | `RevocationApiError` (other) | API-side failure (e.g., 502 blockchain error) |

The use case does not catch these errors — they propagate to the controller, which maps each to a typed `RevokeCredentialFailure` variant.

---

## Controller contract

```typescript
// src/shared/result/revoke_credential_result.ts

type RevokeCredentialResult =
  | RevokeCredentialSuccess
  | RevokeCredentialFailure;

interface RevokeCredentialSuccess {
  readonly ok: true;
  readonly vm: RevokeCredentialViewModel; // produced by RevokeCredentialViewModel.from(output)
}

type RevokeCredentialFailureKind =
  | 'pin_wrong'
  | 'pin_backoff'
  | 'no_credential'
  | 'clock_skew'
  | 'network_error'
  | 'api_error';

interface RevokeCredentialFailure {
  readonly ok: false;
  readonly kind: RevokeCredentialFailureKind;
  readonly message: string;           // human-readable context (not shown directly — entry adapter maps to UX copy)
  readonly lockedUntilMs?: number;    // present when kind === 'pin_backoff' (epoch ms)
  readonly attemptsRemaining?: number; // present when kind === 'pin_wrong' (0-4)
}
```

---

## ViewModel contract

```typescript
// src/modules/credential/app/revoke_credential_viewmodel.ts

interface RevokeCredentialViewModel {
  readonly revokedAt: string;  // formatted date string (locale-aware, no raw Date in view)
  readonly credentialType: string; // human-readable label for proofType (e.g., "Identidade Pessoal")
  // seed, vcId, raw credential: NEVER present — ViewModel boundary enforced
}

class RevokeCredentialViewModel {
  static from(output: RevokeCredentialOutput): RevokeCredentialViewModel
}
```

The ViewModel strips every field from `RevokeCredentialOutput` that the screen does not need to render. Currently only `revokedAt` and `credentialType` are needed for the success screen.

---

## Presenter contract

```typescript
// src/modules/credential/app/revoke_credential_presenter.ts

function revokeCredentialPresenter(): RevokeCredentialController {
  const stage = environments.stage;
  const identityRepository = stage === 'test'
    ? new IdentityRepositoryMock()
    : new IdentityRepositoryConcrete();
  const credentialRepository = stage === 'test'
    ? new CredentialRepositoryMock()
    : new CredentialRepositoryConcrete();
  const pinLock = stage === 'test'
    ? new PinLockMock()
    : new PinLockConcrete();
  const clock = stage === 'test'
    ? new ClockMock()
    : new ClockConcrete();
  const yaIDApi = stage === 'test'
    ? new YaIDApiMock()
    : new YaIDApiConcrete();  // YaIDApiConcrete handles all Ed25519 signing internally

  const useCase = new RevokeCredentialUseCase(
    identityRepository, credentialRepository, pinLock, clock, yaIDApi,
  );
  return new RevokeCredentialController(useCase);
}
```

The presenter is a pure function — no state, no class, called per action (not once at startup).
