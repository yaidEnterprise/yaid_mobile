# Tasks: D1 — Identidade e Acesso

**Input**: Design documents from `/specs/001-identidade-acesso/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: MANDATORY. The project constitution (Principle II) makes TDD non-negotiable — every
task's test is written first and must fail before implementation begins. Test tasks are never
omitted from this file.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

This project follows the YaID Wallet structure per plan.md:

- `src/app/` — entry adapters (Expo Router screens)
- `src/modules/{module}/app/` — presenter · controller · use case · viewmodel
- `src/shared/` — domain · infra · result · clients · environments.ts
- `tests/` — mirrors `src/` 1:1

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure tooling before any code is written

- [ ] T001 Install `@noble/ed25519` and `expo-secure-store`; verify both appear in package.json dependencies
- [ ] T002 Add `tsx` as a dev dependency; configure `test` script in package.json (`npx tsx --test`)
- [ ] T003 [P] Configure TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`) in tsconfig.json

---

## Phase 2: Foundational (Shared Domain & Infrastructure)

**Purpose**: All interfaces, entities, domain errors, fakes, and their contract tests — blocking
prerequisites for every user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Domain Primitives

- [ ] T004 Create `Stage` enum (`test | dev | homol | prod`) in src/shared/domain/enums/stage.ts
- [ ] T005 Implement `environments.ts` reading `EXPO_PUBLIC_STAGE`, validating and resolving `Stage` in src/shared/environments.ts
- [ ] T006 [P] Create `Identity` entity (`seed: Uint8Array`, `publicKey: Uint8Array`, `did: string`) with invariant test in src/shared/domain/entities/identity.ts + tests/shared/domain/entities/identity.test.ts
- [ ] T007 [P] Create identity domain errors (`IdentityAlreadyExistsError`, `IdentityCreationFailedError`) in src/shared/domain/errors/identity_errors.ts
- [ ] T008 [P] Create PIN domain errors (`PinNotInitializedError`, `PinWrongError`, `PinBackoffActiveError`, `PinObviousError`, `PinMismatchError`) in src/shared/domain/errors/pin_errors.ts

### Port Interfaces

- [ ] T009 [P] Define `IIdentityRepository` (`save` / `load` / `exists` / `clear`) in src/shared/domain/interfaces/repositories/identity_repository.ts
- [ ] T010 [P] Define `ISigner` (`getPublicKey` / `sign`) in src/shared/domain/interfaces/providers/signer.ts
- [ ] T011 [P] Define `IRandomness` (`getBytes`) in src/shared/domain/interfaces/providers/randomness.ts
- [ ] T012 [P] Define `IClock` (`nowMs` / `nowSeconds`) in src/shared/domain/interfaces/providers/clock.ts
- [ ] T013 [P] Define `IPinLock` + `PinStatus` (`initialize` / `verify` / `getStatus`) in src/shared/domain/interfaces/providers/pin_lock.ts

### Infrastructure Utilities

- [ ] T014 Create `SecureStoreClient` (thin wrapper over `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) in src/shared/clients/secure_store_client.ts
- [ ] T015 [P] Create result types in src/shared/result/create_identity_result.ts and src/shared/result/define_pin_result.ts

### Mock Implementations + Contract Tests (TDD)

> **NOTE: Write each test FIRST, confirm it FAILS, then implement the mock**

- [ ] T016 [P] Write `IdentityRepositoryMock` contract test (save→load returns same entity; load-when-empty→null; exists/clear invariants; second-save-wins); implement mock in src/shared/infra/repositories/mock/identity_repository_mock.ts + tests/shared/infra/providers/mock/identity_repository_mock.test.ts
- [ ] T017 [P] Write `SignerMock` contract test (fixed 32-byte seed produces deterministic publicKey and signature); implement mock in src/shared/infra/providers/mock/signer_mock.ts + tests/shared/infra/providers/mock/signer_mock.test.ts
- [ ] T018 [P] Write `RandomnessMock` contract test (returns fixed deterministic byte sequence for any n); implement mock in src/shared/infra/providers/mock/randomness_mock.ts + tests/shared/infra/providers/mock/randomness_mock.test.ts
- [ ] T019 [P] Write `ClockMock` contract test (`nowMs` returns set value; `advance(ms)` increments by delta); implement mock with `advance(ms: number)` in src/shared/infra/providers/mock/clock_mock.ts + tests/shared/infra/providers/mock/clock_mock.test.ts
- [ ] T020 [P] Write `PinLockMock` contract test covering all scenarios: `initialize→verify(correct)→success`; `verify(wrong)×4→PinWrongError{attemptsRemaining:1}`; `verify(wrong)` 5th→`PinBackoffActiveError{lockedUntilMs}`; `verify` during lockout→`PinBackoffActiveError`; `ClockMock.advance(60_001)→verify(correct)→success`; 2nd lockout duration > 1st (escalation); **regression**: `IdentityRepositoryMock.exists()` returns `true` before and after any number of PIN errors; implement mock in src/shared/infra/providers/mock/pin_lock_mock.ts + tests/shared/infra/providers/mock/pin_lock_mock.test.ts

**Checkpoint**: Foundational phase complete — all mock contract tests pass; user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Primeiro uso: identidade criada (Priority: P1) 🎯 MVP

**Goal**: Person installs app, sees welcome screen, defines 6-digit PIN, identity is created on-device
without any network request; home screen shows identity-no-credential state.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/access/app/*.test.ts' 'tests/modules/identity/app/*.test.ts'`; then follow quickstart.md §2.1–§2.4 on device in airplane mode.

### Tests for User Story 1 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US1] Write failing `DefinePinUseCase` test: `pin=confirm,non-obvious→initialize() called`; `pin≠confirm→PinMismatchError`; `111111→PinObviousError`; `123456→PinObviousError`; `987654→PinObviousError`; `112233→accepted` in tests/modules/access/app/define_pin_usecase.test.ts
- [ ] T022 [P] [US1] Write failing `DefinePinViewModel` test in tests/modules/access/app/define_pin_viewmodel.test.ts
- [ ] T023 [P] [US1] Write failing `DefinePinController` test (valid input→success result; each error input→correct error result) in tests/modules/access/app/define_pin_controller.test.ts
- [ ] T024 [P] [US1] Write failing `CreateIdentityUseCase` test: **fixed-vector** (32-byte zero seed→expected publicKey→expected DID `did:yaid:user:<hex64>`); identity-already-exists guard; save-failure→`IdentityCreationFailedError` in tests/modules/identity/app/create_identity_usecase.test.ts
- [ ] T025 [P] [US1] Write failing `CreateIdentityViewModel` test: output contains only `{ did: string }`; `seed` and `publicKey` fields are ABSENT from output in tests/modules/identity/app/create_identity_viewmodel.test.ts
- [ ] T026 [P] [US1] Write failing `CreateIdentityController` test (success path; error propagation) in tests/modules/identity/app/create_identity_controller.test.ts

### Implementation for User Story 1

- [ ] T027 [US1] Implement `DefinePinUseCase` (reject pin≠confirm→`PinMismatchError`; reject all-same digits→`PinObviousError`; reject strictly ascending consecutive sequence→`PinObviousError`; reject strictly descending consecutive sequence→`PinObviousError`; call `IPinLock.initialize(pin)` on success) in src/modules/access/app/define_pin_usecase.ts
- [ ] T028 [P] [US1] Implement `DefinePinViewModel` in src/modules/access/app/define_pin_viewmodel.ts
- [ ] T029 [US1] Implement `DefinePinController` in src/modules/access/app/define_pin_controller.ts
- [ ] T030 [US1] Implement `DefinePinPresenter` (composition root: resolves `PinLockMock` + `ClockMock` for `Stage.Test`; `PinLockConcrete` + `ClockConcrete` for all other stages) in src/modules/access/app/define_pin_presenter.ts
- [ ] T031 [US1] Implement `CreateIdentityUseCase` (call `IIdentityRepository.clear()` first; generate seed via `IRandomness.getBytes(32)`; derive publicKey via `ISigner.getPublicKey(seed)`; build DID as `did:yaid:user:` + `toHexLower(publicKey)`; save via `IIdentityRepository.save({seed, publicKey, did})`) in src/modules/identity/app/create_identity_usecase.ts
- [ ] T032 [P] [US1] Implement `CreateIdentityViewModel` (receives full `Identity`; returns only `{ did: string }` — `seed` and `publicKey` stripped before output reaches entry adapter) in src/modules/identity/app/create_identity_viewmodel.ts
- [ ] T033 [US1] Implement `CreateIdentityController` in src/modules/identity/app/create_identity_controller.ts
- [ ] T034 [US1] Implement `CreateIdentityPresenter` (composition root: resolves `IdentityRepositoryMock` + `RandomnessMock` + `SignerMock` for `Stage.Test`; concretes for all other stages) in src/modules/identity/app/create_identity_presenter.ts
- [ ] T035 [P] [US1] Implement `IdentityRepositoryConcrete` (stores only seed as base64url at `yaid.identity.seed`; derives publicKey and DID on load via `ISigner.getPublicKey`; `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) in src/shared/infra/repositories/identity_repository_concrete.ts
- [ ] T036 [P] [US1] Implement `SignerConcrete` (wraps `@noble/ed25519`: synchronous `getPublicKeySync(seed)` + async `sign(payload, seed)`) in src/shared/infra/providers/signer_concrete.ts
- [ ] T037 [P] [US1] Implement `RandomnessConcrete` (returns `crypto.getRandomValues(new Uint8Array(n))`) in src/shared/infra/providers/randomness_concrete.ts
- [ ] T038 [P] [US1] Implement `ClockConcrete` (`nowMs: () => Date.now()`; `nowSeconds: () => Math.floor(Date.now() / 1000)`) in src/shared/infra/providers/clock_concrete.ts
- [ ] T039 [US1] Implement `PinLockConcrete` (initialize: store PIN at `yaid.pin.value`, write clean state `{attemptCount:0, lockoutCount:0, lockedUntilMs:null}` to `yaid.pin.state`; verify: load PIN + state, check lockout via `IClock.nowMs()`, increment `attemptCount` on wrong, trigger lockout at 5th failure using schedule `[60_000, 300_000, 900_000, 3_600_000]`, reset `attemptCount` to 0 on success; `IClock` injected at construction) in src/shared/infra/providers/pin_lock_concrete.ts
- [ ] T040 [US1] Implement `_layout.tsx` (Expo Router root layout; declares light theme; no state, no business logic) in src/app/_layout.tsx
- [ ] T041 [US1] Implement `define-pin.tsx` (two-step: enter 6 digits → confirm 6 digits; numeric keypad; hidden digits; on mismatch: neutral message + allow retry without clearing step 1; on obvious PIN: message explaining reason + allow retry; no attempt limit on creation) in src/app/onboarding/define-pin.tsx
- [ ] T042 [US1] Implement `create-identity.tsx` (calls `CreateIdentityController.execute({})` on mount; navigates to `index.tsx` synchronously on success — no loading indicator; shows actionable error screen on `IdentityCreationFailedError` naming cause and next action; never leaves person in ambiguous state) in src/app/onboarding/create-identity.tsx
- [ ] T043 [US1] Implement `index.tsx` (checks `IIdentityRepository.exists()` on mount; no-identity state: two-sentence YaID explanation + single "Começar" button; identity-no-credential state: device-binding warning per FR-008 + "Verificar documento" button; no PIN required; no sensitive data visible) in src/app/index.tsx

**Checkpoint**: User Story 1 complete — first-use flow works end-to-end without network; identity persists across restarts; all automated tests pass; manually verified per quickstart.md §2.1–§2.4

---

## Phase 4: User Story 2 — Verificação de senha e bloqueio (Priority: P1)

**Goal**: Reusable PIN verification screen delivered as a callable capability; full lockout policy
enforced and persisting across app restarts; D2, D3, D4 can invoke it to gate sensitive operations.

**Independent Test**: Navigate directly to verify-pin screen; exercise three outcomes — correct PIN
resolves, wrong PIN shows attempts remaining, 5th wrong triggers lockout with countdown; close and
reopen app during lockout and confirm lockout persists.

### Tests for User Story 2 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T044 [P] [US2] Write failing `VerifyPinUseCase` test: correct PIN→resolves; wrong PIN→`PinWrongError{attemptsRemaining}`; active lockout→`PinBackoffActiveError{lockedUntilMs}`; desist (no PIN submitted)→returns cancelled without consuming an attempt in tests/modules/access/app/verify_pin_usecase.test.ts
- [ ] T045 [P] [US2] Write failing `VerifyPinViewModel` test: maps `PinWrongError` to `{ attemptsRemaining: number }`; maps `PinBackoffActiveError` to `{ remainingMs: number }` (derived as `lockedUntilMs - clock.nowMs()`) in tests/modules/access/app/verify_pin_viewmodel.test.ts
- [ ] T046 [P] [US2] Write failing `VerifyPinController` test (each outcome: success, wrong, locked, desist) in tests/modules/access/app/verify_pin_controller.test.ts
- [ ] T047 [P] [US2] Add regression test to pin_lock_mock.test.ts: trigger lockout; serialize state to JSON; reconstruct mock from that JSON (simulated restart); confirm `getStatus()` returns the same locked state in tests/shared/infra/providers/mock/pin_lock_mock.test.ts

### Implementation for User Story 2

- [ ] T048 [US2] Implement `VerifyPinUseCase` (calls `IPinLock.getStatus()` to check lock state before attempting; calls `IPinLock.verify(pin)` when unlocked; surfaces `PinWrongError` and `PinBackoffActiveError`; desist path returns cancelled result without calling `verify`) in src/modules/access/app/verify_pin_usecase.ts
- [ ] T049 [P] [US2] Implement `VerifyPinViewModel` (maps `PinWrongError` → `{ attemptsRemaining }`; maps `PinBackoffActiveError` → `{ remainingMs: lockedUntilMs - clock.nowMs() }`) in src/modules/access/app/verify_pin_viewmodel.ts
- [ ] T050 [US2] Implement `VerifyPinController` in src/modules/access/app/verify_pin_controller.ts
- [ ] T051 [US2] Implement `VerifyPinPresenter` (composition root: injects `PinLockMock` + `ClockMock` for `Stage.Test`; `PinLockConcrete` + `ClockConcrete` for all other stages) in src/modules/access/app/verify_pin_presenter.ts
- [ ] T052 [US2] Implement `verify-pin.tsx` (6-digit numeric keypad with hidden digits; on `PinWrongError`: show "X tentativas restantes" and allow retry; on `PinBackoffActiveError`: show "bloqueado por Y minutos" with input disabled; desist action exits without consuming an attempt; no back gesture; no "cancelar" text) in src/app/verify-pin.tsx

**Checkpoint**: User Story 2 complete — verify-pin screen callable; lockout policy enforced and persistent; D2/D3/D4 can now navigate to this screen as their PIN gate

---

## Phase 5: User Story 3 — Abrir sem atrito (Priority: P2)

**Goal**: Home screen accessible without PIN in both states; correct information shown; no sensitive
data visible.

**Independent Test**: Open app in each state (no-identity; identity-no-credential); confirm no PIN
is requested; identify next action in under 10 seconds without help.

Note: The home screen is implemented in Phase 3 (T043). This phase finalizes and audits it.

- [ ] T053 [P] [US3] Review and finalize src/app/index.tsx: confirm device-binding warning (FR-008) appears exactly once in identity-no-credential state; confirm no sensitive data is visible (FR-030); confirm term "cancelar" is absent (FR-032)
- [ ] T054 [P] [US3] Audit all user-facing strings in src/app/ and src/modules/: every error message names cause + next action (FR-033); no technical vocabulary in any string (constitution §VI + FR-032)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality verification across all delivered layers

- [ ] T055 [P] Verify no `expo-*` import exists outside `src/shared/clients/` across all of `src/modules/` and `src/shared/domain/` (constitution Principle I — Iron Rule)
- [ ] T056 [P] Verify `seed` field does not appear in any result type, viewmodel output, or entry adapter prop in `src/shared/result/`, `src/modules/*/app/*_viewmodel.ts`, and `src/app/` (constitution Principle V — seed barrier)
- [ ] T057 [P] Verify WCAG 2.1 AA on PIN entry screens: contrast ratios ≥ 4.5:1, tap areas ≥ 44×44pt, correct screen-reader ordering in src/app/onboarding/define-pin.tsx and src/app/verify-pin.tsx
- [ ] T058 Run full test suite with `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/**/*.test.ts'`; confirm all 58 test scenarios pass with zero skipped assertions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Requires Phase 2; no dependency on US2 or US3
- **US2 (Phase 4)**: Requires Phase 2 + Phase 3 complete (`PinLockConcrete` is wired in US1's Presenter)
- **US3 (Phase 5)**: Requires Phase 3 complete; finalizes home screen from Phase 3
- **Polish (Phase 6)**: Requires all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Requires Foundational only — full first-use flow, home screen, all concretes
- **US2 (P1)**: Requires Foundational + US1 — adds verify-pin screen and regression test coverage
- **US3 (P2)**: Requires US1 — audit and finalize what Phase 3 delivered

### Within Each User Story

- Tests MUST be written and MUST FAIL before implementation (constitution Principle II)
- Interfaces before use cases; use cases before controllers; controllers before presenters; presenters before entry adapters
- Fakes available (from Phase 2) before any use case is written

### Parallel Opportunities

- All Phase 2 interface definitions (T009–T013) can run in parallel
- All Phase 2 mock + contract test pairs (T016–T020) can run in parallel
- All Phase 3 test-writing tasks (T021–T026) can run in parallel
- All Phase 3 concrete infra tasks (T035–T038) can run in parallel once Phase 2 is done
- All Phase 4 test-writing tasks (T044–T047) can run in parallel
- US1 and US2 cannot run in parallel (US2 depends on PinLockConcrete from US1)

---

## Parallel Example: User Story 1

```bash
# 1. Write all US1 tests in parallel (all different files):
Task T021: tests/modules/access/app/define_pin_usecase.test.ts
Task T022: tests/modules/access/app/define_pin_viewmodel.test.ts
Task T023: tests/modules/access/app/define_pin_controller.test.ts
Task T024: tests/modules/identity/app/create_identity_usecase.test.ts
Task T025: tests/modules/identity/app/create_identity_viewmodel.test.ts
Task T026: tests/modules/identity/app/create_identity_controller.test.ts

# 2. After tests fail (confirmed), build concrete infra in parallel:
Task T035: src/shared/infra/repositories/identity_repository_concrete.ts
Task T036: src/shared/infra/providers/signer_concrete.ts
Task T037: src/shared/infra/providers/randomness_concrete.ts
Task T038: src/shared/infra/providers/clock_concrete.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run all tests; follow quickstart.md §2.1–§2.4 on device in airplane mode
5. US1 alone is demonstrable: "identity without registration, zero network" proven

### Incremental Delivery

1. Setup + Foundational → all interfaces, entities, and mocks ready
2. US1 → full first-use flow, on-device identity, home screen — demonstrable MVP
3. US2 → PIN verification screen + lockout — D1 fully complete; D2/D3/D4 can now be built
4. US3 + Polish → audit and harden — production-ready D1

---

## Notes

- `[P]` = different files, no in-phase dependencies — safe to run in parallel
- `[US1]` / `[US2]` / `[US3]` maps each task to the spec user story for traceability
- TDD is non-negotiable per constitution Principle II — every implementation task has a preceding test task
- The fixed-vector test in T024 guards against silent cryptographic regression (the test knows the exact DID expected from a known seed)
- `seed` must never reach the entry adapter — enforced by `CreateIdentityViewModel` (T032) and audited in T056
- Manual validation per quickstart.md §2.1–§2.5 supplements automated tests for entry adapter behavior; it is not replaceable by unit tests
- The verify-pin screen (T052) is a D1 deliverable consumed by D2/D3/D4 — its contract is: callable by navigation, returns confirmed or cancelled, knows nothing about the calling operation
