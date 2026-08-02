# Implementation Plan: D3 — Autorização

**Branch**: `003-autorizacao` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-autorizacao/spec.md`

## Summary

D3 delivers the full authorization flow: deep link `yaid://verify?session=<token>` opens the app → session is fetched → local eligibility is checked → decision screen (Autorizar / Recusar) → on Autorizar: PIN + challenge + VP assembly + submission; on Recusar: session cancelled → result screen. Five terminal states (Verificado, Recusado, Expirado, Falhou, Inelegível). D3 depends on D1 (IPinLock, IIdentityRepository, ISigner, IClock) and D2 (ICredentialRepository, IYaIDApi extended with 4 more methods).

The challenge fetch is irreversible and is triggered only AFTER the person enters the correct PIN — the most critical sequencing constraint in the entire product. Fixed-vector tests are mandatory for the VP signature. See [research.md](./research.md) for the VP assembly format, background-return behaviour, and eligibility check logic.

## Technical Context

**Language/Version**: TypeScript 5.x strict — Expo SDK 52+

**Primary Dependencies**: Expo Router (Universal Link / App Link handling), all D1 + D2 dependencies. `expo-linking` for deep link interception.

**Storage**: No new persistent storage in D3. Reads from `IIdentityRepository` (seed, did) and `ICredentialRepository` (raw VC). Proof sessions are ephemeral — never persisted.

**Testing**: Node.js TypeScript runner — all use case, controller, ViewModel, fake tests run without device. VP assembly and signature tests require fixed vectors (see [quickstart.md](./quickstart.md)).

**Target Platform**: iOS 16+ and Android 10+ — Expo development build mandatory (Expo Go cannot handle Universal Links / App Links, T1.1 in ARCHITECTURE.md).

**Performance Goals**: < 90 seconds from link tap to "Verificado" result (SC-001). Challenge + VP + submit in a single loading step with descriptive text (FR-030).

**Constraints**: Challenge NEVER fetched before user decision (FR-027, §11.2). Local eligibility checked before any API call (FR-009, FR-011, SC-003). Back gesture disabled on decision screen (FR-019). Buttons inert for ~400 ms (FR-016).

**Scale/Scope**: Stateless per session; no history of past verifications persisted. One active session at a time.

## Constitution Check

| # | Gate | Pass? |
|---|---|---|
| I | No new port interfaces needed — D3 extends `IYaIDApi` with 4 methods (`getProofSession`, `getChallenge`, `verifyPresentation`, `cancelProofSession`). All ports from D1/D2 reused. `YaIDApiMock` extended correspondingly. | ✅ |
| II | TDD first. **Fixed-vector tests mandatory** for VP assembly (signature over `JSON.stringify({holder,challenge,verifiableCredential})`) and for DID-auth headers on challenge and cancel calls. Regression tests: challenge never called before decision (FR-027), eligibility check never calls challenge (FR-011). | ✅ |
| III | Layer direction respected. `GetProofSessionViewModel` exposes only `{ companyName, proofType, canAnswer }` — credential raw and identity seed never reach the screen. `shared/` stays at 5 entries. | ✅ |
| IV | Zero telemetry (FR-039). No history of sessions persisted (baseline §3.2). | ✅ |
| V | Seed never crosses ViewModel. PIN demanded before challenge fetch (FR-026). PIN failure leaves challenge uncalled (invariant). TLS pinning on all 4 new API calls (T10). | ✅ |
| VI | `ProofSession`, `PresentProof`, `CancelProofSession` as canonical identifiers. `proofType` snake_case/camelCase conversion in `YaIDApiConcrete` only. No "cancelar" in user-facing strings — UI uses "Recusar" / "Voltar". | ✅ |
| VII | Challenge fetched ONLY after user decision + PIN correct (FR-027). Local eligibility check before challenge (FR-011). `{ valid: false }` is terminal — no retry on same session (FR-033). Session found in `opened` state is irrecoverable (FR-006). All failure paths are visible with named reasons (FR-038). Regression tests mandatory for irreversibility rules (§11.2). | ✅ |
| UX | Decision screen: no animation, buttons inert ~400 ms, Autorizar/Recusar equal tap area, no back gesture, no outside-tap effect, no countdown (FR-012–FR-020). All 5 terminal states use dedicated screens — no toast. No technical vocabulary (FR-040, SC-009). WCAG 2.1 AA with screen-reader ordering: company → question → buttons (FR-021). | ✅ |

**Post-Phase-1 re-check**: All gates pass. The VP assembly uses `JSON.parse(credential.raw)` for the current object format (ARCHITECTURE.md open question #1 is an API-side issue; the app builds for the current accepted format). The JWT format (ARCHITECTURE.md §11.3) is the post-Epic 9 target and will require a contract change on the server.

## Project Structure

### Documentation (this feature)

```text
specs/003-autorizacao/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── yaid_api_d3.md   ← IYaIDApi D3 methods: getProofSession, getChallenge, verifyPresentation, cancelProofSession
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Files introduced by D3 (D1 + D2 in place):

```text
src/
├── app/
│   └── verify/
│       └── [session].tsx          ← entry adapter: manages all D3 steps via internal state enum
│
├── modules/
│   ├── proof-session/
│   │   └── app/
│   │       ├── get_proof_session_usecase.ts     ← fetch + checks identity/credential/eligibility
│   │       ├── get_proof_session_viewmodel.ts
│   │       ├── get_proof_session_controller.ts
│   │       ├── get_proof_session_presenter.ts
│   │       ├── cancel_proof_session_usecase.ts  ← sends POST cancel (no PIN required)
│   │       ├── cancel_proof_session_viewmodel.ts
│   │       ├── cancel_proof_session_controller.ts
│   │       └── cancel_proof_session_presenter.ts
│   └── presentation/
│       └── app/
│           ├── present_proof_usecase.ts          ← PIN → challenge → VP → submit
│           ├── present_proof_viewmodel.ts
│           ├── present_proof_controller.ts
│           └── present_proof_presenter.ts
│
└── shared/
    ├── domain/
    │   ├── entities/
    │   │   └── proof_session.ts             ← new
    │   ├── enums/
    │   │   └── proof_session_status.ts      ← new
    │   └── errors/
    │       └── presentation_errors.ts       ← PresentationRejectedError, SessionExpiredError, etc.
    ├── infra/
    │   ├── dto/
    │   │   └── proof_session_dto.ts         ← GET proof-session response → ProofSession mapper
    │   └── providers/
    │       ├── yaid_api_concrete.ts         ← extended: add 4 methods to existing concrete
    │       └── mock/
    │           └── yaid_api_mock.ts         ← extended: add 4 scripted methods
    └── result/
        ├── get_proof_session_result.ts
        ├── present_proof_result.ts
        └── cancel_proof_session_result.ts

tests/
├── modules/
│   ├── proof-session/
│   │   └── app/
│   │       ├── get_proof_session_usecase.test.ts
│   │       ├── get_proof_session_viewmodel.test.ts
│   │       ├── get_proof_session_controller.test.ts
│   │       ├── cancel_proof_session_usecase.test.ts
│   │       └── cancel_proof_session_controller.test.ts
│   └── presentation/
│       └── app/
│           ├── present_proof_usecase.test.ts    ← fixed-vector VP signature (MANDATORY)
│           ├── present_proof_viewmodel.test.ts
│           └── present_proof_controller.test.ts
└── shared/
    └── infra/
        └── dto/
            └── proof_session_dto.test.ts
```

**Structure Decision**: Same single Expo project. D3 adds two modules (`proof-session/` and `presentation/`) using the folder structure from ARCHITECTURE.md §5 exactly. The entry adapter `[session].tsx` manages the full session flow via an internal state enum — one route, all sub-steps.

## Complexity Tracking

No constitution violations requiring justification. The ~400 ms button-inert timer in `[session].tsx` is a UX invariant (FR-016), not a domain rule — it stays in the entry adapter.
