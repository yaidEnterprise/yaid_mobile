# Implementation Plan: D2 — Comprovação

**Branch**: `002-comprovacao` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-comprovacao/spec.md`

## Summary

D2 delivers the credential issuance flow: explanation screen → PIN verification → camera permission → document capture → image review → send to YaID API → store credential. On success, the home screen gains its third state (identity + credential). D2 depends on D1 (IPinLock, IIdentityRepository, ISigner, IClock) and introduces three new ports (`IDocumentCapture`, `IImageProcessor`, `ICredentialRepository`) plus the `YaIDApi` port's first method (`issueCredential`).

All network and device calls are behind interfaces. The use case tests (covering PIN failure, image compression, signing, API failure, credential storage) run in Node without a simulator. See [research.md](./research.md) for compression strategy and error-form handling.

## Technical Context

**Language/Version**: TypeScript 5.x strict — Expo SDK 52+ / React Native 0.76+

**Primary Dependencies**: `expo-camera` (live camera capture), `expo-image-manipulator` (image resize/compress), `expo-file-system` (encrypted credential file), `expo-secure-store` (credential encryption key). Plus all D1 dependencies.

**Storage**: Credential stored in an encrypted file in app sandbox; the encryption key lives in OS Keychain. The credential file can exceed the 2 KB Keychain limit — hence the file approach (T3).

**Testing**: Node.js TypeScript runner — use case, controller, ViewModel, mapper tests run without simulator. `DocumentCaptureMock` returns a fixture image; `ImageProcessorMock` is a passthrough.

**Target Platform**: iOS 16+ and Android 10+ — Expo development build (mandatory).

**Performance Goals**: < 2 minutes from initial tap to credential visible (SC-001). Spinner + descriptive text during API call (FR-017).

**Constraints**: No credential created on failure (FR-026, SC-002 inverted). Photo never persisted locally (FR-019, SC-003). Zero network requests before PIN verification (FR-006, SC-006). No gallery option (FR-012, SC-007).

**Scale/Scope**: One credential per device installation (replaces on re-issuance after revocation).

## Constitution Check

| # | Gate | Pass? |
|---|---|---|
| I | New ports: `IDocumentCapture`, `IImageProcessor`, `ICredentialRepository`, `IYaIDApi` (partial). All in `shared/domain/interfaces/`; concretes + fakes in `shared/infra/`. No `expo-*` outside `shared/clients/`. Existing D1 ports reused without modification. | ✅ |
| II | TDD first. **Fixed-vector test**: known seed + known compressed image → expected `bodySignature`. Regression tests: failed API call leaves no local credential (FR-026), clock-skew error produces specific message (FR-028). | ✅ |
| III | Layer direction respected. `IssueCredentialViewModel` strips raw credential bytes — person sees only `ageOver18` and `issuedAt`. `shared/` stays at 5 entries. | ✅ |
| IV | Zero telemetry (FR-030). Photo discarded after send (FR-019). No verification history persisted. | ✅ |
| V | Seed never crosses ViewModel. PIN demanded before camera opens (FR-006). PIN failure never deletes identity (D1 invariant). TLS pinning mandatory for `issueCredential` call (T10). | ✅ |
| VI | `IssueCredential` / `Credential` / `CredentialRepository` as canonical identifiers. No "cancelar". `proofType` camelCase conversion (`ageOver18`) confined to `YaIDApiConcrete`. | ✅ |
| VII | No proof-session operations in D2. Failure is visible with a named reason (FR-025, SC-004, SC-005). Failed issuance never creates a partial credential (FR-026). | ✅ |
| UX | Dedicated result screens (success, failure) — no toast. No technical vocabulary (SC-010). Neutral colour for `ageOver18: false` (FR-024). WCAG 2.1 AA. | ✅ |

**Post-Phase-1 re-check**: All gates remain Pass. The `Credential` entity stores `ageOver18: boolean` directly (extracted from raw VC claims at issuance) to support D3's local eligibility check without runtime parsing.

## Project Structure

### Documentation (this feature)

```text
specs/002-comprovacao/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── credential_repository.md   ← ICredentialRepository — consumed by D3, D4
│   └── yaid_api_issue.md          ← IYaIDApi.issueCredential contract
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Files introduced by D2 (D1 files assumed in place):

```text
src/
├── app/
│   └── credential/
│       └── capture-document.tsx    ← entry adapter: explanation · PIN · camera · review · result
│
├── modules/
│   └── credential/
│       └── app/
│           ├── issue_credential_usecase.ts
│           ├── issue_credential_viewmodel.ts
│           ├── issue_credential_controller.ts
│           └── issue_credential_presenter.ts
│
└── shared/
    ├── domain/
    │   ├── entities/
    │   │   └── credential.ts
    │   ├── errors/
    │   │   └── credential_errors.ts   ← CredentialNotFoundError, CredentialAlreadyExistsError
    │   └── interfaces/
    │       ├── repositories/
    │       │   └── credential_repository.ts
    │       └── providers/
    │           ├── document_capture.ts
    │           ├── image_processor.ts
    │           └── yaid_api.ts        ← issueCredential method defined here
    ├── infra/
    │   ├── dto/
    │   │   └── issue_credential_dto.ts   ← VC JSON → Credential mapper
    │   ├── repositories/
    │   │   └── credential_repository_concrete.ts
    │   └── providers/
    │       ├── document_capture_concrete.ts
    │       ├── image_processor_concrete.ts
    │       ├── yaid_api_concrete.ts      ← handles DID-auth + body signing; extended in D3/D4
    │       └── mock/
    │           ├── credential_repository_mock.ts
    │           ├── document_capture_mock.ts
    │           ├── image_processor_mock.ts
    │           └── yaid_api_mock.ts
    ├── result/
    │   └── issue_credential_result.ts
    └── clients/
        ├── secure_store_client.ts   ← from D1
        ├── file_system_client.ts    ← new: expo-file-system wrapper
        └── http_client.ts           ← new: fetch + TLS pinning wrapper

tests/
├── modules/
│   └── credential/
│       └── app/
│           ├── issue_credential_usecase.test.ts    ← fixed-vector: seed + image → bodySignature
│           ├── issue_credential_viewmodel.test.ts  ← raw/seed/vcId stripped from output
│           └── issue_credential_controller.test.ts
└── shared/
    ├── infra/
    │   ├── dto/
    │   │   └── issue_credential_dto.test.ts
    │   └── providers/
    │       └── mock/
    │           ├── credential_repository_mock.test.ts
    │           └── yaid_api_mock.test.ts
    └── domain/
        └── entities/
            └── credential.test.ts
```

**Structure Decision**: Single Expo project. D2 introduces the `credential/` module and four new shared ports. `YaIDApiConcrete` is created here with one method and extended (same file) in D3 and D4.

## Complexity Tracking

No constitution violations requiring justification.
