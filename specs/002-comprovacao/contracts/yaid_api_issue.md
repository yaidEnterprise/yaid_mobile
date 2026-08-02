# Contract: IYaIDApi.issueCredential

**Defined in**: D2 | **Extended by**: D3 (adds getProofSession, getChallenge, verifyPresentation, cancelProofSession), D4 (adds revokeCredential)

This document covers only the `issueCredential` method added to `IYaIDApi` in D2. See D3's and D4's contracts for the remaining methods.

---

## Route

`POST /api/credentials/issue` — DID-authenticated, body-signed. See MOBILE-API-CONTRACT.md §4.1.

---

## Interface Method

```typescript
// src/shared/domain/interfaces/providers/yaid_api.ts (partial)

interface IYaIDApi {
  issueCredential(params: IssueCredentialParams): Promise<Credential>;
}

interface IssueCredentialParams {
  did: string;
  seed: Uint8Array;      // used internally for all Ed25519 operations
  documentImage: string; // compressed base64, ≤ 1 MB after encoding
  proofType: ProofType;  // canonical enum; concrete converts to wire format
  clock: IClock;
}
```

---

## `YaIDApiConcrete.issueCredential` — Internal Signing Sequence

The concrete is responsible for all protocol details (ARCHITECTURE.md §11.4):

```
1. timestamp    = clock.nowSeconds().toString()
2. authPayload  = `${timestamp}:POST:/api/credentials/issue`
3. authSig      = ed25519.sign(authPayload, seed) → base64url (no padding)
4. wirePT       = proofType === ProofType.AgeOver18 ? 'ageOver18' : 'personhood'
5. bodyPayload  = `${documentImage}:${wirePT}`
6. bodySig      = ed25519.sign(bodyPayload, seed) → base64url (no padding)
7. POST /api/credentials/issue
      Headers: X-YaID-DID, X-YaID-Timestamp, X-YaID-Signature
      Body: { documentImage, proofType: wirePT, bodySignature: bodySig }
```

**Pitfalls from API contract §2.2** (all three produce silent 401):
- `authPayload` uses the EXACT timestamp string sent in the header (not a parsed number)
- Method is uppercase `POST`
- Path is `/api/credentials/issue` — no trailing slash, no query string

---

## Response Handling

| HTTP code | Body | Mapped to |
|---|---|---|
| 201 | VC JSON object | `vcResponseToCredential(rawBody, parsedJson)` → `Credential` |
| 401 | `{ "error": "..." }` (Form A) | `IssuanceApiError { cause: 'clock_skew' }` if `"Request expired"` else `'unknown'` |
| 422 | `{ "error": "Document processing failed" }` | `IssuanceApiError { cause: 'document_unreadable' }` |
| 502 | `{ "error": "Blockchain registration failed" }` | `IssuanceApiError { cause: 'server_unavailable' }` |
| 400 | `{ "error": { "code": "VALIDATION_ERROR", ... } }` (Form B) | `IssuanceApiError { cause: 'unknown' }` |
| Network error | — | `IssuanceApiError { cause: 'no_connection' }` |

---

## Fake Behaviour

`YaIDApiMock.issueCredential()`:
- Default: returns a scripted `Credential` (with a fixed `raw` string and `vcId`)
- Can be configured to throw `IssuanceApiError` with any cause for negative-path tests
- Ignores `seed` (does not validate signatures)
- Records calls (call count, last params) for assertion in tests
