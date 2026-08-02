# Research — D3: Autorização

**Branch**: `003-autorizacao` | **Date**: 2026-08-02

---

## 1. Formato da Verifiable Presentation (atual vs. pós-Epic 9)

**Decision**: Build for the CURRENT format accepted by `POST /api/presentations/verify` (MOBILE-API-CONTRACT.md §4.4): a VP object with a `proof` field, not a JWT.

**Current VP format** (what the server accepts today):

```jsonc
{
  "holder": "did:yaid:user:<hex64>",
  "challenge": "<nonce>",
  "verifiableCredential": [ { /* parsed VC object, exactly as received */ } ],
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "<ISO 8601>",
    "verificationMethod": "<holderDid>#key-1",
    "proofPurpose": "authentication",
    "signatureValue": "<base64url of Ed25519 sig>"
  }
}
```

**What the server signs** (for verification): `JSON.stringify({holder, challenge, verifiableCredential})` in THAT EXACT KEY ORDER, WITHOUT the `proof` field (API contract §4.4).

**pós-Epic 9 format** (ARCHITECTURE.md §11.3 — target, not yet accepted by server): A JWT with EdDSA. Open question #1 in §16 blocks this. The app will be updated when the API is updated; no code structure change needed since the VP assembly is in one use case.

**Compatibility note**: `D3 spec FR-028` describes assembling the VP with `JSON.stringify({holder, challenge, verifiableCredential})` for signing — this aligns with the CURRENT format and API contract, not with the JWT target. The spec is correct for the current implementation.

---

## 2. Ordem das chaves no JSON e invariância da serialização

**Decision**: Assemble the VP body as a JavaScript object literal with keys in the EXACT required order: `holder` first, `challenge` second, `verifiableCredential` third. V8/Hermes preserves insertion order in `JSON.stringify`.

**Why order matters**: The server calls `JSON.stringify({holder, challenge, verifiableCredential})` to verify. If the client sends keys in a different order, the client's signed string differs from the server's verification string → `{ valid: false }`.

**Implementation in `PresentProofUseCase`**:

```typescript
const vpBody = {
  holder:                 did,
  challenge:              nonce,
  verifiableCredential:   [JSON.parse(credential.raw)],
};
const payload = JSON.stringify(vpBody);   // key order preserved by Hermes
const sig     = await ISigner.sign(new TextEncoder().encode(payload), identity.seed);
```

**`JSON.parse(credential.raw)`**: parses the verbatim stored VC JSON. `JSON.parse → JSON.stringify` roundtrip preserves key order in Hermes. The VC inside `verifiableCredential` must serialize identically on client and server — this is why `credential.raw` must be stored byte-for-byte from the API response (FR-021, D2).

**Fixed-vector test**: test with a known `seed`, known `credential.raw`, known `nonce` → assert `signatureValue` equals a pre-computed value from a reference Ed25519 implementation. This catches any key-order or encoding regression silently.

---

## 3. Verificação de elegibilidade local

**Decision**: `GetProofSessionUseCase` checks eligibility BEFORE displaying the decision screen and BEFORE any API call that mutates state.

**Logic**:

```typescript
if (proofSession.proofType === ProofType.AgeOver18 && !credential.ageOver18) {
  return { eligible: false };  // → ineligibility screen; no challenge called
}
```

For `ProofType.Personhood`: always eligible (having a credential means personhood is verified).

**Why**: D3 spec US3 and FR-009–FR-011, §11.2. Calling the challenge endpoint when ineligible would:
1. Burn the session (challenge is irreversible)
2. Produce a `{ valid: false }` response with no diagnostic

The eligibility check is local (no API call) and uses `credential.ageOver18` extracted at issuance (D2). No runtime parsing of `credential.raw` needed.

---

## 4. Estados terminais da sessão e verificação de retorno ao primeiro plano

**Decision**: Both `GetProofSessionUseCase` (on screen mount) and a `refetchOnForeground` call use the same use case to re-validate the session state when the app returns from background.

**Terminal states** from `GET /api/proof-sessions/{token}`:

| status | Handling |
|---|---|
| `waiting_user` | Normal — show decision screen |
| `opened` | Terminal — challenge already consumed; treat as expired (FR-006) |
| `approved_by_user` | Terminal — treat as expired |
| `expired` | Terminal — show expiry screen |
| `cancelled` | Terminal — treat as expired |

**Foreground-return logic** (FR-034, FR-035):
- `[session].tsx` subscribes to `AppState.addEventListener('change', ...)` while in `step: decision`
- On `'active'`: calls `GetProofSessionController.execute({ sessionToken })` again
- If the session transitioned to any non-`waiting_user` state → show expiry screen
- Buttons reactivate only after the re-check resolves

**Regression test**: calling `GetProofSessionUseCase` while session is `opened` → returns `eligible: false` with `terminalReason: 'already_opened'` → entry adapter shows expiry screen without attempting challenge.

---

## 5. Sequência de PIN → challenge — regra de ouro

**Decision**: `PresentProofUseCase` calls `IPinLock.verify(pin)` as its FIRST operation. The challenge (`GET /challenge`) is called ONLY after `IPinLock.verify()` resolves successfully.

**Full sequence in `PresentProofUseCase.execute({ pin, sessionToken })`**:

```
1. IPinLock.verify(pin)                   ← FIRST; throws PinWrongError / PinBackoffActiveError
2. IIdentityRepository.load()             ← get { seed, publicKey, did }
3. ICredentialRepository.load()           ← get { raw, ageOver18, vcId, holder }
4. IYaIDApi.getChallenge(...)             ← IRREVERSIBLE — only here after PIN verified
5. assemble vpBody, sign
6. IYaIDApi.verifyPresentation(...)
7. if { valid: false } → throw PresentationRejectedError
8. return { verifiedAt }
```

**Regression test** (mandatory per §11.2): Assert that `IYaIDApi.getChallenge` is NEVER called when `PinLockMock` is configured to throw. This prevents any refactoring from moving the PIN check after the challenge call.

---

## 6. Recusa — sem PIN, sem custo

**Decision**: `CancelProofSessionUseCase` does NOT call `IPinLock.verify()`. The person simply taps "Recusar" and the session is cancelled.

**Rationale**: R10 of baseline: "Recusar precisa ser tão fácil quanto autorizar, ou o consentimento não é real." Requiring a PIN for refusal would create asymmetry and impose an authentication cost on a non-sensitive operation. DID-auth is still required by the API (the HTTP adapter signs the request), but the USER is not prompted.

**API note** (§2.5): `cancel` does NOT bind the DID to the session at the server — any valid identity that holds the token can cancel. The DID-auth requirement on the HTTP level is still satisfied (the concrete computes auth headers using the identity's seed). The session ownership check is not enforced.

---

## 7. Erro de relógio no fluxo de autorização

**Decision**: If `IYaIDApi.getChallenge()` or `IYaIDApi.verifyPresentation()` returns a clock-skew error (`Request expired`), `PresentProofUseCase` throws `AuthClockSkewError`. The entry adapter renders the specific message: "A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo." (FR-037, ARCHITECTURE.md §11.1).

**Note**: A clock-skew error after the challenge has been called means the challenge was consumed and the session is in `opened` state. The result is shown as a dedicated "Falhou" screen (not a retry), consistent with the "failure is terminal" rule (FR-033).

---

## 8. Grafia de `proofType` nos endpoints de D3

**Decision**: `YaIDApiConcrete` converts the canonical `ProofType` enum to the wire-format string in each relevant method.

| Endpoint | Wire format | Source |
|---|---|---|
| `GET /api/proof-sessions/{t}` (response) | `age_over_18` (snake_case) | API contract §4.2 |
| `POST /api/presentations/verify` (body) | no proofType in VP body | — |

The mapper `proofSessionDtoToEntity()` converts `"age_over_18" → ProofType.AgeOver18` and `"personhood" → ProofType.Personhood`. No other file performs this conversion.
