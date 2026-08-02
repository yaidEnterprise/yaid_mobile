# Implementation Plan: D1 — Identidade e Acesso

**Branch**: `001-identidade-acesso` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-identidade-acesso/spec.md`

## Summary

D1 delivers the identity layer and access control of YaID Wallet. It creates an Ed25519 identity entirely on-device (no server, no network — FR-003, SC-007), defines the 6-digit PIN during onboarding, and delivers the reusable PIN verification capability that D2, D3, and D4 depend on. The home screen gains two states (no identity; identity without credential).

Technical approach: `@noble/ed25519` (pure JS, no native modules required in React Native) for key derivation; `expo-secure-store` for seed, PIN, and lockout state; all randomness, signing, clock, and storage behind interfaces so the use cases run in Node without a simulator. See [research.md](./research.md) for library selection rationale.

## Technical Context

**Language/Version**: TypeScript 5.x strict — Expo SDK 52+ / React Native 0.76+

**Primary Dependencies**: `expo-secure-store` (Keychain/Keystore), `@noble/ed25519` (Ed25519), Expo Router (routing), `tsx` or Bun (Node test runner for use-case tests)

**Storage**: OS Keychain (iOS) / Keystore (Android) via `expo-secure-store` — seed (32 bytes as base64url), PIN (plaintext in HW-backed storage, see research.md §3), attempt state (JSON). Each value ≤ 2 KB (Android Keystore limit, T3).

**Testing**: Node.js TypeScript runner — all use case, controller, ViewModel, and fake tests run without simulator.

**Target Platform**: iOS 16+ and Android 10+ — Expo development build only (Expo Go lacks Universal/App Links needed in D3).

**Performance Goals**: Identity creation appears instantaneous — no loading indicator from PIN confirmation to home screen (SC-003).

**Constraints**: 100% offline for the full D1 flow (FR-003, SC-002); zero network requests (SC-007); Android Keystore ≤ 2 KB per entry (T3).

**Scale/Scope**: One identity per device installation; three Keychain entries (seed, PIN, attempt state).

## Constitution Check

| # | Gate | Pass? |
|---|---|---|
| I | Ports touched: `IRandomness`, `IIdentityRepository`, `ISigner`, `IPinLock`, `IClock`. Each has interface in `shared/domain/interfaces/`, concrete in `shared/infra/`, and fake alongside. No `expo-*` outside `shared/clients/`. | ✅ |
| II | TDD first on all layers. **Fixed-vector test mandatory** for `seed → publicKey → DID` derivation (silent failure point). Regression tests: PIN failure never deletes identity (FR-025, SC-006), lockout survives app restart (FR-023), lockout duration escalation (FR-021). | ✅ |
| III | Presenter = composition root, stateless, called per action. Controllers return typed results. Navigation in entry adapters. `shared/` stays at exactly 5 entries. | ✅ |
| IV | Zero telemetry. No analytics or crash SDK. D1 emits no signal outside the device (FR-031, SC-007). | ✅ |
| V | `CreateIdentityViewModel` exposes only `did` — seed and publicKey stripped before the screen sees them. PIN demanded on every sensitive operation (D1 delivers this capability for D2/D3/D4). PIN failure never deletes identity (FR-025, SC-006). TLS pinning: N/A (no network in D1). | ✅ |
| VI | Canonical identifiers: `Identity`, `DefinePIN` (module `access/`). No "cancelar" in user-facing strings (FR-032). | ✅ |
| VII | No irreversible API-side operations in D1. Regression test: lockout exhaustion never deletes identity. Failure always visible (FR-009, FR-033). | ✅ |
| UX | No decision screen in D1. Dedicated result screens, not toasts. No technical vocabulary in strings. WCAG 2.1 AA. Light theme. | ✅ |

**Post-Phase-1 re-check**: All gates remain Pass. The `Identity` entity contains `seed` (needed by use cases; ViewModel strips it). This is the correct reading of §6.2: "seed never crosses the ViewModel boundary" means it never reaches the entry adapter — not that it can't exist in the entity or be seen by the use case.

## Project Structure

### Documentation (this feature)

```text
specs/001-identidade-acesso/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── identity_repository.md   ← IIdentityRepository — consumed by D2, D3, D4
│   └── pin_lock.md              ← IPinLock — consumed by D2, D3, D4
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Files introduced by D1 (none exist yet):

```text
src/
├── app/
│   ├── index.tsx                            ← home (states: no-identity · identity-no-credential)
│   ├── _layout.tsx                          ← app shell
│   └── onboarding/
│       ├── define-pin.tsx                   ← PIN entry + step-by-step confirmation (2 sub-steps)
│       └── create-identity.tsx              ← triggers identity creation on mount; instant redirect
│
├── modules/
│   ├── identity/
│   │   └── app/
│   │       ├── create_identity_usecase.ts
│   │       ├── create_identity_viewmodel.ts
│   │       ├── create_identity_controller.ts
│   │       └── create_identity_presenter.ts
│   └── access/
│       └── app/
│           ├── define_pin_usecase.ts
│           ├── define_pin_viewmodel.ts
│           ├── define_pin_controller.ts
│           └── define_pin_presenter.ts
│
└── shared/
    ├── domain/
    │   ├── entities/
    │   │   └── identity.ts
    │   ├── enums/
    │   │   └── stage.ts
    │   ├── errors/
    │   │   ├── identity_errors.ts
    │   │   └── pin_errors.ts
    │   └── interfaces/
    │       ├── repositories/
    │       │   └── identity_repository.ts
    │       └── providers/
    │           ├── randomness.ts
    │           ├── signer.ts
    │           ├── clock.ts
    │           └── pin_lock.ts
    ├── infra/
    │   ├── repositories/
    │   │   └── identity_repository_concrete.ts
    │   └── providers/
    │       ├── randomness_concrete.ts
    │       ├── signer_concrete.ts
    │       ├── clock_concrete.ts
    │       ├── pin_lock_concrete.ts
    │       └── mock/
    │           ├── identity_repository_mock.ts
    │           ├── randomness_mock.ts
    │           ├── signer_mock.ts
    │           ├── clock_mock.ts
    │           └── pin_lock_mock.ts
    ├── result/
    │   ├── create_identity_result.ts
    │   └── define_pin_result.ts
    ├── clients/
    │   └── secure_store_client.ts
    └── environments.ts

tests/
├── modules/
│   ├── identity/
│   │   └── app/
│   │       ├── create_identity_usecase.test.ts    ← fixed-vector: seed→publicKey→DID
│   │       ├── create_identity_viewmodel.test.ts   ← seed stripped from output
│   │       └── create_identity_controller.test.ts
│   └── access/
│       └── app/
│           ├── define_pin_usecase.test.ts
│           ├── define_pin_viewmodel.test.ts
│           └── define_pin_controller.test.ts
└── shared/
    ├── domain/
    │   └── entities/
    │       └── identity.test.ts
    └── infra/
        └── providers/
            └── mock/
                ├── identity_repository_mock.test.ts
                ├── randomness_mock.test.ts
                ├── signer_mock.test.ts
                ├── clock_mock.test.ts
                └── pin_lock_mock.test.ts
```

**Structure Decision**: Single Expo mobile app following ARCHITECTURE.md §5 exactly. Two modules: `identity/` (creation) and `access/` (PIN). Onboarding is a two-screen sequence: `define-pin.tsx` stores the PIN then navigates to `create-identity.tsx` which immediately creates the identity and redirects to home — achieving the "instantaneous" perception required by SC-003.

## Complexity Tracking

No constitution violations requiring justification.
