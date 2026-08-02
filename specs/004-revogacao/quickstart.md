# Quickstart — Validação da Revogação de Credencial (D4)

**Branch**: `004-revogacao` | **Date**: 2026-08-02

This guide describes how to validate that D4 is working end-to-end. It covers both automated (Node.js test runner) and manual (development build) validation.

---

## Prerequisites

- Development build installed on a device or simulator (not Expo Go — see ARCHITECTURE.md §1.1)
- `EXPO_PUBLIC_STAGE=test` for automated tests; `EXPO_PUBLIC_STAGE=dev` for manual validation
- D1 (identity creation, PIN) and D2 (credential issuance) must be working: the app must be able to reach the "identity created + credential issued" state
- Test runner: Node.js with TypeScript support (e.g., `tsx` or `ts-node` with the project's test script)

---

## 1. Automated tests (Node.js, no device)

Run from the repository root:

```bash
# All D4 tests
npx tsx --test tests/modules/credential/app/revoke_credential_usecase.test.ts
npx tsx --test tests/modules/credential/app/revoke_credential_controller.test.ts
npx tsx --test tests/modules/credential/app/revoke_credential_viewmodel.test.ts
npx tsx --test tests/modules/credential/app/revoke_credential_presenter.test.ts

# Fake contract tests for new port methods
npx tsx --test tests/shared/infra/mock/credential_repository_mock.test.ts
npx tsx --test tests/shared/infra/mock/yaid_api_mock.test.ts
```

### What each test file covers

**`revoke_credential_usecase.test.ts`**:
- Happy path: correct PIN → credential exists → API returns `{ revoked: true }` → credential deleted, output returned
- Fixed-vector test: known seed + known vcId → expected `bodySignature` (base64url)
- Fixed-vector test: known seed + known `{ts}:POST:/api/credentials/revoke` → expected `authSignature`
- Wrong PIN: `PinWrongError` propagates, credential untouched
- Backoff active: `PinBackoffActiveError` propagates, credential untouched
- No credential: `CredentialNotFoundError` propagates before any signing
- API failure: `RevocationApiError` propagates, `CredentialRepository.delete()` is NOT called
- Clock skew: `RevocationApiError { isClockSkew: true }` propagates
- **Regression test**: `CredentialRepository.delete()` is never called unless `{ revoked: true }` received (verifies FR-004, FR-005)

**`revoke_credential_controller.test.ts`**:
- Valid input `{ pin: '123456' }` → use case succeeds → `RevokeCredentialSuccess` with ViewModel
- Invalid input (e.g., wrong length) → `RevokeCredentialFailure { kind: 'pin_wrong' }` without calling use case
- Each error type (`PinWrongError`, `PinBackoffActiveError`, `CredentialNotFoundError`, `RevocationApiError` variants) → correct `RevokeCredentialFailure` kind
- `remainingMs` present in result when kind is `'pin_backoff'`
- `attemptsLeft` present in result when kind is `'pin_wrong'`

**`revoke_credential_viewmodel.test.ts`**:
- Correct shape: `revokedAt` is a formatted string, `credentialType` is a label
- No sensitive field leaks: `vcId`, `raw`, `holder`, `proofType` enum value not present in output

**`revoke_credential_presenter.test.ts`**:
- Stage `'test'` → all fakes wired (no real SDK instantiated)
- Stage `'dev'` → all concretes wired (no fakes)
- Returns a `RevokeCredentialController` instance

---

## 2. Manual validation — development build

### 2.1 Happy path (US 1)

**Setup**: App in state "identity created + credential issued"

**Steps**:
1. Navigate to the revocation option (e.g., from credential detail or settings)
2. Enter the correct 6-digit PIN
3. Read the confirmation screen — verify it states the operation is permanent and irreversible
4. Tap "Confirmar revogação"
5. Wait for the result screen

**Expected**:
- The dedicated result screen is shown (not a toast) — SC-003 ✓
- The result screen confirms the credential was invalidated
- Navigating back to the main screen shows the "no credential" state
- A fresh attempt to start the proof-session flow (D3) shows "no credential" message — SC-002 ✓

### 2.2 Abort before confirmation (US 2, scenario 2)

**Setup**: Same as above

**Steps**:
1. Navigate to revocation option
2. Enter correct PIN
3. On confirmation screen, tap "Voltar"

**Expected**:
- Flow ends; no API call was made
- Credential still exists
- App returns to previous screen without any change — spec scenario 3 ✓

### 2.3 Wrong PIN (US 3)

**Steps**:
1. Navigate to revocation option
2. Enter an incorrect PIN

**Expected**:
- Error message identifies the cause (wrong PIN) and instructs next action — FR-001 ✓
- Credential unchanged
- Identity unchanged (verify by completing a different flow that uses identity)

### 2.4 Network failure (US 4)

**Setup**: Disable network on the device after reaching the confirmation screen

**Steps**:
1. Navigate to revocation; enter correct PIN; reach confirmation screen
2. Disable network
3. Tap "Confirmar revogação"

**Expected**:
- Error screen shows named cause ("sem conexão" or equivalent) and states credential was not changed — FR-008 ✓
- Credential still exists locally
- Retry option available — spec scenario 2 of US 4 ✓

### 2.5 No credential (US 5)

**Setup**: App in state "identity created, no credential"

**Expected**:
- The revocation option is not actionable (hidden, disabled, or shows "sem credencial") — FR-011, SC-006 ✓

---

## 3. Invariant cross-checks

These verify SC-002 and SC-005 — the success criteria that cut across flows:

| Invariant | How to verify |
|---|---|
| Post-revocation authorisation fails gracefully | After revocation, trigger a proof-session deep link (D3). App should inform "no credential" before attempting any API call. |
| PIN failure never deletes credential | Enter wrong PIN repeatedly (up to and past the backoff threshold). Credential must still exist and be readable by the app. |
| Credential absent after success | After successful revocation, inspect app storage (dev build inspector or dedicated test in CredentialRepositoryImpl) — no credential record should exist. |

---

## 4. References

- Data model and entity fields: [data-model.md](./data-model.md)
- Use case and controller contracts: [contracts/use-case.md](./contracts/use-case.md)
- Port addition specs (delete, revokeCredential): [contracts/port-additions.md](./contracts/port-additions.md)
- API route details: [MOBILE-API-CONTRACT.md](../../docs/MOBILE-API-CONTRACT.md) §4.6
- Architecture layer rules: [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- Design decisions (button labels, vcId, backoff): [research.md](./research.md)
