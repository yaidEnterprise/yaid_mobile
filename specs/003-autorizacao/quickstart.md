# Quickstart — Validação D3: Autorização

**Branch**: `003-autorizacao` | **Date**: 2026-08-02

---

## Pré-requisitos

- D1 e D2 completos e funcionais (identidade criada, credencial emitida)
- `EXPO_PUBLIC_STAGE=test` para testes automatizados
- `EXPO_PUBLIC_STAGE=dev` + development build instalado para validação manual
- Expo Go **não** é suficiente — Universal Links / App Links requerem development build (ARCHITECTURE.md T1.1)

---

## 1. Testes automatizados (Node, sem simulador)

```bash
# Módulo proof-session
npx tsx --test tests/modules/proof-session/app/get_proof_session_usecase.test.ts
npx tsx --test tests/modules/proof-session/app/get_proof_session_viewmodel.test.ts
npx tsx --test tests/modules/proof-session/app/get_proof_session_controller.test.ts
npx tsx --test tests/modules/proof-session/app/cancel_proof_session_usecase.test.ts
npx tsx --test tests/modules/proof-session/app/cancel_proof_session_controller.test.ts

# Módulo presentation (inclui vetor fixo obrigatório)
npx tsx --test tests/modules/presentation/app/present_proof_usecase.test.ts
npx tsx --test tests/modules/presentation/app/present_proof_viewmodel.test.ts
npx tsx --test tests/modules/presentation/app/present_proof_controller.test.ts

# DTO
npx tsx --test tests/shared/infra/dto/proof_session_dto.test.ts
```

### O que cada arquivo cobre

**`get_proof_session_usecase.test.ts`**:
- Sessão `waiting_user` + credencial elegível → ProofSession retornado, `canDecide: true`
- Sessão `waiting_user` + credencial `ageOver18: false` + proofType `age_over_18` → `SessionIneligibleError`
- Sessão `opened` → `SessionExpiredError` (sessão irrecuperável; challenge nunca chamado)
- Sessão `expired` → `SessionExpiredError`
- Sessão não encontrada → `SessionNotFoundError`
- **Invariante de elegibilidade**: `IYaIDApi.getChallenge` NUNCA é chamado dentro deste use case (é responsabilidade de `PresentProofUseCase`)
- `ICredentialRepository.exists()` retorna `false` → `SessionIneligibleError` (sem credencial = inelegível para qualquer tipo)

**`cancel_proof_session_usecase.test.ts`**:
- Sucesso → resolve void; `IYaIDApi.cancelProofSession` chamado uma vez
- `IYaIDApi.cancelProofSession` lança → use case ainda resolve void (best-effort)
- **`IPinLock.verify()` NUNCA chamado** — regra de recusa sem PIN (research.md §6)

**`present_proof_usecase.test.ts`** (testes mais críticos do produto):

*Vetor fixo obrigatório*:
```typescript
// Seed e nonce determinísticos
const SEED   = new Uint8Array(32).fill(7);   // qualquer seed fixo documentado
const NONCE  = 'fixed-nonce-for-test';
const RAW_VC = '{"id":"vc-1","type":["VerifiableCredential"],"credentialSubject":{}}';

// Montagem esperada do vpBody
const vpBody = JSON.stringify({
  holder:               `did:yaid:user:${expectedHex(SEED)}`,
  challenge:            NONCE,
  verifiableCredential: [JSON.parse(RAW_VC)],
});
// Assinatura esperada usando @noble/ed25519 (linha de referência)
const expectedSig = await ed25519.sign(new TextEncoder().encode(vpBody), SEED);
const expectedB64 = base64url(expectedSig);

// Assert: o VP enviado para IYaIDApi.verifyPresentation tem proof.signatureValue === expectedB64
```

*Sequência PIN → challenge*:
- `IPinLock.verify()` lança `PinWrongError` → `IYaIDApi.getChallenge` **não é chamado**; use case propaga `PinWrongError`
- `IPinLock.verify()` lança `PinBackoffActiveError` → `IYaIDApi.getChallenge` **não é chamado**
- `IYaIDApi.getChallenge` lança `AuthClockSkewError` → `AuthClockSkewError` propagado; `verifyPresentation` não chamado
- `IYaIDApi.verifyPresentation` retorna `{ valid: false }` → `PresentationRejectedError` propagado
- Caminho de sucesso → `{ ok: true, verifiedAt: Date }`

**`proof_session_dto.test.ts`**:
- `proofType: 'age_over_18'` → `ProofType.AgeOver18`
- `proofType: 'personhood'` → `ProofType.Personhood`
- `status: 'opened'` → `ProofSessionStatus.Opened`
- `expiresAt` string ISO → `Date` corretamente

---

## 2. Validação manual — development build

### 2.1 Autorização bem-sucedida — personhood (US 1)

**Setup**: App com identidade e credencial. Sessão ativa e válida no servidor de dev.

**Passos**:
1. Abrir o link `yaid://verify?session=<token>` (via QR code ou link compartilhado)
2. Aguardar a tela de decisão (nome da empresa + tipo de prova exibidos)
3. Tocar em "Autorizar"
4. Digitar o PIN correto na tela de PIN
5. Aguardar processamento (tela de loading com texto descritivo)
6. Ver tela de resultado "Verificado"

**Esperado**:
- Tela de decisão renderizada sem PIN (PIN só pedido após o toque em Autorizar) ✓
- Botões inertes por ~400 ms após o toque (FR-016) ✓
- Gesto de voltar desabilitado na tela de decisão (FR-019) ✓
- Tela de loading com texto descritivo durante challenge + submissão (FR-030) ✓
- Tela dedicada "Verificado" (não um toast) ✓

### 2.2 Recusa (US 2)

**Passos**: Na tela de decisão, tocar em "Recusar".

**Esperado**:
- Sem solicitação de PIN ✓
- Sessão cancelada no servidor (verificar via API admin) ✓
- Tela de resultado "Recusado" (tela dedicada) ✓

### 2.3 Inelegível — maioridade (US 3)

**Setup**: Identidade com credencial `ageOver18: false`; sessão de tipo `age_over_18`.

**Esperado**:
- Tela de inelegibilidade exibida IMEDIATAMENTE (sem tela de decisão) ✓
- Zero chamadas ao endpoint de challenge (verificar via tráfego de rede) ✓

### 2.4 Sessão expirada

**Setup**: Usar um token de sessão com `expiresAt` no passado.

**Esperado**: Tela de "Expirado" ao entrar na tela ✓

### 2.5 PIN errado no fluxo de autorização

**Setup**: Sessão válida. Tocar em Autorizar → digitar PIN errado.

**Esperado**:
- Tela de PIN mostra erro com `attemptsRemaining` ✓
- Nenhuma chamada de rede feita (zero tráfego além do possível retry de PIN) ✓
- PIN pode ser tentado novamente na mesma sessão (FR-027: "sem re-PIN" refere-se à lógica de retry; o PIN é necessário uma vez por decisão de autorização)

### 2.6 Retorno ao primeiro plano com sessão expirada

**Setup**: Sessão quase expirada. Abrir o link → ver tela de decisão → pressionar home → aguardar expiração → retornar ao app.

**Esperado**:
- Na volta ao primeiro plano, re-consulta de sessão disparada automaticamente ✓
- Tela de "Expirado" exibida se sessão não está mais em `waiting_user` ✓

### 2.7 Erro de relógio (edge case)

**Setup**: Defasar o relógio do aparelho em > 5 minutos.

**Passos**: Autorizar → PIN correto → challenge retorna 401 "Request expired".

**Esperado**:
- Tela "Falhou" com mensagem específica: "A data e a hora do seu celular parecem incorretas" ✓
- Tela de resultado (não tentativa automática de retry) ✓

---

## 3. Cross-checks de invariante

| Invariante | Como verificar |
|---|---|
| Challenge nunca chamado antes da decisão | Monitor de rede: nenhuma request para `/challenge` ao abrir a tela de decisão |
| Challenge nunca chamado quando PIN falha | Monitor de rede: nenhuma request para `/challenge` após erro de PIN |
| PIN não exigido para recusa | Fluxo de recusa sem tela de PIN (§2.2) |
| ProofSession nunca persistida | Fechar o app durante a sessão — ao reabrir, volta para a tela inicial sem rastros |
| Sessão `opened` tratada como expirada | Re-fetch enquanto sessão está em `opened` → tela de expirado |

---

## 4. Referências

- Entidades e interfaces: [data-model.md](./data-model.md)
- Contratos dos 4 métodos D3: [contracts/yaid_api_d3.md](./contracts/yaid_api_d3.md)
- Decisões de design (VP assembly, elegibilidade, PIN order): [research.md](./research.md)
- Plano de implementação: [plan.md](./plan.md)
- Rota da API: [MOBILE-API-CONTRACT.md](../../docs/MOBILE-API-CONTRACT.md) §4.2–4.5
