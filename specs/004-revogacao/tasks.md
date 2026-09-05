# Tasks: D4 — Revogação de Credencial

**Input**: Design documents from `/specs/004-revogacao/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Depends on**: D1 (identity, PIN, `IIdentityRepository`, `IPinLock`, `IClock`, `Ed25519Client`,
`environments.ts` factories) and D2 (`Credential`, `ProofType`, `ICredentialRepository`,
`IYaIDApi`, `YaIDApiConcrete`, `YaIDApiMock`, the `credential` module, `createCredentialRepository`,
`createYaIDApi`) — both MUST be in place before D4 user stories begin.

**Tests**: MANDATORY for logic layers (use case, controller, viewmodel, fakes, concrete
signing/response-mapping) — written first, must fail before implementation (constitution,
Principle II; quickstart.md §1). React Native entry-adapter screens (`src/app/credential/revoke.tsx`)
are validated via quickstart.md on-device (project convention, per D1/D2/D3).

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every description

## Path Conventions

This project follows the YaID Wallet structure per plan.md:

- `src/app/` — entry adapters (Expo Router screens)
- `src/modules/{module}/app/` — presenter · controller · use case · viewmodel
- `src/shared/` — domain · infra · result · clients · environments.ts
- `tests/` — mirrors `src/` 1:1

**Architecture notes (reconciled with D1/D2 as-built)**:

- There is **no `ISigner` port**. The DID-auth signature and the body signature use `Ed25519Client`
  (`src/shared/clients/ed25519_client.ts`) — `Ed25519Client.sign(payload, seed)` — computed
  **inside `YaIDApiConcrete.revokeCredential`**, never in the use case. Where contracts/use-case.md
  and research.md §6 say "`ISigner.sign`", read "`Ed25519Client.sign`".
- Stage-branching is centralized in `environments.ts` factories; presenters call `createX()`
  factories and never branch on `Stage`. `createIdentityRepository`, `createPinLock`, `createClock`
  exist from D1; `createCredentialRepository` and `createYaIDApi` come from D2 — **D4 adds no new
  factories**. (The inline `stage === 'test' ? new XMock()` presenter in contracts/use-case.md is
  stale — use factories.)
- **Real infra paths** (correcting `src/shared/infra/mock/...` used in the D4 contracts):
  mock repo → `src/shared/infra/repositories/mock/credential_repository_mock.ts`;
  mock api → `src/shared/infra/providers/mock/yaid_api_mock.ts`;
  concrete → `src/shared/infra/providers/yaid_api_concrete.ts`.
- **Absent-credential** is handled via D2's repository convention (as-built D1 uses
  `load(): Promise<T | null>` + `exists()`); D4 maps "no credential" to
  `RevokeCredentialFailure { kind: 'no_credential' }`, robust to whether D2 returns `null` or throws
  `CredentialNotFoundError`.
- **PIN errors are reused as-is** from `src/shared/domain/errors/pin_errors.ts` —
  `PinWrongError(attemptsRemaining)` and `PinBackoffActiveError(lockedUntilMs)` already exist. D4
  adds no PIN work and does not redefine them.
- **`delete()`** is the D4 credential-removal method name (per contracts/port-additions.md). If D2
  named its removal method differently (e.g. `clear()`, matching `IIdentityRepository.clear()`),
  align D4 to D2's actual name.

---

## Phase 1: Setup

**Purpose**: Confirm prerequisites and the in-app entry point before any code depends on it

- [X] T001 Verify D1 + D2 are in place (`IIdentityRepository`, `IPinLock`, `IClock`, `Ed25519Client`, `Credential`, `ProofType`, `ICredentialRepository`, `IYaIDApi`, `YaIDApiConcrete`, `YaIDApiMock`, `createCredentialRepository`, `createYaIDApi`) and add the in-app "Revogar" navigation affordance that routes to `src/app/credential/revoke.tsx` (reached from within the app, not a deep link) in the credential/home screen that owns the revoke entry point

---

## Phase 2: Foundational (Shared Domain, Ports, Result & Fakes)

**Purpose**: The new domain error, the two port-method additions, the result union, and the two
extended fakes with their contract tests — blocking prerequisites for every user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Domain Error

- [X] T002 [P] Create `RevocationApiError extends Error` (`kind = 'revocation_api_error'`, `isClockSkew: boolean`, `isNetworkError: boolean`) — thrown by `IYaIDApi.revokeCredential()` on any non-`{ revoked: true }` response, tolerating MOBILE-API-CONTRACT §7 error Form A/B in src/shared/domain/errors/revocation_errors.ts

### Port Extensions

- [X] T003 [P] Extend `ICredentialRepository` with `delete(): Promise<void>` — idempotent (must NOT throw when no credential exists); after `delete()` the absent-credential convention holds (`load()` → null / `exists()` → false) in src/shared/domain/interfaces/repositories/credential_repository.ts
- [X] T004 [P] Extend `IYaIDApi` with `revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }>` (throws `RevocationApiError`) plus the param interface `RevokeCredentialParams { did: string; seed: Uint8Array; vcId: string; clock: IClock }` in src/shared/domain/interfaces/providers/yaid_api.ts

### Result Type

- [X] T005 [P] Create `RevokeCredentialResult = RevokeCredentialSuccess | RevokeCredentialFailure` — `RevokeCredentialSuccess { ok: true; vm: RevokeCredentialViewModel }`; `RevokeCredentialFailure { ok: false; kind: RevokeCredentialFailureKind; message: string; lockedUntilMs?: number; attemptsRemaining?: number }`; `RevokeCredentialFailureKind = 'pin_wrong' | 'pin_backoff' | 'no_credential' | 'clock_skew' | 'network_error' | 'api_error'` in src/shared/result/revoke_credential_result.ts

### Fake Extensions + Contract Tests (TDD)

> **NOTE: Write each contract test FIRST, confirm it FAILS, then extend the fake**

- [X] T006 [P] Write `CredentialRepositoryMock.delete()` contract test — (1) `delete()` after `save()` → subsequent `load()` returns null / `exists()` false, (2) `delete()` on empty repo resolves without throwing, (3) `delete()` twice resolves on the second call — then implement `delete()` (`this.credential = null`) in src/shared/infra/repositories/mock/credential_repository_mock.ts + tests/shared/infra/repositories/mock/credential_repository_mock.test.ts
- [X] T007 [P] Write `YaIDApiMock.revokeCredential` contract test — (1) default `{ revoked: true }` returned, (2) scripted `RevocationApiError` thrown as-is, (3) `lastRevokeParams.vcId`/`.did` accessible after call — then extend the mock with `scriptRevokeCredential(response)` and `revokeCredential(params)` (records `lastRevokeParams`; does NOT validate signatures) in src/shared/infra/providers/mock/yaid_api_mock.ts + tests/shared/infra/providers/mock/yaid_api_mock.test.ts

**Checkpoint**: Foundational phase complete — the error, both port additions, the result union, and
both fake contract tests pass. No new factories were needed (all persistent ports reused from
D1/D2). User story implementation can now begin.

---

## Phase 3: User Story 1 — Revogar a credencial com sucesso (Priority: P1) 🎯 MVP

**Goal**: A person with a valid credential enters the correct PIN, and the app calls
`POST /api/credentials/revoke` (all signing inside `YaIDApiConcrete`), deletes the credential
locally **only** after `{ revoked: true }`, and shows a dedicated result screen confirming the
credential was invalidated, returning to the "no credential" state.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/credential/app/revoke_credential_*.test.ts' 'tests/shared/infra/providers/yaid_api_concrete.test.ts'`; then follow quickstart.md §2.1 on a development build.

### Tests for User Story 1 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Write failing `RevokeCredentialUseCase` test: happy path — `IPinLock.verify()` OK → `IIdentityRepository.load()` → `ICredentialRepository.load()` → `IYaIDApi.revokeCredential({ did, seed, vcId, clock })` returns `{ revoked: true }` → `ICredentialRepository.delete()` called → returns `{ revokedAt: Date, proofType }`; **fixed-vector passthrough**: assert the exact `vcId` and `seed` from the loaded entities are the ones passed to `revokeCredential` (silent-failure guard, research.md §6); **PIN-first regression**: when `PinLockMock` throws `PinWrongError`/`PinBackoffActiveError`, `IYaIDApi.revokeCredential` is NEVER called and `delete()` is NEVER called; **delete-only-on-success regression**: when `revokeCredential` throws `RevocationApiError`, `ICredentialRepository.delete()` is NEVER called (FR-004, FR-005) in tests/modules/credential/app/revoke_credential_usecase.test.ts
- [X] T009 [P] [US1] Write failing `RevokeCredentialViewModel` test: `from(output)` returns only `{ revokedAt: string (formatted), credentialType: string (label) }`; `vcId`, `raw`, `holder`, `seed`, and the raw `proofType` enum value are ABSENT (seed/VC barrier — Gate V) in tests/modules/credential/app/revoke_credential_viewmodel.test.ts
- [X] T010 [P] [US1] Write failing `RevokeCredentialController` test: success → `RevokeCredentialSuccess` with ViewModel; each error mapped — `PinWrongError` → `kind:'pin_wrong'` + `attemptsRemaining`; `PinBackoffActiveError` → `kind:'pin_backoff'` + `lockedUntilMs`; absent credential → `kind:'no_credential'`; `RevocationApiError { isClockSkew:true }` → `kind:'clock_skew'`; `{ isNetworkError:true }` → `kind:'network_error'`; other → `kind:'api_error'` in tests/modules/credential/app/revoke_credential_controller.test.ts
- [X] T011 [P] [US1] Write failing `YaIDApiConcrete.revokeCredential` **fixed-vector** test: known 32-byte seed + known `vcId` + known `clock.nowSeconds()` → `X-YaID-Signature = base64url(Ed25519Client.sign("${ts}:POST:/api/credentials/revoke", seed))` and body `bodySignature = base64url(Ed25519Client.sign(vcId, seed))` (vcId alone, no separator — research.md §6); headers `X-YaID-DID`/`X-YaID-Timestamp`; 200 `{ revoked: true }` → returned; 401 "Request expired" → `RevocationApiError { isClockSkew: true }`; 502 → `RevocationApiError`; network error/timeout → `RevocationApiError { isNetworkError: true }` in tests/shared/infra/providers/yaid_api_concrete.test.ts

### Implementation for User Story 1

- [X] T012 [US1] Implement `RevokeCredentialUseCase` (constructor injects `IIdentityRepository`, `ICredentialRepository`, `IPinLock`, `IClock`, `IYaIDApi`; NO `ISigner`): `execute({ pin })` → `IPinLock.verify(pin)` FIRST; `IIdentityRepository.load()` → `{ seed, publicKey, did }`; `ICredentialRepository.load()` → absent ⇒ throw the no-credential signal (null-check/`CredentialNotFoundError` per D2 convention); `IYaIDApi.revokeCredential({ did, seed, vcId: credential.vcId, clock })`; on `{ revoked: true }` → `ICredentialRepository.delete()` → return `{ revokedAt: new Date(clock.nowMs?.() ?? Date.now()), proofType: credential.proofType }`; errors propagate uncaught to the controller in src/modules/credential/app/revoke_credential_usecase.ts
- [X] T013 [P] [US1] Implement `RevokeCredentialViewModel` with `static from(output)` returning `{ revokedAt: <locale-formatted string>, credentialType: <human label for proofType> }` — strips `vcId`/`raw`/`holder`/`seed` in src/modules/credential/app/revoke_credential_viewmodel.ts
- [X] T014 [US1] Implement `RevokeCredentialController` (maps success → `RevokeCredentialSuccess` via `RevokeCredentialViewModel.from`; maps each thrown error → the correct `RevokeCredentialFailure` kind per T010) in src/modules/credential/app/revoke_credential_controller.ts
- [X] T015 [US1] Implement `RevokeCredentialPresenter` (composition root — pure function resolving `createIdentityRepository()`, `createCredentialRepository()`, `createPinLock(createClock())`, `createClock()`, `createYaIDApi()`; never branches on `Stage`; returns a `RevokeCredentialController`) in src/modules/credential/app/revoke_credential_presenter.ts
- [X] T016 [US1] Implement `YaIDApiConcrete.revokeCredential` via `HttpClient`: `ts = clock.nowSeconds().toString()`; `authSig = Ed25519Client.sign("${ts}:POST:/api/credentials/revoke", seed)`; `bodySig = Ed25519Client.sign(vcId, seed)`; POST `/api/credentials/revoke` with headers `X-YaID-DID`/`X-YaID-Timestamp`/`X-YaID-Signature` and body `{ vcId, bodySignature: base64url(bodySig) }`; 200 → `{ revoked: true }`; 401 "Request expired" → `RevocationApiError { isClockSkew: true }`; other 401/502 → `RevocationApiError`; network error → `RevocationApiError { isNetworkError: true }` in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T017 [US1] Implement `revoke.tsx` happy path — internal step enum (`pin → loading → success`): PIN screen (reuse D1 PIN) → `loading` while `RevokeCredentialController` runs → dedicated "Credencial revogada" **result screen (not a toast — FR-006)** confirming invalidation, then navigate home to the "sem credencial" state (FR-007); success path only in this task (confirmation, errors handled in later stories) in src/app/credential/revoke.tsx

**Checkpoint**: US1 works end-to-end — a person can revoke a valid credential and land on the
dedicated success screen; the credential is deleted only after confirmed `{ revoked: true }`. MVP.

---

## Phase 4: User Story 2 — Confirmação explícita antes da revogação (Priority: P1)

**Goal**: Before revoking, a dedicated confirmation screen states the operation is permanent and
irreversible, with equal-weight "Confirmar revogação" / "Voltar" buttons; the abort path makes no
API call and leaves the credential intact.

**Independent Test**: quickstart.md §2.1 (confirmation appears on the happy path) and §2.2 (abort) on a development build — every path to revocation crosses this screen and "Voltar" ends the flow with zero API calls.

### Implementation for User Story 2

- [X] T018 [US2] Insert the `confirming` step into `revoke.tsx` between `pin` and `loading` (new flow `pin → confirming → loading → success`): dedicated confirmation screen declaring the revocation is **permanent and irreversible** in plain, non-technical language (FR-002); two equal-tap-area buttons — primary "Confirmar revogação" and secondary-but-not-ghost "Voltar" (research.md §5: never "Cancelar"; FR-003); "Confirmar revogação" advances to `loading` (runs the US1 controller); "Voltar" (and back gesture / app-close before confirm) ends the flow with **no `IYaIDApi` call** and the credential intact (SC-003, spec edge cases) in src/app/credential/revoke.tsx

**Checkpoint**: US1 + US2 work — no revocation executes without crossing the irreversibility
confirmation screen, and aborting is cost-free.

---

## Phase 5: User Story 3 — Senha incorreta durante a revogação (Priority: P2)

**Goal**: A wrong PIN blocks the revocation, names the cause, applies progressive backoff, and
never deletes the credential or the identity.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/credential/app/revoke_credential_usecase.test.ts'` (wrong-PIN cases); then quickstart.md §2.3 on device.

### Tests for User Story 3 (MANDATORY) ⚠️

> **NOTE: Extend the test FIRST, ensure the new cases FAIL before implementation**

- [X] T019 [P] [US3] Extend `RevokeCredentialUseCase` test: `PinWrongError(attemptsRemaining)` → propagated, `IIdentityRepository`/`ICredentialRepository` unchanged, `revokeCredential`/`delete` never called; `PinBackoffActiveError(lockedUntilMs)` → propagated, no side effects (FR-009, SC-005 — identity/credential never lost regardless of attempt count) in tests/modules/credential/app/revoke_credential_usecase.test.ts

### Implementation for User Story 3

- [X] T020 [US3] Add the wrong-PIN branch to `revoke.tsx`: on `RevokeCredentialFailure { kind:'pin_wrong' }` show a message naming the cause and the next action with `attemptsRemaining`; on `{ kind:'pin_backoff' }` show the wait guidance using `lockedUntilMs` (progressive backoff via the reused D1 `IPinLock` — FR-012); the credential stays intact and the person can retry in src/app/credential/revoke.tsx

**Checkpoint**: US1–US3 work — a wrong PIN is a named, recoverable failure that never destroys
identity or credential.

---

## Phase 6: User Story 4 — Falha de comunicação durante a revogação (Priority: P2)

**Goal**: A network failure or YaID error during revocation shows a dedicated error screen that
names the cause and states the credential was not changed, with retry from the confirmation step.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/credential/app/revoke_credential_usecase.test.ts' 'tests/modules/credential/app/revoke_credential_controller.test.ts' 'tests/shared/infra/providers/yaid_api_concrete.test.ts'` (RevocationApiError variants); then quickstart.md §2.4 on device.

### Tests for User Story 4 (MANDATORY) ⚠️

> **NOTE: Extend these tests FIRST, ensure the new cases FAIL before implementation**

- [X] T021 [P] [US4] Extend `RevokeCredentialUseCase` test: `revokeCredential` throws `RevocationApiError` (network, clock-skew, api) → error propagates and `ICredentialRepository.delete()` is NEVER called (FR-004/FR-005 regression, reinforcing T008) in tests/modules/credential/app/revoke_credential_usecase.test.ts
- [X] T022 [P] [US4] Extend `YaIDApiConcrete.revokeCredential` test: 401 "Request expired" → `RevocationApiError { isClockSkew: true }`; 502 "Blockchain revocation failed" → `RevocationApiError`; network error/timeout → `RevocationApiError { isNetworkError: true }` (Form A/B error normalization tolerated) in tests/shared/infra/providers/yaid_api_concrete.test.ts

### Implementation for User Story 4

- [X] T023 [US4] Add the `error` step to `revoke.tsx` (`{ cause, retryable }`): on `RevokeCredentialFailure { kind:'network_error' }` → "sem conexão"-style message; `{ kind:'clock_skew' }` → specific "A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo." (research.md §8); `{ kind:'api_error' }` → generic named cause; every message states the **credential was not changed** (FR-008, SC-004) and offers retry that resumes from the `confirming` step in src/app/credential/revoke.tsx

**Checkpoint**: US1–US4 work — every communication failure is a visible, named, retryable screen;
no silent failures.

---

## Phase 7: User Story 5 — Revogação quando não há credencial (Priority: P3)

**Goal**: Without a credential, the revoke option is not actionable — hidden/disabled or a
contextual "sem credencial" message — and the flow never executes in that state.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/credential/app/revoke_credential_controller.test.ts'` (no-credential case); then quickstart.md §2.5 on device with app in "identity created, no credential".

### Tests for User Story 5 (MANDATORY) ⚠️

> **NOTE: Extend the test FIRST, ensure the new case FAILS before implementation**

- [X] T024 [P] [US5] Extend `RevokeCredentialController` test: absent credential (D2 repo returns null / throws `CredentialNotFoundError`) → `RevokeCredentialFailure { kind:'no_credential' }`, no `revokeCredential` call in tests/modules/credential/app/revoke_credential_controller.test.ts

### Implementation for User Story 5

- [X] T025 [US5] Make the revoke entry affordance non-actionable when `ICredentialRepository.exists()` is false — hide/disable it or show "não há credencial a revogar" (FR-011, SC-006) — and guard `revoke.tsx` to render the "sem credencial" state instead of the PIN step if reached without a credential, in the credential/home screen owning the affordance and src/app/credential/revoke.tsx

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Whole-flow validation of the success-criteria invariants

- [X] T026 Run the full suite: `EXPO_PUBLIC_STAGE=test npm test` (all `tests/**/*.test.ts` green)
- [X] T027 [P] Execute quickstart.md §2.1–§2.5 manual validation on a development build (success, abort before confirm, wrong PIN, network failure, no credential)
- [X] T028 [P] Vocabulary audit — no technical terms on any D4 screen and **no "cancelar"** anywhere (research.md §5; constitution Principle VI); confirm the success and every error outcome uses a dedicated screen, never a toast (FR-006)
- [X] T029 Verify runtime invariants (quickstart.md §3): `ICredentialRepository.delete()` fires only after confirmed `{ revoked: true }` (SC-002 — post-revocation authorization reports "no credential"); PIN failure never deletes credential or identity across the full backoff schedule (SC-005); zero telemetry emitted anywhere in D4

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Depends on D1/D2 being in place — start once prerequisites exist
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational
  - US1 (P1) is the MVP and builds the whole engine: use case, viewmodel, controller, presenter,
    the concrete `revokeCredential`, and the `revoke.tsx` happy path
  - US2 (P1) inserts the confirmation step into `revoke.tsx` (shares the US1 use case)
  - US3, US4, US5 extend `revoke_credential_usecase.test.ts` / `revoke_credential_controller.test.ts`
    / `yaid_api_concrete.test.ts` and add branches/screens to `revoke.tsx` — after US1 in priority order
- **Polish (Phase 8)**: Depends on all targeted user stories

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — builds the revocation engine
- **US2 (P1)**: Depends on US1; shares `revoke.tsx` (adds the confirmation step) and the US1 use case
- **US3 (P2)**: Extends the US1 use-case test + `revoke.tsx` (wrong-PIN branch) — after US1
- **US4 (P2)**: Extends the US1 use-case/controller/concrete tests + `revoke.tsx` (error step) — after US1
- **US5 (P3)**: Extends the US1 controller test + the entry affordance/`revoke.tsx` guard — after US1

### Within Each User Story

- Tests written first and MUST FAIL before implementation (constitution, Principle II)
- Domain/ports/result before fakes; fakes before use case; use case → viewmodel → controller →
  presenter; concrete before entry-adapter wiring
- Entry-adapter screens (`src/app/credential/revoke.tsx`) are validated on-device via quickstart.md
  (no Node tests) — project convention

### Parallel Opportunities

- All Foundational tasks marked [P] (T002–T007) run in parallel — different files
- Within US1, the four test files (T008–T011) run in parallel; the ViewModel (T013) is [P]; the use
  case (T012), controller (T014), presenter (T015), and concrete (T016) serialize on their own files
- US3/US4/US5 each extend `revoke.tsx`, so their screen tasks serialize on that file; their use-case
  test extensions (T019, T021) touch the same test file and serialize
- Polish T027–T028 run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Error, two port additions, result union, two fakes — all different files:
Task T002: "RevocationApiError"
Task T003: "extend ICredentialRepository with delete()"
Task T004: "extend IYaIDApi with revokeCredential()"
Task T005: "RevokeCredentialResult union"
Task T006: "extend CredentialRepositoryMock.delete() + contract test"
Task T007: "extend YaIDApiMock.revokeCredential + contract test"
```

## Parallel Example: User Story 1 Tests

```bash
# All four US1 test files, written first, in parallel:
Task T008: "RevokeCredentialUseCase test (fixed-vector + PIN-first + delete-only-on-success)"
Task T009: "RevokeCredentialViewModel test (no seed/vcId/raw leak)"
Task T010: "RevokeCredentialController test (all failure kinds)"
Task T011: "YaIDApiConcrete.revokeCredential fixed-vector signing test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (CRITICAL, blocks everything)
2. Phase 3 US1 → **STOP and VALIDATE** on device (quickstart §2.1)
3. A person with a valid credential can revoke it end-to-end and land on the dedicated success
   screen — demo-ready MVP

### Incremental Delivery

1. Foundational ready
2. US1 → the revocation happy path + dedicated success result (MVP)
3. US2 → the irreversibility confirmation gate (no revocation without it)
4. US3 → wrong-PIN handled as a named, non-destructive failure
5. US4 → communication failures visible, named, retryable
6. US5 → revoke option inert without a credential

### Parallel Team Strategy

With multiple developers, after Foundational: one developer owns `revoke.tsx`
(US1 happy → US2 confirm → US3 wrong-PIN → US4 error → US5 guard, serialized on that file) while
another owns the shared engine (`revoke_credential_usecase.ts`, controller, presenter, viewmodel)
and `yaid_api_concrete.ts` `revokeCredential` (+ tests), which are independent files.

---

## Notes

- [P] = different files, no dependencies on incomplete tasks
- [Story] label maps each task to a user story for traceability
- **Golden rule**: `ICredentialRepository.delete()` runs ONLY after `IYaIDApi.revokeCredential()`
  returns `{ revoked: true }` — the credential is never deleted on any failure (FR-004, FR-005;
  regression-tested in T008 and reinforced in T021)
- `IPinLock.verify()` is the FIRST operation; a wrong PIN never reaches the API and never deletes
  anything (FR-009, SC-005; regression-tested in T008/T019)
- Signing uses `Ed25519Client` inside `YaIDApiConcrete`; no `ISigner` port exists (reconciled with
  D1/D2 as-built)
- Presenters use `environments.ts` factories; stage-branching stays centralized there. D4 adds no
  new persistent ports and no new factories
- The credential has no local "revoked" state — absence is the terminal state; the ViewModel never
  carries `seed`, `vcId`, or `raw` (Gate V)
- Verify each test fails before implementing; commit after each task or logical group
- Stop at any checkpoint to validate a story independently
