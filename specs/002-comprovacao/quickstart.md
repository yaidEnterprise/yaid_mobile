# Quickstart — Validação D2: Comprovação

**Branch**: `002-comprovacao` | **Date**: 2026-08-02

---

## Pré-requisitos

- D1 completo e funcional (identidade criada, PIN definido)
- `EXPO_PUBLIC_STAGE=test` para testes automatizados
- `EXPO_PUBLIC_STAGE=dev` + conexão com a API YaID em dev para validação manual
- Development build instalado

---

## 1. Testes automatizados (Node, sem simulador)

```bash
# Módulo de credencial
npx tsx --test tests/modules/credential/app/issue_credential_usecase.test.ts
npx tsx --test tests/modules/credential/app/issue_credential_viewmodel.test.ts
npx tsx --test tests/modules/credential/app/issue_credential_controller.test.ts

# DTO e mapeadores
npx tsx --test tests/shared/infra/dto/issue_credential_dto.test.ts

# Contratos dos fakes
npx tsx --test tests/shared/infra/repositories/mock/credential_repository_mock.test.ts
npx tsx --test tests/shared/infra/providers/mock/yaid_api_mock.test.ts
```

### O que cada arquivo cobre

**`issue_credential_usecase.test.ts`**:
- Caso de sucesso: PIN correto → imagem comprimida → API retorna credencial → credencial salva
- **Vetor fixo obrigatório**: seed fixo + imagem base64 fixo → `bodySignature` esperado (`ed25519.sign("${image}:personhood", seed)`)
- PIN errado → `PinWrongError` propagado; nenhuma chamada à API
- `IPinLock.verify()` é a PRIMEIRA operação — `IDocumentCapture` e `IYaIDApi` nunca chamados quando PIN falha
- `IYaIDApi.issueCredential()` falha → `IssuanceApiError` propagado; `ICredentialRepository.save()` NÃO chamado (FR-026)
- Cada causa de erro da API (`clock_skew`, `document_unreadable`, `server_unavailable`, `no_connection`) → erro tipado correto
- `CredentialRepository.save()` chamado exatamente uma vez no caminho de sucesso

**`issue_credential_viewmodel.test.ts`**:
- Output contém apenas `{ ageOver18: boolean, issuedAt: Date }` — `vcId`, `raw`, `holder`, `seed` AUSENTES

**`issue_credential_dto.test.ts`**:
- VC JSON com `claims.personhood: true` (sem ageOver18) → `credential.ageOver18 = true` (default)
- VC JSON com `claims.ageOver18: false` → `credential.ageOver18 = false`
- `credential.raw` é idêntico à string original, byte a byte

**`credential_repository_mock.test.ts`**: ver [contracts/credential_repository.md](./contracts/credential_repository.md) para os casos.

---

## 2. Validação manual — development build

### 2.1 Comprovação bem-sucedida (US 1)

**Setup**: App com identidade criada, sem credencial. Conexão ativa com API YaID (dev).

**Passos**:
1. Tela inicial → tocar em "Verificar meu documento"
2. Ler a tela de explicação → prosseguir
3. Digitar o PIN correto
4. Enquadrar um documento de identidade físico na câmera → capturar
5. Revisar a foto → tocar em "Enviar"
6. Aguardar a tela de resultado de sucesso
7. Retornar à tela inicial

**Esperado**:
- Tela de explicação exibida SEM pedir senha (FR-003) ✓
- PIN pedido ANTES de abrir a câmera (FR-006, SC-006) ✓
- Tela de envio com texto descritivo enquanto a API processa (FR-017) ✓
- Tela de resultado de sucesso (tela dedicada, não toast) ✓
- Tela inicial mostra terceira forma: "documento sem dados" com `ageOver18` e data (FR-023) ✓
- Zero fotos salvas no armazenamento do aparelho (SC-003) ✓

### 2.2 Repetir foto (US 2)

**Passos**: Na tela de revisão, tocar em "Repetir"

**Esperado**: Câmera reabre; pode capturar nova foto sem penalidade (FR-015) ✓

### 2.3 Falha no processamento (US 3)

**Setup**: Enviar uma foto propositalmente ilegível (papel em branco) OU simular falha via fake.

**Esperado**:
- Tela de resultado de falha com mensagem que nomeia o problema (FR-025, SC-005) ✓
- Tela inicial ainda mostra "sem credencial" — nenhuma credencial parcial (FR-026, SC-002 invertido) ✓
- "Tentar de novo" retorna à tela de explicação SEM pedir PIN novamente (FR-027) ✓

### 2.4 Permissão de câmera negada (US 4)

**Setup**: Revogar a permissão de câmera nas configurações do sistema antes do teste.

**Esperado**:
- Tela de explicação sobre necessidade da câmera com botão "Abrir ajustes" (FR-009) ✓
- Após conceder a permissão e voltar ao app, câmera abre normalmente (FR-009) ✓

### 2.5 Relógio errado (edge case)

**Setup**: Defasar o relógio do aparelho em > 5 minutos.

**Esperado**:
- Mensagem específica orientando a ajustar a data/hora (FR-028, ARCHITECTURE.md §11.1) ✓
- Mensagem NÃO é genérica ("algo deu errado") ✓

---

## 3. Cross-checks de invariante

| Invariante | Como verificar |
|---|---|
| PIN verificado antes de qualquer chamada de rede | Inspecionar tráfego de rede — zero requests antes do step de PIN (SC-006) |
| Opção de galeria nunca aparece | Inspecionar todos os pontos do fluxo — nenhum botão de galeria (SC-007) |
| Foto não persiste no armazenamento | Após envio, verificar que nenhuma foto nova aparece na galeria do dispositivo (SC-003) |
| Credencial `ageOver18: false` sem cor vermelha | Testar com menor de 18 anos (ou simular via fake) — cor neutra (FR-024, SC-008) |

---

## 4. Referências

- Entidades e interfaces: [data-model.md](./data-model.md)
- Contrato do ICredentialRepository: [contracts/credential_repository.md](./contracts/credential_repository.md)
- Contrato do IYaIDApi.issueCredential: [contracts/yaid_api_issue.md](./contracts/yaid_api_issue.md)
- Decisões de design: [research.md](./research.md)
- Rota da API: [MOBILE-API-CONTRACT.md](../../docs/MOBILE-API-CONTRACT.md) §4.1
