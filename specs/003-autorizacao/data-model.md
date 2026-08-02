# Data Model — D3: Autorização

**Branch**: `003-autorizacao` | **Date**: 2026-08-02

---

## 1. Entidades de domínio

### `ProofSession` (efêmero — nunca persistido)

```typescript
// src/shared/domain/entities/proof_session.ts

interface ProofSession {
  token: string;               // session token from deep link
  status: ProofSessionStatus;
  proofType: ProofType;        // from D2: 'personhood' | 'age_over_18'
  companyName: string;         // display name of the requesting party
  expiresAt: Date;             // derived from API response
}
```

**Ephemeral by design**: `ProofSession` is never saved to `IIdentityRepository`, `ICredentialRepository`, or any other store. It lives only in memory for the duration of the session screen. On background return, the data is re-fetched (not restored from cache).

### `ProofSessionStatus` enum

```typescript
// src/shared/domain/enums/proof_session_status.ts

enum ProofSessionStatus {
  WaitingUser   = 'waiting_user',      // normal — decision screen
  Opened        = 'opened',            // terminal — challenge consumed
  ApprovedByUser = 'approved_by_user', // terminal — already acted on
  Expired       = 'expired',           // terminal — time limit reached
  Cancelled     = 'cancelled',         // terminal — user or timeout cancelled
}
```

---

## 2. Erros de domínio (D3)

```typescript
// src/shared/domain/errors/presentation_errors.ts

class PresentationRejectedError extends Error {
  readonly kind = 'presentation_rejected';
  // server returned { valid: false } — no diagnostic available
}

class SessionExpiredError extends Error {
  readonly kind = 'session_expired';
  // status was not waiting_user at fetch time, or expired during flow
}

class SessionIneligibleError extends Error {
  readonly kind = 'session_ineligible';
  // credential.ageOver18 === false for an age_over_18 session
}

class SessionNotFoundError extends Error {
  readonly kind = 'session_not_found';
  // 404 from GET /api/proof-sessions/{token}
}

class AuthClockSkewError extends Error {
  readonly kind = 'auth_clock_skew';
  // server responded "Request expired" on DID-auth endpoint
}
```

---

## 3. Novos métodos em `IYaIDApi` (D3)

```typescript
// src/shared/domain/interfaces/providers/yaid_api.ts (additions)

interface IYaIDApi {
  // --- D1/D2 methods (unchanged) ---
  issueCredential(params: IssueCredentialParams): Promise<Credential>;

  // --- D3 additions ---
  getProofSession(params: GetProofSessionParams): Promise<ProofSession>;
  getChallenge(params: GetChallengeParams): Promise<{ nonce: string }>;
  verifyPresentation(params: VerifyPresentationParams): Promise<{ verifiedAt: Date }>;
  cancelProofSession(params: CancelProofSessionParams): Promise<void>;
}

interface GetProofSessionParams {
  sessionToken: string;
  // public route — no DID-auth required
}

interface GetChallengeParams {
  did: string;
  seed: Uint8Array;      // concrete uses for DID-auth header
  sessionToken: string;
  clock: IClock;
}

interface VerifyPresentationParams {
  did: string;
  seed: Uint8Array;      // concrete uses for DID-auth header
  sessionToken: string;
  vp: VerifiablePresentation;
  clock: IClock;
}

interface CancelProofSessionParams {
  did: string;
  seed: Uint8Array;      // concrete uses for DID-auth header
  sessionToken: string;
  clock: IClock;
}
```

---

## 4. Verifiable Presentation (tipo de montagem)

```typescript
// Not a stored entity — assembled in PresentProofUseCase and sent immediately

interface VPProof {
  type: 'Ed25519Signature2020';
  created: string;               // ISO 8601 from IClock
  verificationMethod: string;    // `${did}#key-1`
  proofPurpose: 'authentication';
  signatureValue: string;        // base64url of Ed25519 sig (64 bytes)
}

interface VerifiablePresentation {
  holder: string;                          // did:yaid:user:<hex64>
  challenge: string;                       // nonce from getChallenge
  verifiableCredential: object[];          // [JSON.parse(credential.raw)]
  proof: VPProof;
}

// The signing target (passed to ISigner.sign):
// JSON.stringify({ holder, challenge, verifiableCredential })  ← KEY ORDER MANDATORY
// No `proof` field in the signed string.
```

---

## 5. DTOs e mapeadores

```typescript
// src/shared/infra/dto/proof_session_dto.ts

// GET /api/proof-sessions/{token} response shape (§4.2)
interface ProofSessionApiResponse {
  token: string;
  status: 'waiting_user' | 'opened' | 'approved_by_user' | 'expired' | 'cancelled';
  proofType: 'personhood' | 'age_over_18';
  companyName: string;
  expiresAt: string;  // ISO 8601
}

// GET /api/proof-sessions/{token}/challenge response shape (§4.3)
interface ChallengeApiResponse {
  nonce: string;
}

// POST /api/presentations/verify response shape (§4.4)
interface VerifyPresentationApiResponse {
  valid: boolean;
  verifiedAt?: string;  // ISO 8601; present only when valid === true
}

// Mapper (lives in the Infra layer — only YaIDApiConcrete uses this)
function proofSessionDtoToEntity(dto: ProofSessionApiResponse): ProofSession {
  const statusMap: Record<ProofSessionApiResponse['status'], ProofSessionStatus> = {
    waiting_user:    ProofSessionStatus.WaitingUser,
    opened:          ProofSessionStatus.Opened,
    approved_by_user: ProofSessionStatus.ApprovedByUser,
    expired:         ProofSessionStatus.Expired,
    cancelled:       ProofSessionStatus.Cancelled,
  };
  const proofTypeMap: Record<ProofSessionApiResponse['proofType'], ProofType> = {
    personhood:  ProofType.Personhood,
    age_over_18: ProofType.AgeOver18,
  };
  return {
    token:       dto.token,
    status:      statusMap[dto.status],
    proofType:   proofTypeMap[dto.proofType],
    companyName: dto.companyName,
    expiresAt:   new Date(dto.expiresAt),
  };
}
```

---

## 6. Results (saída da camada de Use Case)

```typescript
// src/shared/result/get_proof_session_result.ts
type GetProofSessionResult =
  | { ok: true; session: ProofSession; eligibilityChecked: true }
  | { ok: false; error: SessionNotFoundError | SessionExpiredError | SessionIneligibleError };

// src/shared/result/present_proof_result.ts
type PresentProofResult =
  | { ok: true; verifiedAt: Date }
  | { ok: false; error: PinWrongError | PinBackoffActiveError | PresentationRejectedError | AuthClockSkewError };

// src/shared/result/cancel_proof_session_result.ts
type CancelProofSessionResult =
  | { ok: true }
  | { ok: false; error: SessionNotFoundError };
```

---

## 7. ViewModels (o que a camada de entrada vê)

```typescript
// GetProofSession — exposição mínima para a tela de decisão
interface GetProofSessionViewModel {
  companyName: string;
  proofTypeLabel: string;    // "Comprovante de identidade" | "Comprovante de maioridade"
  canDecide: boolean;        // true only when status === WaitingUser
}

// PresentProof — nenhum campo sensível; apenas estado de resultado
interface PresentProofViewModel {
  verifiedAtLabel: string;   // localised timestamp string
}

// CancelProofSession — vazio (navegação implícita ao resultado de recusa)
interface CancelProofSessionViewModel {}
```

---

## 8. Dependências (portas reutilizadas de D1/D2)

| Port | Defined in | Usage in D3 |
|---|---|---|
| `IIdentityRepository` | D1 | `load()` → `{ seed, publicKey, did }` for challenge + VP signing |
| `IPinLock` | D1 | `verify(pin)` — FIRST call in `PresentProofUseCase` |
| `ISigner` | D1 | `sign(payload, seed)` — VP signature |
| `IClock` | D1 | `nowMs()` for expiry check; `nowSeconds()` for DID-auth timestamp |
| `ICredentialRepository` | D2 | `exists()` for eligibility guard; `load()` → `{ raw, ageOver18 }` for VP |
| `IYaIDApi` | D2 | extended in D3 with 4 new methods |

No new persistent ports are added in D3. `ProofSession` is ephemeral.
