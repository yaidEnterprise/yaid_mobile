<!--
SYNC IMPACT REPORT
==================
Version change: (template) → 1.0.0
Modified principles: N/A (initial authoring from template placeholders)
Added sections:
  - Core Principles (7 principles derived from PROJECT-BASELINE.md + ARCHITECTURE.md + UX.md)
  - Build & Stage Configuration
  - UX Invariants
  - Governance
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (Constitution Check section is generic and compatible)
  - .specify/templates/spec-template.md ✅ (no constitution-specific sections; compatible)
  - .specify/templates/tasks-template.md ✅ (task structure is compatible; TDD ordering aligns)
Deferred TODOs: none
-->

# YaID Wallet — Constitution

## Core Principles

### I. Interface-Driven Development — The Iron Rule

Every dependency on an external resource (storage, camera, HTTP, clock, randomness,
cryptography, biometrics) MUST be defined as an interface inside `shared/domain/interfaces/`
**before** any concrete implementation is written. Concretes live in `shared/infra/`. Fakes
live alongside concretes, one per interface.

- No use case, controller, or domain entity MAY import an SDK, `expo-*` package, `fetch`,
  or any platform-specific module directly.
- No `expo-*` import is permitted outside `shared/clients/`.
- Every fake MUST honour the full contract of its interface, including edge cases, and MUST
  have its own test verifying that contract.
- Mocking a module (e.g., jest.mock) is PROHIBITED in place of a fake.

**Rationale**: This is the load-bearing constraint of the architecture. Without it, use cases
cannot run in Node without a simulator, TDD becomes impossible to enforce, and every SDK
upgrade risks silent regression. The Iron Rule is what makes the test suite a reliable gate.

### II. Test-First Development (NON-NEGOTIABLE)

Every piece of functionality is born as a **failing test**. The Red-Green-Refactor cycle is
mandatory and not optional.

- Tests are written and approved by the author **before** implementation begins.
- Tests MUST fail when first run (no implementation yet).
- Tests MUST pass after implementation, with no skipped assertions.
- The test tree mirrors `src/` 1-to-1; every source file has a counterpart under `tests/`.
- Coverage priority order (highest to lowest):
  1. Use cases — the rule, with port fakes
  2. Controllers — invalid input, valid input, every expected error
  3. ViewModels — correct shape and **removal of sensitive fields**
  4. Mappers — DTO ↔ entity conversion
  5. Fakes — contract compliance per interface
  6. Presenters — correct fake/concrete selection per stage
  7. Entry adapters — only when they add coverage beyond the controller

**Fixed-vector tests are mandatory** for `seed → public key → DID` derivation and for
presentation assembly. These are the silent-failure points: a locally valid signature that
the server rejects returns `401` with no diagnostic.

**Regression tests are mandatory** for the irreversible rules listed in Principle VI.

**Rationale**: A credencial that is believed to exist but doesn't is a worse outcome than
no credential at all. The test suite is the only way to know the system behaves as specified
under conditions that cannot be replicated on a real device in CI.

### III. Strict Layer Separation and Dependency Direction

The codebase has ten roles. Each role has one responsibility and may only depend on its
immediate downstream neighbour. Dependency direction is one-way.

```
Permitted:
  entry adapter  →  presenter  →  controller  →  use case  →  domain
  infra          →  domain (interfaces only)
  presenter      →  environments, infra, clients
  controller     →  result types, domain errors
  use case       →  injected ports only

Prohibited (hard failures in review):
  domain         →  infra, React, Expo, any framework
  use case       →  React, Expo, fetch, navigation, env vars
  controller     →  any concrete from infra or clients
  entry adapter  →  storage, SDK, env vars, business logic
  module         →  internals of another module
  shared/        →  any seventh top-level folder
```

`shared/` has exactly five top-level entries: `domain/`, `infra/`, `result/`, `clients/`,
`environments.ts`. No new top-level entry may be added.

**Presenter = composition root only.** It is not MVP's Presenter. It does not hold state.
It is a function called per action that reads `environments.ts`, instantiates concretes or
fakes, wires them into the use case and controller, and returns the controller.

**Navigation is not domain.** Controllers return typed results; entry adapters decide routes.
No use case or controller knows a route name.

**Rationale**: Layer violations propagate silently. A use case that imports `fetch` compiles
and tests locally but breaks on every platform change and cannot be unit-tested in Node.
The constraint is verified by review, not by type-checker alone.

### IV. Privacy and Zero-Telemetry

No event, metric, error report, or behavioural signal leaves the device — ever.

- No analytics SDK, crash-reporting SDK, or remote logging SDK may be installed.
- Log output is permitted only in development builds (`stage === 'dev'`) and MUST go to the
  local console, never to a remote endpoint.
- The credential exists **only on the device** of the person who holds it.
- The application stores no history of verifications, authorisations, or refusals.
  Absence of history is a deliberate feature, not an omission.
- No personally identifying field (name, CPF, photo, document number) is ever held in
  application state after the comprovação flow completes.

**Rationale**: The product's promise to the person is that the application does not track
them. Shipping telemetry — even anonymised — breaks that promise structurally. There is no
acceptable telemetry surface in this product.

### V. Security-by-Design — Seed Barrier and Minimal Attack Surface

The seed (32-byte Ed25519 private key material) is the single most sensitive value in the
system. Its exposure represents total compromise of the person's identity.

- **The seed MUST NEVER cross the ViewModel boundary.** If a domain entity holding the seed
  reaches the entry adapter, the seed enters React's component tree, the DevTools inspector,
  and any exception log. ViewModels exist primarily to prevent this.
- The seed and encryption key are stored in the OS secure enclosure (Keychain / Keystore),
  flagged non-syncable and device-restricted.
- The credential is stored in an encrypted file in the app sandbox; the encryption key lives
  in secure storage separately.
- The PIN (6 digits) MUST be demanded for every sensitive operation: **comprovar**,
  **autorizar**, and **revogar**. No session state relaxes this requirement.
- Incorrect PINs increment a counter and trigger exponential back-off. PIN failure MUST NEVER
  delete the identity; deleting on failure is a denial-of-service vector.
- TLS with certificate pinning is mandatory for all API communication (`T10`). The company
  name and verification question are not signed; pinning is the only transport-level defence
  against a forged server.
- The challenge (proof session nonce) is fetched **only after** the person makes their
  decision to authorise. Fetching on screen load burns the session if the person cancels.

**Rationale**: The attack surface is small by design. Every relaxation of these rules
re-introduces a surface that the architecture specifically closed.

### VI. Domain Vocabulary — One Term, One Meaning

The canonical vocabulary defined in `PROJECT-BASELINE.md` (§4) governs all source code
identifiers, aligned with the API contract where they differ.

| Concept | Code identifier |
|---|---|
| Identidade | `Identity` |
| Credencial | `Credential` |
| Solicitação de verificação | `ProofSession` |
| Autorizar | `PresentProof` |
| Recusar | `CancelProofSession` |
| Revogar | `RevokeCredential` |
| Comprovar | `IssueCredential` |

`proofType` has two API spellings (`ageOver18` in issuance, `age_over_18` in proof sessions).
The domain holds **one canonical enum**; conversion lives exclusively in the HTTP adapter.

"Cancel" as a standalone term is prohibited — it maps to two distinct operations. Use
`Cancel` only in `CancelProofSession`.

The word "cancelar" MUST NOT appear in any user-facing string. Use "recusar" (for refusing
a proof session) or "invalidar" (for revoking the credential).

**Rationale**: Naming divergence between the product, the code, and the API contract is the
root cause of integration bugs that are silent at compile time. A single canonical map
eliminates an entire class of error.

### VII. Irreversible Operations — Visibility and Correct Ordering

Certain operations are irreversible by design and have mandatory sequencing rules. Violating
them destroys user data or burns a resource with no recovery path.

These rules have mandatory regression tests (see Principle II):

- **Challenge fetch comes after the person decides.** `GET /proof-sessions/{id}/challenge`
  is called only after the person taps "Autorizar". It mutates server state; calling it on
  screen load burns the session silently if the person cancels.
- **Local eligibility check before challenge fetch.** If the proof session asks for
  `ageOver18` and the credential answers "Não", the app MUST block and inform the person
  **without calling the API**. Calling the API would burn the session and return an opaque
  failure.
- **Failure is opaque and terminal.** A verification failure arrives as HTTP 200 with no
  reason field. The app MUST display a generic message and direct the person back to the
  company's site. There is no retry on the same session.
- **A proof session found in an already-open state is irrecoverable.** The challenge was
  consumed. Treat it as expired.
- **Revocation is irreversible.** The credential cannot be restored after revocation.
  The person must re-issue. The confirmation screen MUST state this explicitly.
- **Failure is never silent.** A comprovação that fails silently leaves the person believing
  they hold a credential they do not. Every failure path MUST surface a visible, actionable
  message (Principle R11 of the baseline).

**Rationale**: These are the rules where a bug produces a support case with no recovery path.
The regression tests are the only defence against accidental reversion during refactoring.

---

## Build and Stage Configuration

The application recognises four execution stages, read from `EXPO_PUBLIC_STAGE` and validated
in `shared/environments.ts` — the **only** file permitted to read environment variables.

| Stage | Infrastructure | Purpose |
|---|---|---|
| `test` | All fakes — deterministic, no network, no device | CI gate; safe for merge |
| `dev` | Real stack, local replica | Active development |
| `homol` | Real stack, mirrors production | Pre-release validation |
| `prod` | Production | Shipping build |

`test` ALWAYS resolves every port to its fake. Any other stage ALWAYS resolves to the
concrete. No conditional logic related to stage may appear outside the presenter.

**Development build is mandatory.** Expo Go cannot handle Universal Links / App Links, which
are the entry point for the entire authorisation domain (D3). There is no alternative.

---

## UX Invariants

These rules are non-negotiable and apply across all screens. They originate in `UX.md` and
are governance-grade constraints, not style preferences.

- **Decision screen (§7, UX.md) is a security surface.** Its rules are absolute:
  - Nothing animates. The screen appears fully composed.
  - Buttons are inert for ~400 ms after the screen appears (guards against tap bleed from
    the previous screen).
  - "Autorizar" and "Recusar" have identical tap area and visual weight (primary colour vs.
    secondary weight — not primary vs. ghost or hidden).
  - No back gesture or outside-button tap produces any effect.
  - No countdown timer is shown on any screen.
- **No toast for sensitive outcomes.** Comprovação result, authorisation result, and
  revocation result each get a dedicated result screen. A 4-second toast is the wrong format
  for "your credential was revoked permanently".
- **Every error names the cause and the next action.** "Algo deu errado" is prohibited.
- **Relógio errado produces a specific message** directing the person to fix device time,
  not a generic signature error.
- **No term from the technical vocabulary appears in any user-facing string.** The mapping
  lives in `UX.md §9`.
- **Light theme only in MVP.** The app declares a fixed light theme; it does not inherit
  the system appearance setting.
- **WCAG 2.1 AA is the accessibility floor**, not a target. Contrast, tap area, screen
  reader ordering, and font scaling are verified, not aspirational.

---

## Governance

This constitution supersedes all other practices within this project. When it conflicts with
a tool default, a framework convention, or a team habit, the constitution wins.

**Amendment procedure**:
1. Propose the amendment in writing, stating the reason and the principle(s) affected.
2. The proposal must identify every downstream artifact that requires an update (templates,
   docs, existing specs) and include a migration plan for in-progress work.
3. The amendment takes effect when this file is updated with an incremented version and a
   dated `Last Amended` entry.

**Versioning policy**:
- **MAJOR**: A principle is removed, renamed in a way that changes its meaning, or its
  non-negotiable boundary is relaxed.
- **MINOR**: A new principle or major section is added.
- **PATCH**: Wording, examples, or formatting are clarified without semantic change.

**Compliance review**: Every implementation plan (`/speckit-plan`) MUST include a
"Constitution Check" section that verifies each applicable principle before Phase 0 research
begins and again after Phase 1 design. Complexity violations require explicit justification
in the Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-02
