# Research — D2: Comprovação

**Branch**: `002-comprovacao` | **Date**: 2026-08-02

---

## 1. Captura de documento: câmera ao vivo

**Decision**: `expo-camera` (CameraView component) for live camera capture. No gallery access at any point.

**Rationale**: The spec (FR-012, R4 of baseline) prohibits gallery selection. `expo-camera` provides a live viewfinder. The person taps a shutter button; the image is captured via `CameraView.takePictureAsync({ base64: true })` which returns the image encoded as base64.

**Camera permission timing**: Permission requested via `Camera.requestCameraPermissionsAsync()` AFTER PIN verification succeeds (FR-008). If already granted (from a previous session), the viewfinder opens directly. If denied, the app shows an explanation screen and an "Abrir ajustes" button (`Linking.openSettings()`).

**Concrete** (`DocumentCaptureConcrete`): wraps `expo-camera` inside `shared/clients/`. The port `IDocumentCapture.capture()` returns a base64 string (no `data:` prefix — per API contract §4.1).

**Fake** (`DocumentCaptureMock`): returns a fixed base64 string (a valid but minimal JPEG fixture). Deterministic for test use.

---

## 2. Processamento e compressão da imagem

**Decision**: Resize to max 1600 px on the long side; compress JPEG quality iteratively until base64-encoded size ≤ 1 048 576 bytes (1 MB). Start at quality 0.85; reduce by 0.1 each iteration; floor at 0.3.

**Rationale**: API contract §11.6 (ARCHITECTURE.md): "largest side limited to 1600 px, quality adjusted to fit; 1 MB limit after base64 encoding." Base64 inflates by ~33%; a 750 KB raw image ≈ 1 MB base64.

**Implementation** (`ImageProcessorConcrete`): uses `expo-image-manipulator` inside `shared/clients/image_manipulator_client.ts`.
1. `ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }])` — expo-image-manipulator preserves aspect ratio when only one dimension is given.
2. Encode with `SaveFormat.JPEG` and target quality.
3. Convert to base64 (`FileSystem.readAsStringAsync(resultUri, { encoding: 'base64' })`).
4. If result.length > 1_048_576: reduce quality and repeat.

**Fake** (`ImageProcessorMock`): passthrough — returns the input unchanged. Sufficient for use case tests (where the exact byte count is irrelevant to the business logic test).

**Open question**: The 1 MB ceiling is documented as a calibrated estimate (ARCHITECTURE.md §16, question 6). Validation against real OCR success rates should be done after the first real user test run.

---

## 3. Armazenamento da credencial: arquivo cifrado

**Decision**: Store the credential as an AES-encrypted JSON file in `FileSystem.documentDirectory`. The encryption key (32-byte random key) is stored in OS Keychain under `yaid.credential.key`.

**Rationale**: The credential can exceed 2 KB (a signed VC with base64 fields is typically 1-4 KB before encoding). Keychain/Keystore limits entries to ~2 KB on Android (T3). The encrypted-file pattern from ARCHITECTURE.md §4.2 avoids this limit.

**Encryption**: AES-256-GCM using the Web Crypto API available in React Native's Hermes engine (`crypto.subtle`). Nonce stored alongside the ciphertext in the file (as `{ nonce: base64, ciphertext: base64 }`).

**`CredentialRepositoryConcrete`**:
- `save(credential)`: serialise to JSON → encrypt → write to `yaid_credential.enc`
- `load()`: read file → decrypt → parse → construct `Credential` entity
- `delete()`: `FileSystem.deleteAsync(path, { idempotent: true })` + delete encryption key from Keychain
- `exists()`: checks file existence without reading

**Credential stored EXACTLY as received** (FR-021, API contract §4.1.1): the `raw` field is the verbatim API response JSON string. The entity's other fields (`vcId`, `issuedAt`, `holder`, `ageOver18`) are extracted once on receipt and stored as metadata.

---

## 4. Duas formas de erro da API

**Decision**: `YaIDApiConcrete` reads errors with a tolerant reader that handles both Form A (string) and Form B (object) without relying on the `code` field.

**Source**: ARCHITECTURE.md §11.5 and API contract §7.

```typescript
function readErrorMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const e = (body as any).error;
    if (typeof e === 'string') return e;               // Form A
    if (typeof e === 'object' && 'message' in e) return e.message;  // Form B
  }
  return 'Erro desconhecido';
}
```

**Clock-skew detection**: If the error message equals `'Request expired'` (from the auth middleware), the concrete maps this to a `RequestExpiredError` with `isClockSkew: true`. The controller then produces a result with `cause: 'clock_skew'`, and the entry adapter shows the specific clock message (ARCHITECTURE.md §11.1).

---

## 5. Assinatura DID e assinatura de corpo

**Decision**: `YaIDApiConcrete.issueCredential()` is responsible for computing both the DID-auth signature and the body signature. The interface receives `seed: Uint8Array` for this purpose.

**Rationale**: The body signature payload is `` `${documentImage}:${proofType}` `` where `proofType` is the WIRE-FORMAT camelCase value (`ageOver18`), per API contract §3. The use case operates with canonical domain values (`ProofType.AgeOver18`). Placing all wire-format conversion AND both signature computations in `YaIDApiConcrete` keeps the use case free of protocol concerns (ARCHITECTURE.md §11.4: "conversion lives exclusively in the HTTP adapter").

**Signing in `YaIDApiConcrete.issueCredential()`**:
1. `timestamp = clock.nowSeconds().toString()`
2. `authPayload = `${timestamp}:POST:/api/credentials/issue``
3. `authSig = ed25519.sign(authPayload, seed)` → base64url
4. `wirePT = proofType === ProofType.AgeOver18 ? 'ageOver18' : 'personhood'`
5. `bodySig = ed25519.sign(`${documentImage}:${wirePT}`, seed)` → base64url
6. HTTP POST with three auth headers + JSON body

**Fixed-vector test requirement**: test with known seed → verify `authSig` and `bodySig` match expected values from a reference Ed25519 implementation. Located in `issue_credential_usecase.test.ts` (which calls `YaIDApiMock` but tests the signing through the concrete in a separate integration test) OR as a standalone function test in `yaid_api_concrete.test.ts`.

---

## 6. Grafia de `proofType` nas duas rotas

**Source**: ARCHITECTURE.md §11.4 and API contract §4.1, §4.2.

| Rota | Campo | Grafia | Enum canônico |
|---|---|---|---|
| `POST /api/credentials/issue` | `proofType` no body | `ageOver18` (camelCase) | `ProofType.AgeOver18` |
| `GET /api/proof-sessions/{t}` | `proofType` na resposta | `age_over_18` (snake_case) | `ProofType.AgeOver18` |

Conversion is internal to `YaIDApiConcrete`. No other file knows about the two spellings.

---

## 7. Fluxo de retentativa sem nova senha (FR-027)

**Decision**: The entry adapter (`capture-document.tsx`) tracks a "session authenticated" boolean in its local state. After the first successful PIN verification, this flag is set. The "Tentar de novo" button on the failure screen restarts from the explanation step but checks `sessionAuthenticated` — if true, skips PIN and camera permission request.

**Rationale**: FR-027: "Retry must restart from the explanation screen without requiring the PIN again in the same session." The PIN was verified at the start of the session. A processing failure does not revoke authentication.

**Security note**: The "session authenticated" flag lives only in the React component state of `capture-document.tsx` (in-memory, non-persistent). Closing the app clears it. On reopening, the full flow — including PIN — is required again. This satisfies T7 (no state between screens) because the state is component-internal, not a global store.
