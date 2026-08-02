# Implementation Plan: Revogação de Credencial (D4)

**Branch**: `004-revogacao` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-revogacao/spec.md`

## Summary

Implement the credential revocation domain (D4): the person permanently invalidates their YaID credential by entering their 6-digit PIN, confirming on a dedicated screen that explicitly states irreversibility, and having the app call `POST /api/credentials/revoke` — which registers the revocation on-chain — before deleting the credential locally. All six user stories and twelve functional requirements map directly to the layered architecture pattern established across D1–D3. Two existing shared port interfaces gain one method each (`CredentialRepository.delete()` and `YaIDApi.revokeCredential()`); the rest of the shared infrastructure is reused without modification.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: Expo (React Native), Expo Router, `@noble/ed25519` or equivalent (Ed25519 signing), `expo-secure-store` (seed + encryption key storage), Node.js TypeScript test runner (use-case tests run without simulator)

**Storage**: OS Secure Storage (Keychain/Keystore) for seed and credential-encryption key; encrypted file in app sandbox for the credential (via `CredentialRepository`). No global store, no session state (T7).

**Testing**: Node.js test runner — all use-case, controller, and ViewModel tests run without device or simulator. Entry-adapter tests only when they add coverage beyond the controller.

**Target Platform**: iOS + Android; development build mandatory (Expo Go cannot handle Universal/App Links, which are the entry point of D3 and co-exist with this domain).

**Performance Goals**: Full revocation flow completes in < 2 minutes from the person's decision (SC-001).

**Constraints**: Offline-incapable — credential is deleted locally only after `{ revoked: true }` from the API (FR-004, FR-005). Android Keystore per-value limit ≈ 2 KB. TLS with certificate pinning required for all API calls (T10). Zero telemetry (T11).

**Scale/Scope**: Single-user, single-device. At most one credential exists at a time. Revocation is permanent — no undo path, no local "revoked" state; absence of credential is the terminal state.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| # | Gate | Pass? |
|---|---|---|
| I | Every external resource this feature touches has an interface in `shared/domain/interfaces/`, plus a concrete AND a fake in `shared/infra/`. No SDK / `expo-*` / `fetch` import outside `shared/clients/`. | **Pass** — D4 uses five existing ports (`CredentialRepository`, `IdentityRepository`, `PinLock`, `Signer`, `Clock`, `YaIDApi`). Two ports gain new methods: `CredentialRepository.delete()` and `YaIDApi.revokeCredential()`. Both additions get corresponding fake implementations. No new SDK surface; all `expo-*` stays in `shared/clients/`. |
| II | Every task has a failing test written first. Test tree mirrors `src/` 1:1. Fixed vectors covered if crypto/DID/presentation is involved. | **Pass** — revocation signs two payloads: `vcId` (body signature) and `{timestamp}:POST:/api/credentials/revoke` (DID-auth signature). Both signing paths require fixed-vector tests. TDD order: use case → controller → viewmodel → fake method additions → presenter → entry adapter (only if it adds coverage). |
| III | Layer dependencies respect the one-way direction. Presenter is composition-root only (stateless). Controllers return typed results; navigation stays in entry adapters. `shared/` gains no sixth entry. | **Pass** — `revoke_credential_usecase.ts` depends only on injected ports. `revoke_credential_controller.ts` returns a typed `RevokeCredentialResult`. `revoke.tsx` owns all navigation decisions. `shared/` gains no new top-level entry. |
| IV | No telemetry, analytics, or crash-reporting SDK. No verification history persisted. No remote logging. | **Pass** — no telemetry surface. The revocation event is not persisted locally; absence of credential is the state. No log leaves the device. |
| V | The seed never crosses the ViewModel boundary. PIN demanded on comprovar / autorizar / revogar. PIN failure never deletes identity. TLS pinning intact. | **Pass** — `IIdentityRepository.load()` returns `{ seed, publicKey, did }` (D1 design). `RevokeCredentialUseCase` passes `seed` to `IYaIDApi.revokeCredential()`; the concrete (`YaIDApiConcrete`) handles all signing internally — same pattern as D2 `issueCredential`. Seed never reaches ViewModel or entry adapter. PIN verified via `IPinLock.verify()` as FIRST operation; wrong PIN leaves identity and credential untouched (FR-009, SC-005). TLS pinning configuration unchanged. |
| VI | Identifiers follow the canonical vocabulary map. `proofType` spelling conversion confined to the HTTP adapter. No user-facing "cancelar". | **Pass** — the operation is named `RevokeCredential` throughout all layers. The abort button on the confirmation screen uses "Voltar" (not "Cancelar") to comply with the constitution's prohibition. See research.md §5 for the FR-003 conflict resolution. |
| VII | Challenge fetched only after the person decides. Local eligibility check precedes any API call. Failure paths are visible and terminal. Regression tests present. | **Pass** — no proof-session challenge in this domain. Irreversibility rule: credential deleted locally only after `{ revoked: true }` from YaID (FR-004, FR-005). All failure paths (API error, network failure) produce a dedicated error screen with named cause (FR-008, SC-004). Regression tests mandatory for the "delete only on confirmed success" invariant. |
| UX | Decision-screen invariants hold. No toast for sensitive outcomes. No technical vocabulary in user-facing strings. WCAG 2.1 AA met. | **Pass** — confirmation screen uses equal-weight buttons (FR-003; button labels resolve the vocabulary conflict per research.md §5). Result is a dedicated screen, not a toast (FR-006). No technical terms in user-facing strings. |

**Post-Phase-1 re-check**: All gates remain Pass. The data model and contracts introduce no new violations. The `vcId` field in the `Credential` entity keeps the seed barrier intact (no cryptographic material in entities). The confirmation-screen button label decision (research.md §5) is the only spec deviation, and it is constitution-driven.

## Project Structure

### Documentation (this feature)

```text
specs/004-revogacao/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   ├── use-case.md
│   └── port-additions.md
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code

Files introduced by D4:

```text
src/
├── app/
│   └── credential/
│       └── revoke.tsx                               ← entry adapter (new)
│
└── modules/
    └── credential/
        └── app/
            ├── revoke_credential_usecase.ts         ← new
            ├── revoke_credential_viewmodel.ts       ← new
            ├── revoke_credential_controller.ts      ← new
            └── revoke_credential_presenter.ts       ← new

tests/
└── modules/
    └── credential/
        └── app/
            ├── revoke_credential_usecase.test.ts    ← new
            ├── revoke_credential_viewmodel.test.ts  ← new
            ├── revoke_credential_controller.test.ts ← new
            └── revoke_credential_presenter.test.ts  ← new
```

Shared infrastructure additions (interfaces and fakes defined in D1–D3; D4 adds one method each):

```text
src/shared/
├── domain/
│   └── interfaces/
│       ├── repositories/
│       │   └── credential_repository.ts             ← add delete() method
│       └── providers/
│           └── yaid_api.ts                          ← add revokeCredential() method
├── infra/
│   └── mock/
│       ├── credential_repository_mock.ts            ← implement delete() in fake
│       └── yaid_api_mock.ts                         ← implement revokeCredential() in fake
└── result/
    └── revoke_credential_result.ts                  ← new result and failure union types
```

**Structure Decision**: Single mobile-app project (Option 3 pattern). D4 adds four use-case-layer files and one entry adapter, plus one new result-type file. Two existing shared interfaces gain one method each; their fakes are extended correspondingly. No new top-level folder in `shared/`.

## Complexity Tracking

> No Constitution Check violations requiring justification. This section is intentionally empty.
