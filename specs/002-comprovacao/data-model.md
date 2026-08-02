# Data Model — D2: Comprovação

**Branch**: `002-comprovacao` | **Date**: 2026-08-02

---

## Entities

### `Credential`

The person's digital credential, received from YaID after issuance. Stored encrypted; not transmitted after receipt.

```typescript
// src/shared/domain/entities/credential.ts
interface Credential {
  vcId: string;       // VC identity: `id` field (pre-Epic 9) or `jti` JWT claim (post-Epic 9)
  raw: string;        // full credential as received from the API — stored byte-for-byte, never modified
  issuedAt: Date;
  holder: string;     // did:yaid:user:<hex64> — must match Identity.did
  ageOver18: boolean; // extracted from VC claims at issuance; enables D3 local eligibility check
}
```

**Invariants**:
- `raw` is stored EXACTLY as received (JSON string, pre-Epic 9). Any reserialisation breaks the issuer's signature (API contract §4.1.1).
- `vcId` is extracted from `raw.id` (pre-Epic 9) or the `jti` JWT claim (post-Epic 9). Used by D4's revocation.
- `ageOver18` is extracted from `raw.claims.ageOver18` (pre-Epic 9) or the equivalent JWT claim (post-Epic 9).
- `holder` matches the `did` of the device's `Identity`. The server validates this (Rule 6 in `verify_presentation_usecase`).
- One credential per installation. A second issuance replaces the first (only possible after revocation, since D2 is blocked when a credential exists — FR-005).
- After revocation (D4), no `Credential` exists locally. There is no "revoked" local state; absence is the terminal state.

---

## Enums

### `ProofType`

```typescript
// src/shared/domain/enums/proof_type.ts
enum ProofType {
  Personhood = 'personhood',
  AgeOver18  = 'age_over_18',  // canonical snake_case; concrete converts to 'ageOver18' for issuance
}
```

**Introduced in D2.** Used by D3 for eligibility check (`session.proofType === ProofType.AgeOver18 && !credential.ageOver18`). The camelCase conversion (`ageOver18`) is confined to `YaIDApiConcrete`.

---

## Domain Errors

```typescript
// src/shared/domain/errors/credential_errors.ts

class CredentialNotFoundError extends Error {
  readonly kind = 'credential_not_found';
}

class CredentialAlreadyExistsError extends Error {
  readonly kind = 'credential_already_exists';
  // thrown by IssueCredentialUseCase if a credential exists before issuance starts
  // (defensive — the home screen should not offer the issuance flow when a credential exists)
}

class IssuanceApiError extends Error {
  readonly kind = 'issuance_api_error';
  constructor(
    readonly cause: 'document_unreadable' | 'server_unavailable' | 'clock_skew' | 'no_connection' | 'unknown',
    message: string,
  ) { super(message); }
}
```

---

## Port Interfaces

### `ICredentialRepository`

```typescript
// src/shared/domain/interfaces/repositories/credential_repository.ts
interface ICredentialRepository {
  save(credential: Credential): Promise<void>;
  load(): Promise<Credential | null>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;  // idempotent; used by D4
}
```

**Consumed by**: D3 (loads credential for eligibility check and VP assembly), D4 (loads vcId, deletes after revocation).

### `IDocumentCapture`

```typescript
// src/shared/domain/interfaces/providers/document_capture.ts
interface IDocumentCapture {
  capture(): Promise<string>;
  // Returns the captured image as a base64 string without 'data:' prefix.
  // Throws DocumentCaptureError if the camera is unavailable.
}
```

### `IImageProcessor`

```typescript
// src/shared/domain/interfaces/providers/image_processor.ts
interface IImageProcessor {
  compress(base64: string): Promise<string>;
  // Returns a base64 string (JPEG) guaranteed to be ≤ 1 048 576 bytes after encoding.
  // Resizes to max 1600 px on the long side before compression.
}
```

### `IYaIDApi` (partial — D2 contribution)

```typescript
// src/shared/domain/interfaces/providers/yaid_api.ts
// Methods added by D2 only; D3 and D4 add more methods to this same interface.

interface IYaIDApi {
  issueCredential(params: IssueCredentialParams): Promise<Credential>;
  // throws IssuanceApiError on any non-201 response or network failure
}

interface IssueCredentialParams {
  did: string;
  seed: Uint8Array;      // used by YaIDApiConcrete for both auth and body signatures
  documentImage: string; // compressed base64, sent as-is in the body
  proofType: ProofType;  // canonical; concrete converts to camelCase for the wire format
  clock: IClock;         // for generating the timestamp string
}
```

**Design note**: The `seed` is passed to the API port so that `YaIDApiConcrete` can compute both the DID-auth header signature (`${timestamp}:POST:/api/credentials/issue`) and the body signature (`` `${documentImage}:${proofTypeCamelCase}` ``). This keeps ALL wire-format conversion and signing within the infra layer, consistent with ARCHITECTURE.md §11.4. The fake ignores `seed` and returns scripted responses.

---

## Wire Format Mapping (DTO)

The VC format received from `POST /api/credentials/issue` (pre-Epic 9):

```jsonc
{
  "id": "uuid",
  "type": ["VerifiableCredential"],
  "issuer": "did:yaid:issuer:<hex64>",
  "holder": "did:yaid:user:<hex64>",
  "issuedAt": "ISO 8601",
  "claims": { "personhood": true },
  "proof": { "type": "Ed25519Signature2020", ... }
}
```

**Mapper** (`src/shared/infra/dto/issue_credential_dto.ts`):

```typescript
function vcResponseToCredential(raw: string, json: VCResponse): Credential {
  return {
    vcId: json.id,
    raw,
    issuedAt: new Date(json.issuedAt),
    holder: json.holder,
    ageOver18: json.claims.ageOver18 ?? true,
    // ageOver18 = true when claim absent (pre-Stories 5.7/5.8 format has only personhood)
    // ageOver18 = json.claims.ageOver18 post-update
  };
}
```

**Post-Epic 9 note**: When the VC becomes a JWT string, `raw` is the JWT string and `vcId` is the `jti` claim. The mapper changes; the entity shape does not.

---

## Use Case Input / Output DTOs

### `IssueCredentialUseCase`

```typescript
// in modules/credential/app/issue_credential_usecase.ts

interface IssueCredentialInput {
  pin: string;           // 6-digit PIN — verified as first step in the use case
  documentImage: string; // raw base64 from IDocumentCapture (before compression)
}

interface IssueCredentialOutput {
  ageOver18: boolean;    // shown on the home screen "no-data document" (FR-023)
  issuedAt: Date;        // shown on the home screen "no-data document" (FR-023)
  // vcId, raw, holder, seed — NOT in output
}
```

---

## State Transitions

```
Home screen: identity, no credential
  │
  └── credential/capture-document.tsx
        │
        step: explanation
        │
        step: pin-entry (uses D1's PinLock via IssueCredentialController)
        │ PinWrongError / PinBackoffActiveError → stay on pin-entry, show error
        │ abandoned → navigate back to home
        │ success →
        │
        step: camera
        │ permission denied → permission-denied screen (Abrir ajustes)
        │
        step: review
        │ "Repetir" → back to camera
        │ "Enviar" →
        │
        step: loading
        │ IssuanceApiError { cause: 'no_connection' }   → step: failure (connection message)
        │ IssuanceApiError { cause: 'clock_skew' }      → step: failure (clock message)
        │ IssuanceApiError { cause: 'document_unreadable' } → step: failure (doc message)
        │ IssuanceApiError { cause: 'server_unavailable' }  → step: failure (server message)
        │ success →
        │
        step: success
        │ navigate to home
        │
        step: failure
          "Tentar de novo" → step: explanation (PIN NOT re-required in same session)
          navigate back → home (still no credential)
```

The photo (`documentImage`) is never persisted beyond the `step: loading` transition. It lives in the React component state only while the user is in the review/loading step.
