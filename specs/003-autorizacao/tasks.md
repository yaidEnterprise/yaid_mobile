# Tasks: D3 — Autorização

**Input**: Design documents from `/specs/003-autorizacao/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Depends on**: D1 (identity, PIN, `IIdentityRepository`, `IPinLock`, `IClock`, `Ed25519Client`)
and D2 (`Credential`, `ProofType`, `ICredentialRepository`, `IYaIDApi`, `YaIDApiConcrete`,
`YaIDApiMock`) — both MUST be in place before D3 user stories begin.

**Tests**: MANDATORY for logic layers (use case, controller, viewmodel, DTO, mapper, fakes,
concrete signing/response-mapping) — written first, must fail before implementation
(constitution, Principle II). React Native entry-adapter screens (`src/app/verify/[session].tsx`)
are validated via quickstart.md on-device (project convention, per D1/D2).

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths are included in every description

## Path Conventions

This project follows the YaID Wallet structure per plan.md:

- `src/app/` — entry adapters (Expo Router screens)
- `src/modules/{module}/app/` — presenter · controller · use case · viewmodel
- `src/shared/` — domain · infra · result · clients · environments.ts
- `tests/` — mirrors `src/` 1:1

**Architecture notes (reconciled with D1/D2 as-built)**:

- There is **no `ISigner` port**. The VP signature and DID-auth signatures use `Ed25519Client`
  (`src/shared/clients/ed25519_client.ts`) — `Ed25519Client.sign(payload, seed)`. Where
  data-model.md §4 and research.md §2/§5 say "`ISigner.sign`", read "`Ed25519Client.sign`".
- Stage-branching is centralized in `environments.ts` factories; presenters call `createX()`
  factories and never branch on `Stage`. `createYaIDApi`, `createIdentityRepository`,
  `createCredentialRepository`, `createPinLock`, `createClock` already exist from D1/D2 — **D3
  adds no new persistent ports and no new factories**.
- `ProofType` is defined in D2 (`src/shared/domain/enums/proof_type.ts`); D3 reuses it.

---

## Phase 1: Setup (Deep-Link Entry)

**Purpose**: Make the app reachable by the request link before any code depends on it

- [X] T001 Configure the `yaid` deep-link scheme, iOS Universal Link (`associatedDomains`) and Android App Link (`intentFilters`) so `yaid://verify?session=<token>` opens the app, and confirm `expo-linking` + Expo Router are installed (Expo Go cannot handle Universal/App Links — development build required, ARCHITECTURE.md T1.1) in app.json / app.config.js

---

## Phase 2: Foundational (Shared Domain, Infra & Fakes)

**Purpose**: Entity, enum, errors, VP types, the 4 new `IYaIDApi` methods, result types, the
base64url codec, the DTO mapper, and the extended `YaIDApiMock` with its contract tests —
blocking prerequisites for every user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Domain Primitives

- [X] T002 [P] Create `ProofSessionStatus` enum (`WaitingUser='waiting_user'`, `Opened='opened'`, `ApprovedByUser='approved_by_user'`, `Expired='expired'`, `Cancelled='cancelled'`) in src/shared/domain/enums/proof_session_status.ts
- [X] T003 [P] Create `ProofSession` entity type (`token: string`, `status: ProofSessionStatus`, `proofType: ProofType`, `companyName: string`, `expiresAt: Date`) — ephemeral, never persisted in src/shared/domain/entities/proof_session.ts
- [X] T004 [P] Create D3 domain errors — `PresentationRejectedError` (`kind='presentation_rejected'`), `SessionExpiredError` (`kind='session_expired'`), `SessionIneligibleError` (`kind='session_ineligible'`), `SessionNotFoundError` (`kind='session_not_found'`), `AuthClockSkewError` (`kind='auth_clock_skew'`) in src/shared/domain/errors/presentation_errors.ts
- [X] T005 [P] Create VP assembly types — `VerifiablePresentation` (`holder`, `challenge`, `verifiableCredential: object[]`, `proof`) and `VPProof` (`type:'Ed25519Signature2020'`, `created`, `verificationMethod`, `proofPurpose:'authentication'`, `signatureValue`) in src/shared/domain/entities/verifiable_presentation.ts

### Port Extension

- [X] T006 [P] Extend `IYaIDApi` with `getProofSession(GetProofSessionParams): Promise<ProofSession>`, `getChallenge(GetChallengeParams): Promise<{ nonce: string }>`, `verifyPresentation(VerifyPresentationParams): Promise<{ verifiedAt: Date }>`, `cancelProofSession(CancelProofSessionParams): Promise<void>` plus the param interfaces — `GetProofSessionParams { sessionToken }` (public, no auth), `GetChallengeParams { did, seed: Uint8Array, sessionToken, clock: IClock }`, `VerifyPresentationParams { did, seed, sessionToken, vp: VerifiablePresentation, clock }`, `CancelProofSessionParams { did, seed, sessionToken, clock }` in src/shared/domain/interfaces/providers/yaid_api.ts

### Result Types

- [X] T007 [P] Create `GetProofSessionResult` — `{ ok: true; session: ProofSession; canDecide: true }` | `{ ok: false; reason: 'needs_identity' \| 'needs_credential'; companyName: string }` | `{ ok: false; error: SessionNotFoundError \| SessionExpiredError \| SessionIneligibleError }` in src/shared/result/get_proof_session_result.ts
- [X] T008 [P] Create `PresentProofResult` — `{ ok: true; verifiedAt: Date }` | `{ ok: false; error: PinWrongError \| PinBackoffActiveError \| PresentationRejectedError \| AuthClockSkewError }` (PIN errors reused from D1) in src/shared/result/present_proof_result.ts
- [X] T009 [P] Create `CancelProofSessionResult` — `{ ok: true }` | `{ ok: false; error: SessionNotFoundError }` in src/shared/result/cancel_proof_session_result.ts

### Shared Codec

- [X] T010 [P] Write failing test (known 64-byte input → known base64url string, no `=` padding) then implement `encodeBase64Url(bytes: Uint8Array): string` in src/shared/clients/base64url.ts + tests/shared/clients/base64url.test.ts

### Wire-Format Mapper (DTO)

- [X] T011 [P] Write failing DTO test (`status` snake_case → `ProofSessionStatus`; `proofType: 'age_over_18'` → `ProofType.AgeOver18` and `'personhood'` → `ProofType.Personhood`; `expiresAt` ISO string → `Date`; `token`/`companyName` passthrough), then implement `proofSessionDtoToEntity(dto)` in src/shared/infra/dto/proof_session_dto.ts + tests/shared/infra/dto/proof_session_dto.test.ts

### Mock Extension + Contract Test (TDD)

> **NOTE: Write the test FIRST, confirm it FAILS, then extend the mock**

- [X] T012 [P] Write `YaIDApiMock` D3 contract test then extend the existing mock with 4 scripted methods — `getProofSession` (default `status: WaitingUser`, `proofType: Personhood`; configurable to any `ProofSessionStatus`; configurable to throw `SessionNotFoundError`; records last params), `getChallenge` (default `{ nonce: 'test-nonce-fixed' }`; configurable to throw `AuthClockSkewError`/`SessionExpiredError`; **records call count** for the never-called-before-decision assertions), `verifyPresentation` (default `{ verifiedAt: new Date(clock.nowMs()) }`; configurable to throw `PresentationRejectedError`/`AuthClockSkewError`; **records last VP** for fixed-vector assertion), `cancelProofSession` (resolves void; configurable to throw; records call count) in src/shared/infra/providers/mock/yaid_api_mock.ts + tests/shared/infra/providers/mock/yaid_api_mock.test.ts

**Checkpoint**: Foundational phase complete — DTO, codec, and mock contract tests pass. No new
factories were needed (all ports reused from D1/D2). User story implementation can now begin.

---

## Phase 3: User Story 1 — Autorizar uma verificação com sucesso (Priority: P1) 🎯 MVP

**Goal**: A person with identity + credential opens the request link, sees the arrival screen
while the session is fetched, then the decision screen (company, natural-language question,
privacy guarantee, two equal buttons). Tapping "Autorizar" demands the PIN, then — and only
then — fetches the irreversible challenge, assembles + signs the VP, submits it, and shows the
dedicated "Verificado" result before returning home.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/proof-session/app/get_proof_session_*.test.ts' 'tests/modules/presentation/app/*.test.ts' 'tests/shared/infra/providers/yaid_api_concrete.test.ts'`; then follow quickstart.md §2.1 on a development build.

### Tests for User Story 1 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Write failing `GetProofSessionUseCase` test: `waiting_user` + identity present + credential present + eligible → `{ ok: true, canDecide: true }` with the `ProofSession`; **assert `IYaIDApi.getChallenge` is NEVER called inside this use case** (eligibility/decision must not consume the session — FR-011, SC-003) in tests/modules/proof-session/app/get_proof_session_usecase.test.ts
- [X] T014 [P] [US1] Write failing `GetProofSessionViewModel` test: output contains only `{ companyName, proofTypeLabel, canDecide }`; `proofTypeLabel` maps `personhood` → "você é uma pessoa real" and `age_over_18` → "você tem mais de 18 anos" (FR-013); `token`/`expiresAt`/`status` ABSENT in tests/modules/proof-session/app/get_proof_session_viewmodel.test.ts
- [X] T015 [P] [US1] Write failing `GetProofSessionController` test (success result; error/reason propagation) in tests/modules/proof-session/app/get_proof_session_controller.test.ts
- [X] T016 [P] [US1] Write failing `PresentProofUseCase` **fixed-vector** test (MANDATORY): known 32-byte seed + known `credential.raw` + known nonce → the submitted VP's `proof.signatureValue` equals a pre-computed base64url of `ed25519.sign(JSON.stringify({holder,challenge,verifiableCredential}))` (KEY ORDER holder→challenge→verifiableCredential, no `proof` in signed string — research.md §2); **`IPinLock.verify()` is the FIRST call** — assert `IYaIDApi.getChallenge` is NOT called when `PinLockMock` throws `PinWrongError`/`PinBackoffActiveError` (FR-027 regression); `getChallenge` throws `AuthClockSkewError` → propagated, `verifyPresentation` not called; `verifyPresentation` returns `{ valid: false }` → `PresentationRejectedError`; success → `{ ok: true, verifiedAt }` in tests/modules/presentation/app/present_proof_usecase.test.ts
- [X] T017 [P] [US1] Write failing `PresentProofViewModel` test: output contains only `{ verifiedAtLabel }` — no `holder`/`challenge`/`seed`/`raw` in tests/modules/presentation/app/present_proof_viewmodel.test.ts
- [X] T018 [P] [US1] Write failing `PresentProofController` test (success result; error propagation for PIN + rejection + clock-skew) in tests/modules/presentation/app/present_proof_controller.test.ts
- [X] T019 [P] [US1] Write failing `YaIDApiConcrete` D3 test (happy paths): `getProofSession` sends NO auth headers, 200 → `proofSessionDtoToEntity`; `getChallenge` fixed-vector auth `authSig = Ed25519Client.sign("${ts}:GET:/api/proof-sessions/${t}/challenge")` base64url with `X-YaID-DID`/`X-YaID-Timestamp`/`X-YaID-Signature`, 200 → `{ nonce }`; `verifyPresentation` auth `"${ts}:POST:/api/presentations/verify"`, body = full VP object (incl. `proof`), 200 `{ valid: true }` → `{ verifiedAt }` in tests/shared/infra/providers/yaid_api_concrete.test.ts

### Implementation for User Story 1

- [X] T020 [US1] Implement `GetProofSessionUseCase` (input `{ sessionToken }`): `IYaIDApi.getProofSession(sessionToken)`; if `status !== WaitingUser` → `SessionExpiredError`; if `IIdentityRepository.load()` is null → `{ ok:false, reason:'needs_identity', companyName }`; if `!ICredentialRepository.exists()` → `{ ok:false, reason:'needs_credential', companyName }`; load credential and check eligibility (`proofType === AgeOver18 && !credential.ageOver18` → `SessionIneligibleError`; `Personhood` always eligible); else `{ ok:true, session, canDecide:true }` — **never calls `getChallenge`** in src/modules/proof-session/app/get_proof_session_usecase.ts
- [X] T021 [P] [US1] Implement `GetProofSessionViewModel` (returns `{ companyName, proofTypeLabel, canDecide }`; maps `proofType` → natural-language question per FR-013) in src/modules/proof-session/app/get_proof_session_viewmodel.ts
- [X] T022 [US1] Implement `GetProofSessionController` in src/modules/proof-session/app/get_proof_session_controller.ts
- [X] T023 [US1] Implement `GetProofSessionPresenter` (composition root — resolves `createYaIDApi`, `createIdentityRepository`, `createCredentialRepository`; never branches on `Stage`) in src/modules/proof-session/app/get_proof_session_presenter.ts
- [X] T024 [US1] Implement `PresentProofUseCase` (input `{ pin, sessionToken }`): `IPinLock.verify(pin)` FIRST; `IIdentityRepository.load()` → `{ seed, did }`; `ICredentialRepository.load()` → `{ raw }`; `IYaIDApi.getChallenge({ did, seed, sessionToken, clock })` → nonce (**IRREVERSIBLE — only here, after PIN**); assemble `vpBody = { holder: did, challenge: nonce, verifiableCredential: [JSON.parse(raw)] }`; `sig = Ed25519Client.sign(new TextEncoder().encode(JSON.stringify(vpBody)), seed)`; build VP with `proof` (`created` = clock ISO, `verificationMethod = \`${did}#key-1\``, `signatureValue = encodeBase64Url(sig)`); `IYaIDApi.verifyPresentation({ did, seed, sessionToken, vp, clock })` → `{ verifiedAt }` in src/modules/presentation/app/present_proof_usecase.ts
- [X] T025 [P] [US1] Implement `PresentProofViewModel` (returns only `{ verifiedAtLabel }`) in src/modules/presentation/app/present_proof_viewmodel.ts
- [X] T026 [US1] Implement `PresentProofController` in src/modules/presentation/app/present_proof_controller.ts
- [X] T027 [US1] Implement `PresentProofPresenter` (composition root — `createPinLock(createClock())`, `createClock`, `createIdentityRepository`, `createCredentialRepository`, `createYaIDApi`; never branches on `Stage`) in src/modules/presentation/app/present_proof_presenter.ts
- [X] T028 [US1] Implement `YaIDApiConcrete.getProofSession` (public GET, no auth headers; 200 → `proofSessionDtoToEntity`; 404/other → `SessionNotFoundError`) via `HttpClient` in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T029 [US1] Implement `YaIDApiConcrete.getChallenge` (DID-auth headers computed via `Ed25519Client.sign` over `"${ts}:GET:/api/proof-sessions/${t}/challenge"`; GET; 200 → `{ nonce }`; 401 "Request expired" → `AuthClockSkewError`; 404/other → `SessionExpiredError`) — **irreversible call** in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T030 [US1] Implement `YaIDApiConcrete.verifyPresentation` (DID-auth headers over `"${ts}:POST:/api/presentations/verify"`; POST full VP body incl. `proof`; 200 `{ valid: true }` → `{ verifiedAt }`; `{ valid: false }` → `PresentationRejectedError`; 401 skew → `AuthClockSkewError`; other → `PresentationRejectedError`) in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T031 [US1] Implement entry adapter `[session].tsx` happy path — internal step enum (`arrival → decision → pin → submitting → result`): arrival screen (the ONLY screen allowed a loading transition, FR-002/FR-004; on no connection show "sem conexão" + "Tentar de novo", FR-036) runs `GetProofSessionController`; decision screen (company as heaviest visual weight FR-012, natural-language question FR-013, privacy guarantee "A empresa recebe apenas sim ou não. Nenhum dado seu é enviado." FR-014, two equal-tap-area buttons "Autorizar"/"Recusar" FR-015, inert ~400 ms FR-016, no animation FR-017, no outside-tap effect FR-018, back gesture disabled FR-019, no countdown FR-020, screen-reader order company→question→buttons FR-021); "Autorizar" → PIN screen (D1) → `submitting` loading with descriptive text (FR-030) → `PresentProofController` → "Verificado" result "Pronto. A empresa recebeu sua resposta." in green (FR-031) → navigate home (third form intact) in src/app/verify/[session].tsx
- [X] T032 [US1] Implement authorize-failure result branches in `[session].tsx`: `PresentationRejectedError`/unknown → dedicated "Falhou" screen "Não foi possível concluir. Comece de novo pelo site da empresa." in red, **terminal — no retry on the same session** (FR-032/FR-033); `AuthClockSkewError` → specific message "A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo." (FR-037); wrong PIN handled by D1's PIN screen with `attemptsRemaining` (no network call fired) in src/app/verify/[session].tsx

**Checkpoint**: US1 fully functional — the happy authorization path works end-to-end and every
failure of it is a dedicated, named result screen. This is the MVP.

---

## Phase 4: User Story 2 — Recusar uma verificação (Priority: P1)

**Goal**: On the decision (or ineligibility) screen the person taps "Recusar"; the session is
cancelled with no confirmation dialog, no justification, and no PIN. The credential stays
intact and the "Recusado" result screen is shown.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/proof-session/app/cancel_proof_session_*.test.ts'`; then quickstart.md §2.2 on device.

### Tests for User Story 2 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T033 [P] [US2] Write failing `CancelProofSessionUseCase` test: `IYaIDApi.cancelProofSession` called exactly once; **`IPinLock.verify()` is NEVER called** (refusal has no PIN cost — FR-023, research.md §6); best-effort — when `cancelProofSession` throws the use case still resolves `{ ok: true }` in tests/modules/proof-session/app/cancel_proof_session_usecase.test.ts
- [X] T034 [P] [US2] Write failing `CancelProofSessionController` test (resolves on success and on best-effort cancel failure) in tests/modules/proof-session/app/cancel_proof_session_controller.test.ts

### Implementation for User Story 2

- [X] T035 [US2] Implement `CancelProofSessionUseCase` (input `{ sessionToken }`): `IIdentityRepository.load()` → `{ seed, did }`; `IYaIDApi.cancelProofSession({ did, seed, sessionToken, clock })`; **no `IPinLock.verify()`**; best-effort → always resolves `{ ok: true }` even if the API throws in src/modules/proof-session/app/cancel_proof_session_usecase.ts
- [X] T036 [P] [US2] Implement `CancelProofSessionViewModel` (empty — navigation to the refusal result is implicit) in src/modules/proof-session/app/cancel_proof_session_viewmodel.ts
- [X] T037 [US2] Implement `CancelProofSessionController` in src/modules/proof-session/app/cancel_proof_session_controller.ts
- [X] T038 [US2] Implement `CancelProofSessionPresenter` (`createClock`, `createIdentityRepository`, `createYaIDApi`) in src/modules/proof-session/app/cancel_proof_session_presenter.ts
- [X] T039 [US2] Implement `YaIDApiConcrete.cancelProofSession` (DID-auth headers over `"${ts}:POST:/api/proof-sessions/${t}/cancel"`; POST empty body; 200/404/other → resolve void, best-effort — cancel failure never shows an error) in src/shared/infra/providers/yaid_api_concrete.ts
- [X] T040 [US2] Wire "Recusar" in `[session].tsx` → `CancelProofSessionController` (NO confirmation dialog, NO justification — FR-023) → dedicated "Recusado" result "Você recusou. Nada foi enviado." in grey (FR-024) → navigate home; credential untouched (FR-025) in src/app/verify/[session].tsx

**Checkpoint**: US1 + US2 work — authorize and refuse are both real, symmetric choices.

---

## Phase 5: User Story 3 — Credencial inelegível para a pergunta (Priority: P1)

**Goal**: When the credential cannot answer the question (`age_over_18` requested but
`ageOver18: false`), the app detects it locally before the decision screen and before any
challenge call, showing a dedicated ineligibility screen offering only "Recusar".

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/proof-session/app/get_proof_session_usecase.test.ts'` (ineligibility cases); then quickstart.md §2.3 on device with an `ageOver18:false` credential + `age_over_18` session.

### Tests for User Story 3 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T041 [P] [US3] Extend `GetProofSessionUseCase` test: `proofType: age_over_18` + `credential.ageOver18 === false` → `SessionIneligibleError`; **assert `IYaIDApi.getChallenge` is NEVER called** (session not consumed — FR-011, SC-003) in tests/modules/proof-session/app/get_proof_session_usecase.test.ts

### Implementation for User Story 3

- [X] T042 [US3] Add the ineligibility screen to `[session].tsx` (rendered when `GetProofSessionResult` errors with `SessionIneligibleError`): company name + the question that was asked + explanation "A [empresa] quer confirmar que você tem mais de 18 anos. Sua verificação YaID indica que não. Você pode recusar este pedido." (FR-010) with a single "Recusar" action routing to the US2 cancel flow; the decision screen is never shown and no challenge is ever called in src/app/verify/[session].tsx

**Checkpoint**: US1 + US2 + US3 work — an unanswerable request is caught locally, explained, and
never burns the session.

---

## Phase 6: User Story 4 — Link expirado ou já utilizado (Priority: P2)

**Goal**: Opening a link whose session is expired, already `opened`, approved, or cancelled
shows the dedicated "Expirado" result with guidance to request a new link — never a loop, never
an attempt to proceed.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/proof-session/app/get_proof_session_usecase.test.ts' 'tests/shared/infra/providers/yaid_api_concrete.test.ts'` (terminal-state cases); then quickstart.md §2.4 on device.

### Tests for User Story 4 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T043 [P] [US4] Extend `GetProofSessionUseCase` test: `status` in `{ opened, expired, approved_by_user, cancelled }` → `SessionExpiredError` (FR-006); `getChallenge` never called in tests/modules/proof-session/app/get_proof_session_usecase.test.ts
- [X] T044 [P] [US4] Extend `YaIDApiConcrete` test: `getProofSession` 404 → `SessionNotFoundError`; `getChallenge` 404/5xx → `SessionExpiredError` (session irrecoverable) in tests/shared/infra/providers/yaid_api_concrete.test.ts

### Implementation for User Story 4

- [X] T045 [US4] Add the "Expirado" result screen to `[session].tsx` (rendered for `SessionExpiredError` and `SessionNotFoundError`): "Este pedido expirou. Peça um novo à empresa." in amber (FR-006), with exit to home in src/app/verify/[session].tsx

**Checkpoint**: US1–US4 work — the most common non-happy path is handled cleanly.

---

## Phase 7: User Story 5 — Chegada sem identidade ou sem credencial (Priority: P2)

**Goal**: Opening a link without an identity or without a credential shows who is asking and
explains the required prior step, guiding the person back to the company site afterwards.

**Independent Test**: `EXPO_PUBLIC_STAGE=test npx tsx --test 'tests/modules/proof-session/app/get_proof_session_usecase.test.ts'` (needs_identity / needs_credential cases); then quickstart.md on a fresh install.

### Tests for User Story 5 (MANDATORY) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T046 [P] [US5] Extend `GetProofSessionUseCase` test: identity absent (`IIdentityRepository.load()` → null) → `{ ok:false, reason:'needs_identity', companyName }` (FR-007); credential absent (`ICredentialRepository.exists()` → false) → `{ ok:false, reason:'needs_credential', companyName }` (FR-008); `getChallenge` never called in either case in tests/modules/proof-session/app/get_proof_session_usecase.test.ts

### Implementation for User Story 5

- [X] T047 [US5] Add the two orientation screens to `[session].tsx`: `needs_identity` → company name + "conclua o primeiro uso antes" (FR-007); `needs_credential` → company name + "verifique o documento antes" (FR-008); both guide the person back to the company site and the request link is NOT preserved (US5 AC3) in src/app/verify/[session].tsx

**Checkpoint**: US1–US5 work — the app welcomes people who arrive out of order without locking up.

---

## Phase 8: User Story 6 — Aplicativo volta do segundo plano na tela de decisão (Priority: P2)

**Goal**: Returning from background while the decision screen is active re-validates the session
before re-enabling the buttons; a session that expired in the background lands on "Expirado".

**Independent Test**: quickstart.md §2.6 on device — open the decision screen, background the app past expiry, return, confirm the automatic re-fetch and the "Expirado" screen. (Session re-validation logic is already covered by the `GetProofSessionUseCase` terminal-state tests from T043.)

### Implementation for User Story 6

- [X] T048 [US6] Add foreground re-validation to `[session].tsx`: while `step === decision`, subscribe to `AppState.addEventListener('change', ...)`; on `'active'` re-run `GetProofSessionController({ sessionToken })` before re-enabling the buttons (FR-034); if the session is no longer `waiting_user` → show "Expirado" (FR-035); buttons re-enable only after the re-check resolves (SC-010); unsubscribe on unmount / step change in src/app/verify/[session].tsx

**Checkpoint**: All six user stories are independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Whole-flow validation of the success-criteria invariants

- [X] T049 Run the full suite: `EXPO_PUBLIC_STAGE=test npm test` (all `tests/**/*.test.ts` green)
- [ ] T050 [P] Execute quickstart.md §2.1–§2.7 manual validation on a development build (success, refuse, ineligible, expired, wrong PIN, background return, wrong clock)
- [X] T051 [P] Vocabulary audit (SC-009: no "DID / assinatura / nonce / token / sessão / blockchain / credencial verificável / apresentação / criptografia" on any D3 screen — FR-040) and confirm every terminal state uses a dedicated screen, never a toast (SC-004, FR-041)
- [X] T052 Verify runtime invariants via traffic + layout inspection (quickstart.md §3): challenge never called before decision (SC-002), zero challenge calls on ineligible/refused sessions (SC-003), zero telemetry emitted anywhere in D3 (FR-039), re-fetch on 100% of foreground returns (SC-010), "Autorizar"/"Recusar" identical tap area (SC-008), decision screen renders with no animation and inert buttons for ~400 ms (SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup and on D1/D2 being in place — BLOCKS all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational
  - US1 (P1) is the MVP and builds the shared engine: both use cases, all three concrete
    methods, and the entry adapter's happy + failure results
  - US2 (P1) adds the cancel use case + concrete method and wires "Recusar"
  - US3, US4, US5 extend `get_proof_session_usecase.ts` (+ test) and add result/orientation
    screens to `[session].tsx` — they run after US1 in priority order
  - US6 (P2) adds foreground re-validation to `[session].tsx`, reusing US1's use case
- **Polish (Phase 9)**: Depends on all targeted user stories

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — builds the authorization engine
- **US2 (P1)**: Depends on Foundational; shares `[session].tsx` with US1 (adds the refuse path);
  the cancel module/concrete are independent files
- **US3 (P1)**: Extends US1's `GetProofSessionUseCase` (eligibility branch) + `[session].tsx`
  (ineligibility screen, which routes to US2's cancel flow) — after US1 + US2
- **US4 (P2)**: Extends US1's `GetProofSessionUseCase` + `YaIDApiConcrete` (+ tests) and
  `[session].tsx` (Expirado screen) — after US1
- **US5 (P2)**: Extends US1's `GetProofSessionUseCase` + `[session].tsx` (orientation screens) —
  after US1
- **US6 (P2)**: Extends `[session].tsx` (foreground re-validation), reusing US1's use case —
  after US1

### Within Each User Story

- Tests written first and MUST FAIL before implementation (constitution, Principle II)
- Domain/ports before concretes; use case before presenter; logic before entry-adapter screen
- Entry-adapter screens (`src/app/verify/[session].tsx`) are validated on-device via
  quickstart.md (no Node tests) — project convention

### Parallel Opportunities

- All Foundational tasks marked [P] (T002–T012) run in parallel — different files
- Within US1, the seven test files (T013–T019) run in parallel; the two ViewModels (T021, T025)
  are [P]; the three `YaIDApiConcrete` methods (T028–T030) touch the same file and serialize
- US3/US4/US5/US6 each extend `[session].tsx`, so their screen tasks serialize on that file;
  their use-case-test extensions (T041, T043, T046) all touch the same test file and serialize
- Polish T050–T051 run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Enum, entity, errors, VP types, port, results, codec, DTO, mock — all different files:
Task T002: "ProofSessionStatus enum"
Task T003: "ProofSession entity"
Task T004: "presentation_errors.ts"
Task T005: "verifiable_presentation.ts (VP types)"
Task T006: "extend IYaIDApi with 4 methods"
Task T007: "GetProofSessionResult"
Task T008: "PresentProofResult"
Task T009: "CancelProofSessionResult"
Task T010: "encodeBase64Url + test"
Task T011: "proofSessionDtoToEntity + test"
Task T012: "extend YaIDApiMock + contract test"
```

## Parallel Example: User Story 1 Tests

```bash
# All seven US1 test files, written first, in parallel:
Task T013: "GetProofSessionUseCase test (eligibility invariant)"
Task T014: "GetProofSessionViewModel test"
Task T015: "GetProofSessionController test"
Task T016: "PresentProofUseCase fixed-vector + PIN-first test"
Task T017: "PresentProofViewModel test"
Task T018: "PresentProofController test"
Task T019: "YaIDApiConcrete happy-path test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (CRITICAL, blocks everything)
2. Phase 3 US1 → **STOP and VALIDATE** on device (quickstart §2.1)
3. A person with a credential can authorize a verification end-to-end — demo-ready MVP

### Incremental Delivery

1. Foundational ready
2. US1 → the authorization happy path + named failures (MVP)
3. US2 → real, cost-free refusal
4. US3 → local eligibility guard (no burned sessions)
5. US4 → expired / already-used links handled
6. US5 → out-of-order arrivals welcomed
7. US6 → background-return re-validation

### Parallel Team Strategy

With multiple developers, after Foundational:

- US3–US6 all touch `[session].tsx` and `get_proof_session_usecase.ts`, so they serialize on
  those files. To parallelize, one developer owns `[session].tsx` (US1→US2→US3→US4→US5→US6
  screens) while another owns the shared infra (`yaid_api_concrete.ts` methods + tests) and the
  cancel module (US2), which are independent files.

---

## Notes

- [P] = different files, no dependencies on incomplete tasks
- [Story] label maps each task to a user story for traceability
- **Golden rule**: the challenge (`getChallenge`) is IRREVERSIBLE and is fetched ONLY inside
  `PresentProofUseCase`, only after `IPinLock.verify()` succeeds — never in `GetProofSessionUseCase`
  and never on the decision screen (FR-027, SC-002; regression-tested in T013/T016)
- Signing uses `Ed25519Client`; no `ISigner` port exists (reconciled with D1/D2 as-built)
- Presenters use `environments.ts` factories; stage-branching stays centralized there. D3 adds
  no new persistent ports and no new factories
- `ProofSession` is ephemeral — never persisted; background return re-fetches, never restores
- Verify each test fails before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
