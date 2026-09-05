# Tasks: D2 — Comprovação

**Input**: Design documents from `/specs/002-comprovacao/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: MANDATORY for logic layers (use case, controller, viewmodel, DTO, mapper, fakes,
concrete signing/response-mapping) — written first, must fail before implementation
(constitution, Principle II). React Native entry-adapter screens are validated via
quickstart.md on-device (project convention, per D1).

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every description

## Path Conventions

This project follows the YaID Wallet structure per plan.md:

- `src/app/` — entry adapters (Expo Router screens)
- `src/modules/{module}/app/` — presenter · controller · use case · viewmodel
- `src/shared/` — domain · infra · result · clients · environments.ts
- `tests/` — mirrors `src/` 1:1

**Architecture note (reconciled with D1 as-built)**: There is no `ISigner` port — signing
uses `Ed25519Client` (`src/shared/clients/ed25519_client.ts`). Stage-branching is centralized
in `environments.ts` factories; presenters call `createX()` factories and never branch on
`Stage`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install device dependencies and configure the camera permission before code

- [X] T001 Install `expo-camera`, `expo-image-manipulator`, and `expo-file-system`; verify all three appear in package.json dependencies
- [X] T002 Configure camera permission strings for the development build (`NSCameraUsageDescription` for iOS, `android.permissions: ["CAMERA"]`) in app.json / app.config

---

## Phase 2: Foundational (Shared Domain & Infrastructure)

**Purpose**: Entity, enum, errors, the four new ports, result type, new clients, the DTO
mapper, all fakes + contract tests, and the environments factories — blocking prerequisites
for every user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Domain Primitives

- [X] T003 [P] Create `Credential` entity (`vcId: string`, `raw: string`, `issuedAt: Date`, `holder: string`, `ageOver18: boolean`) with invariant test (raw stored byte-for-byte; holder matches `did:yaid:user:` shape) in src/shared/domain/entities/credential.ts + tests/shared/domain/entities/credential.test.ts
- [X] T004 [P] Create `ProofType` enum (`Personhood = 'personhood'`, `AgeOver18 = 'age_over_18'`) in src/shared/domain/enums/proof_type.ts
- [X] T005 [P] Create credential domain errors (`CredentialNotFoundError`, `CredentialAlreadyExistsError`, and `IssuanceApiError` with `cause: 'document_unreadable' | 'server_unavailable' | 'clock_skew' | 'no_connection' | 'unknown'`) in src/shared/domain/errors/credential_errors.ts

### Port Interfaces

- [X] T006 [P] Define `ICredentialRepository` (`save` / `load` / `exists` / `delete` — delete idempotent) in src/shared/domain/interfaces/repositories/credential_repository.ts
- [X] T007 [P] Define `IDocumentCapture` (`capture(): Promise<string>` returning base64 with no `data:` prefix) in src/shared/domain/interfaces/providers/document_capture.ts
- [X] T008 [P] Define `IImageProcessor` (`compress(base64): Promise<string>` — ≤ 1 048 576 bytes, resize to 1600 px long side) in src/shared/domain/interfaces/providers/image_processor.ts
- [X] T009 [P] Define `IYaIDApi` with `issueCredential(params: IssueCredentialParams): Promise<Credential>` and `IssueCredentialParams` (`did`, `seed: Uint8Array`, `documentImage: string`, `proofType: ProofType`, `clock: IClock`) in src/shared/domain/interfaces/providers/yaid_api.ts

### Result Type

- [X] T010 [P] Create `IssueCredentialResult` (success `{ ageOver18: boolean, issuedAt: Date }` / typed error variants) in src/shared/result/issue_credential_result.ts

### Infrastructure Clients (new)

- [X] T011 [P] Create `FileSystemClient` (thin wrapper over `expo-file-system`: read/write/delete at documentDirectory) in src/shared/clients/file_system_client.ts
- [X] T012 [P] Create `HttpClient` (fetch wrapper with TLS pinning for the YaID host; throws a network-failure signal distinct from HTTP errors) in src/shared/clients/http_client.ts
- [X] T013 [P] Create `ImageManipulatorClient` (wraps `expo-image-manipulator` resize + JPEG encode + base64 read) in src/shared/clients/image_manipulator_client.ts

### Wire-Format Mapper (DTO)

- [X] T014 [P] Write failing DTO test (`claims.personhood:true` no ageOver18 → `ageOver18=true` default; `claims.ageOver18:false` → `false`; `raw` identical byte-for-byte), then implement `vcResponseToCredential(raw, json)` in src/shared/infra/dto/issue_credential_dto.ts + tests/shared/infra/dto/issue_credential_dto.test.ts

### Mock Implementations + Contract Tests (TDD)

> **NOTE: Write each test FIRST, confirm it FAILS, then implement the mock**

- [X] T015 [P] Write `CredentialRepositoryMock` contract test (save→load returns same entity incl. `raw` verbatim; load-when-empty→null; exists false/true; delete→exists false + load null; delete-when-empty does not throw), implement in-memory single-slot mock in src/shared/infra/repositories/mock/credential_repository_mock.ts + tests/shared/infra/repositories/mock/credential_repository_mock.test.ts
- [X] T016 [P] Write `DocumentCaptureMock` contract test (`capture()` returns a fixed minimal-JPEG base64 fixture, deterministic), implement mock in src/shared/infra/providers/mock/document_capture_mock.ts + tests/shared/infra/providers/mock/document_capture_mock.test.ts
- [X] T017 [P] Write `ImageProcessorMock` contract test (passthrough — returns input unchanged), implement mock in src/shared/infra/providers/mock/image_processor_mock.ts + tests/shared/infra/providers/mock/image_processor_mock.test.ts
- [X] T018 [P] Write `YaIDApiMock` contract test (default returns scripted `Credential`; configurable to throw `IssuanceApiError` with any cause; ignores `seed`; records call count + last params), implement mock in src/shared/infra/providers/mock/yaid_api_mock.ts + tests/shared/infra/providers/mock/yaid_api_mock.test.ts

### Composition-Root Factories

- [X] T019 Extend src/shared/environments.ts with `createCredentialRepository()`, `createDocumentCapture()`, `createImageProcessor()`, `createYaIDApi()` — each returning the Mock for `Stage.Test` and the Concrete otherwise (same pattern as `createIdentityRepository`)

**Checkpoint**: Foundational phase complete — all mock/DTO contract tests pass; user story implementation can now begin

---

## Phase 3: User Story 1 — Comprovar a identidade com sucesso (Priority: P1) 🎯 MVP

**Goal**: A person with an identity and no credential taps "Verificar meu documento", reads
the explanation + privacy notice, enters their PIN, grants camera permission, captures the
document live, reviews and submits; the credential is stored and the home screen shows the
third form (documento sem dados).

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/credential/app/*.test.ts' 'tests/shared/infra/providers/yaid_api_concrete.test.ts'`; then follow quickstart.md §2.1 on device.

### Tests for User Story 1 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US1] Write failing `IssueCredentialUseCase` test: PIN correct → `IIdentityRepository.load()` → `IImageProcessor.compress()` → `IYaIDApi.issueCredential()` → `ICredentialRepository.save()` called exactly once; **`IPinLock.verify()` is the FIRST call** — `IYaIDApi`/`ICredentialRepository` never touched when PIN is wrong (`PinWrongError` propagated); guard: credential already exists → `CredentialAlreadyExistsError` before any capture in tests/modules/credential/app/issue_credential_usecase.test.ts
- [X] T021 [P] [US1] Write failing `IssueCredentialViewModel` test: output contains only `{ ageOver18, issuedAt }` — `vcId`, `raw`, `holder`, `seed` ABSENT in tests/modules/credential/app/issue_credential_viewmodel.test.ts
- [X] T022 [P] [US1] Write failing `IssueCredentialController` test (success result; error propagation for PIN + API failures) in tests/modules/credential/app/issue_credential_controller.test.ts
- [X] T023 [P] [US1] Write failing `YaIDApiConcrete.issueCredential` **fixed-vector** test: known 32-byte seed + known base64 image → expected `authSig` (`ed25519.sign("${ts}:POST:/api/credentials/issue")`) and `bodySig` (`ed25519.sign("${image}:${wirePT}")`) base64url; 201 VC JSON → `Credential` via mapper in tests/shared/infra/providers/yaid_api_concrete.test.ts

### Implementation for User Story 1

- [X] T024 [US1] Implement `IssueCredentialUseCase` (input `{ pin, documentImage }`: `IPinLock.verify(pin)` first; guard `ICredentialRepository.exists()` → `CredentialAlreadyExistsError`; `IIdentityRepository.load()` for `{ seed, did }`; `IImageProcessor.compress(documentImage)`; `IYaIDApi.issueCredential({ did, seed, documentImage, proofType: ProofType.AgeOver18, clock })`; `ICredentialRepository.save(credential)`; return `{ ageOver18, issuedAt }`) in src/modules/credential/app/issue_credential_usecase.ts
- [X] T025 [P] [US1] Implement `IssueCredentialViewModel` (returns only `{ ageOver18, issuedAt }`; strips `vcId`/`raw`/`holder`/`seed`) in src/modules/credential/app/issue_credential_viewmodel.ts
- [X] T026 [US1] Implement `IssueCredentialController` in src/modules/credential/app/issue_credential_controller.ts
- [X] T027 [US1] Implement `IssueCredentialPresenter` (composition root — resolves deps via `createPinLock(createClock())`, `createClock`, `createIdentityRepository`, `createImageProcessor`, `createYaIDApi`, `createCredentialRepository`; never branches on `Stage`) in src/modules/credential/app/issue_credential_presenter.ts
- [X] T028 [P] [US1] Implement `CredentialRepositoryConcrete` (AES-256-GCM encrypted JSON via `crypto.subtle` at `documentDirectory + 'yaid_credential.enc'`; 32-byte key in Keychain `yaid.credential.key`; `save` writes `{ nonce, ciphertext }`; `load` decrypts→entity; `exists` file-check only; `delete` idempotent file + key) using `FileSystemClient` + `SecureStoreClient` in src/shared/infra/repositories/credential_repository_concrete.ts
- [X] T029 [P] [US1] Implement `ImageProcessorConcrete` (resize to 1600 px long side, JPEG quality 0.85→floor 0.3 loop until base64 ≤ 1 048 576 bytes) via `ImageManipulatorClient` in src/shared/infra/providers/image_processor_concrete.ts
- [X] T030 [P] [US1] Implement `DocumentCaptureConcrete` (wraps `expo-camera` `takePictureAsync({ base64: true })`, strips `data:` prefix; rear camera only, no gallery) in src/shared/infra/providers/document_capture_concrete.ts
- [X] T031 [US1] Implement `YaIDApiConcrete.issueCredential` — 201 success path: compute `authSig` and `bodySig` via `Ed25519Client.sign` (wire `proofType` camelCase `ageOver18` confined here), POST via `HttpClient` with `X-YaID-DID`/`X-YaID-Timestamp`/`X-YaID-Signature` headers + `{ documentImage, proofType, bodySignature }` body, map 201 → `vcResponseToCredential` in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T032 [US1] Implement entry adapter `capture-document.tsx` happy path (steps: explanation + privacy notice [no PIN yet, FR-003] → PIN via D1's PinLock [FR-006] → camera permission request AFTER PIN [FR-008] → live camera with framing overlay [FR-011/013, no gallery FR-012] → review → loading screen with descriptive text [FR-017] → success result screen → navigate home) in src/app/credential/capture-document.tsx
- [X] T033 [US1] Update `index.tsx` — third form "documento sem dados" showing the two answers + confirmation date, no name/photo/number (FR-023); "Verificar meu documento" entry gated on `ICredentialRepository.exists()` (hidden when credential exists, FR-005) in src/app/index.tsx

**Checkpoint**: US1 fully functional — a person can obtain a credential and see the third form. This is the MVP.

---

## Phase 4: User Story 2 — Repetir a foto antes de enviar (Priority: P1)

**Goal**: On the review screen the person can tap "Repetir" to reopen the camera and
re-capture, any number of times, with no penalty; only the last photo is submitted.

**Independent Test**: quickstart.md §2.2 — open camera, capture a deliberately bad photo, tap "Repetir", confirm the camera reopens without consuming any attempt.

### Implementation for User Story 2

- [X] T034 [US2] Implement the review-step interaction in src/app/credential/capture-document.tsx: exactly two actions "Repetir" (discard current photo, reopen camera — no PIN re-check, no attempt consumed, FR-014/015/016) and "Enviar" (submit only the last captured image)

**Checkpoint**: US1 + US2 work — the person can iterate on the photo before committing.

---

## Phase 5: User Story 3 — Comprovação que falha no processamento (Priority: P1)

**Goal**: When YaID cannot process the document (unreadable, unrecognized, server failure,
clock skew, no connection), the app shows a failure result screen that names what happened and
offers "Tentar de novo" — never a partial credential, never silent return.

**Independent Test**: quickstart.md §2.3 — configure `YaIDApiMock` to throw each cause (or send an illegible photo in dev), confirm the failure screen names the problem and "Tentar de novo" restarts without re-asking the PIN.

### Tests for User Story 3 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T035 [P] [US3] Extend tests/shared/infra/providers/yaid_api_concrete.test.ts with response-error mapping: 401 body `"Request expired"` → `cause:'clock_skew'`; 401 other → `'unknown'`; 422 → `'document_unreadable'`; 502 → `'server_unavailable'`; 400 Form-B object error → `'unknown'`; network failure → `'no_connection'`; tolerant `readErrorMessage` handles both string (Form A) and object (Form B)
- [X] T036 [P] [US3] Extend tests/modules/credential/app/issue_credential_usecase.test.ts with FR-026 regression: any `IssuanceApiError` from `IYaIDApi` → `ICredentialRepository.save()` NOT called and no credential persisted

### Implementation for User Story 3

- [X] T037 [US3] Extend `YaIDApiConcrete.issueCredential` with the full response-error branch: tolerant `readErrorMessage`, HTTP-code → `IssuanceApiError` cause mapping, clock-skew detection on `"Request expired"`, network failure → `no_connection` in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T038 [US3] Add the failure result screen + per-cause messages (document unreadable / server unavailable / clock skew "ajuste a data e hora" [FR-028] / no connection [FR-029]) and "Tentar de novo" → restart from explanation **without re-requesting PIN in the same session** (FR-027; in-memory `sessionAuthenticated` flag, non-persistent) in src/app/credential/capture-document.tsx

**Checkpoint**: US1 + US2 + US3 work — every failure is visible and named; no partial credential is ever created.

---

## Phase 6: User Story 4 — Permissão de câmera negada (Priority: P2)

**Goal**: If the person denies camera permission, the app explains why the camera is needed
and offers to open system settings; it never shows the native dialog more than once.

**Independent Test**: quickstart.md §2.4 — deny camera permission, confirm the explanation screen + "Abrir ajustes" appears (not a generic message); grant in settings and return, camera opens.

### Implementation for User Story 4

- [X] T039 [US4] Handle camera-permission denial in src/app/credential/capture-document.tsx: on denial show a permission-explanation screen with "Abrir ajustes" (`Linking.openSettings()`, FR-009); request the native dialog at most once per session (FR-010) — reading permission status via `DocumentCaptureConcrete`/`expo-camera`

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Whole-flow validation of the success-criteria invariants

- [X] T040 Run the full suite: `npm test` (all `tests/**/*.test.ts` green)
- [X] T041 [P] Execute quickstart.md §2.1–§2.5 manual validation on a development build (success, repeat, failure, permission denied, wrong clock)
- [X] T042 [P] Audit vocabulary (SC-010: no "credencial/DID/assinatura/token/nonce/blockchain/VC" in any D2 screen) and confirm `ageOver18:false` renders in a neutral colour, never red (FR-024, SC-008)
- [X] T043 Verify the runtime invariants from quickstart §3: zero photos persisted after any outcome (SC-003), gallery option never appears (SC-007), zero network requests before PIN verification via traffic inspection (SC-006), zero telemetry emitted (FR-030)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational
  - US1 (P1) is the MVP and builds the shared engine (use case, concretes, entry adapter, home)
  - US2, US3, US4 extend US1's `capture-document.tsx`; US3 also extends `yaid_api_concrete.ts`
    and its test — these run after US1, in priority order
- **Polish (Phase 7)**: Depends on all targeted user stories

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational — builds the shared issuance engine
- **User Story 2 (P1)**: Extends US1's `capture-document.tsx` review step — starts after US1
- **User Story 3 (P1)**: Extends US1's `yaid_api_concrete.ts` (+ test) and `capture-document.tsx` — starts after US1
- **User Story 4 (P2)**: Extends US1's `capture-document.tsx` permission handling — starts after US1

### Within Each User Story

- Tests written first and MUST FAIL before implementation (constitution, Principle II)
- Domain/ports before concretes; use case before presenter; logic before entry-adapter screen
- Entry-adapter screens validated on-device via quickstart.md (no Node tests) — project convention

### Parallel Opportunities

- All Foundational tasks marked [P] (T003–T018) run in parallel — different files
- Within US1, the four test files (T020–T023) run in parallel; the concretes (T028–T031,
  where [P]) run in parallel once their ports exist
- US3's two test files (T035, T036) run in parallel
- Polish T041–T042 run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Ports + entity + errors + result + clients, all different files:
Task T003: "Create Credential entity + test"
Task T006: "Define ICredentialRepository"
Task T007: "Define IDocumentCapture"
Task T008: "Define IImageProcessor"
Task T009: "Define IYaIDApi.issueCredential"
Task T011: "Create FileSystemClient"
Task T012: "Create HttpClient (TLS pinning)"
Task T013: "Create ImageManipulatorClient"
```

## Parallel Example: User Story 1 Tests

```bash
# All four US1 test files, written first, in parallel:
Task T020: "IssueCredentialUseCase test"
Task T021: "IssueCredentialViewModel test"
Task T022: "IssueCredentialController test"
Task T023: "YaIDApiConcrete fixed-vector test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (CRITICAL, blocks everything)
2. Phase 3 US1 → **STOP and VALIDATE** on device (quickstart §2.1)
3. A person can obtain a credential and see the third form — demo-ready MVP

### Incremental Delivery

1. Foundational ready
2. US1 → success flow (MVP)
3. US2 → review/repeat safety net
4. US3 → visible, named failures + retry
5. US4 → honest camera-permission recovery

### Parallel Team Strategy

With multiple developers, after Foundational:

- US2, US3, US4 all touch `capture-document.tsx`, so they serialize on that file. To
  parallelize, one developer owns `capture-document.tsx` (US1→US2→US3→US4 screens) while
  another owns the shared infra extensions (US3's `yaid_api_concrete.ts` error mapping).

---

## Notes

- [P] = different files, no dependencies on incomplete tasks
- [Story] label maps each task to a user story for traceability
- Signing uses `Ed25519Client`; no `ISigner` port exists (reconciled with D1 as-built)
- Presenters use `environments.ts` factories; stage-branching stays centralized there
- Photo (`documentImage`) lives only in `capture-document.tsx` component state — never persisted
- Verify each test fails before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
