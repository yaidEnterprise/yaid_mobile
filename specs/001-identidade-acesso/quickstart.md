# Quickstart — Validação D1: Identidade e Acesso

**Branch**: `001-identidade-acesso` | **Date**: 2026-08-02

Descreve como validar que D1 funciona — testes automatizados (Node, sem simulador) e validação manual (development build).

---

## Pré-requisitos

- `EXPO_PUBLIC_STAGE=test` para testes automatizados
- `EXPO_PUBLIC_STAGE=dev` para validação manual
- Node.js com suporte a TypeScript (`tsx` ou Bun)
- Development build instalado no aparelho ou simulador (validação manual)

---

## 1. Testes automatizados (Node, sem simulador)

```bash
# Todos os testes de D1
npx tsx --test tests/modules/identity/app/create_identity_usecase.test.ts
npx tsx --test tests/modules/identity/app/create_identity_viewmodel.test.ts
npx tsx --test tests/modules/identity/app/create_identity_controller.test.ts
npx tsx --test tests/modules/access/app/define_pin_usecase.test.ts
npx tsx --test tests/modules/access/app/define_pin_viewmodel.test.ts
npx tsx --test tests/modules/access/app/define_pin_controller.test.ts

# Fakes e contratos de interfaces
npx tsx --test tests/shared/infra/providers/mock/identity_repository_mock.test.ts
npx tsx --test tests/shared/infra/providers/mock/pin_lock_mock.test.ts
npx tsx --test tests/shared/infra/providers/mock/signer_mock.test.ts
npx tsx --test tests/shared/infra/providers/mock/randomness_mock.test.ts
npx tsx --test tests/shared/infra/providers/mock/clock_mock.test.ts
```

### O que cada arquivo cobre

**`create_identity_usecase.test.ts`**:
- Caso de sucesso: RandomnessMock retorna seed fixo → PublicKey derivada → DID correto
- **Vetor fixo obrigatório**: seed de 32 zeros → publicKey esperada → DID `did:yaid:user:<hex64>` esperado (impede regressão silenciosa — ver [ARCHITECTURE.md §13](../../docs/ARCHITECTURE.md))
- IdentityRepository já tem identidade → `IdentityAlreadyExistsError` (ou clear + overwrite, conforme decisão de implementação)
- Falha no save → `IdentityCreationFailedError` visível, não silenciosa

**`create_identity_viewmodel.test.ts`**:
- Output contém apenas `{ did: string }` — `seed` e `publicKey` AUSENTES no output

**`define_pin_usecase.test.ts`**:
- PIN e confirmação iguais, não óbvios → `PinLock.initialize()` chamado
- PIN ≠ confirmação → `PinMismatchError`
- PIN óbvio (todos iguais: `111111`) → `PinObviousError`
- PIN óbvio (sequência crescente: `123456`) → `PinObviousError`
- PIN óbvio (sequência decrescente: `987654`) → `PinObviousError`
- PIN não-óbvio (`112233`) → aceito

**`pin_lock_mock.test.ts`** (contrato do fake):
- `initialize → verify(certo) → resolve`
- `verify(errado)` × 4 → `PinWrongError { attemptsRemaining: 1 }`
- `verify(errado)` 5ª vez → `PinBackoffActiveError { lockedUntilMs }`
- `verify()` durante bloqueio → `PinBackoffActiveError`
- `ClockMock.advance(60_001)` → verify(certo) → resolve
- 2º lockout: duração > 1 min (escalação)
- **Regressão**: `IdentityRepository.exists()` = true antes e depois de qualquer número de erros de PIN

---

## 2. Validação manual — development build

### 2.1 Primeiro uso completo (US 1)

**Setup**: App recém-instalado, sem identidade.

**Passos**:
1. Abrir o app → ver tela de boas-vindas (não pede senha)
2. Tocar em "Começar"
3. Digitar 6 dígitos como senha
4. Repetir os 6 dígitos para confirmar
5. Observar a tela inicial

**Esperado**:
- Tela de boas-vindas exibida sem exigir senha (FR-027) ✓
- Após confirmação da senha, chegar à tela inicial em < 1 segundo, sem indicador de carregamento (SC-003) ✓
- Tela inicial mostra "identidade com identidade, sem credencial" com ação para verificar documento (FR-029) ✓
- Fechar e reabrir → volta à tela inicial na mesma forma, nunca às boas-vindas (FR-006, SC-005) ✓

### 2.2 Confirmação de senha não coincide (US 1, cenário 3)

**Passos**: Na tela de PIN, digitar `123456`, confirmar com `234567`

**Esperado**:
- Mensagem neutra informando que os dígitos não coincidem ✓
- Pode tentar a confirmação novamente sem apagar o primeiro PIN (FR-012) ✓

### 2.3 Senha óbvia recusada (FR-014)

**Passos**: Tentar `000000`, depois `123456`, depois `987654`

**Esperado**:
- Todas recusadas com explicação do motivo ✓
- Permite escolher outra combinação ✓

### 2.4 Primeiro uso sem rede (SC-002)

**Setup**: Ativar modo avião antes de abrir o app.

**Esperado**:
- Fluxo completo conclui sem nenhuma mensagem de erro de conexão (SC-002) ✓
- Identidade criada e persiste após reabrir o app ✓

### 2.5 Verificação de senha — tentativas e bloqueio (US 2)

**Nota**: A tela de senha é invocada por D2/D3/D4. Para testar isoladamente em D1, use um protótipo ou entrada de teste que a chame diretamente.

**Passos**:
1. Invocar a tela de senha
2. Digitar senha errada 4 vezes → observar tentativas restantes decrescendo
3. Digitar senha errada pela 5ª vez → observar bloqueio com tempo exibido
4. Fechar e reabrir o app → bloqueio ainda ativo pelo tempo restante (FR-023) ✓
5. Aguardar expiração → digitar senha correta → acesso liberado ✓

**Esperado**:
- Cada erro informa quantas tentativas restam (FR-019, SC-008) ✓
- Bloqueio informa tempo de espera (FR-022, SC-008) ✓
- Identidade intacta após qualquer número de erros (FR-025, SC-006) ✓

---

## 3. Cross-checks de invariante

| Invariante | Como verificar |
|---|---|
| Seed não chega à tela | Inspecionar estado do React DevTools — campo `seed` não deve aparecer em nenhum estado de componente |
| Zero requisições de rede em D1 | Habilitar modo avião e percorrer o fluxo completo — nenhuma mensagem de erro de rede (SC-007) |
| Identidade sobrevive ao reinício do aparelho | Criar identidade, reiniciar o aparelho, reabrir → tela inicial mostra "com identidade, sem credencial" (SC-005) |
| Lockout sobrevive ao fechamento do app | Bloquear PIN, fechar app, reabrir → bloqueio ainda ativo pelo tempo restante (FR-023) |

---

## 4. Referências

- Entidades e interfaces: [data-model.md](./data-model.md)
- Contrato do IIdentityRepository: [contracts/identity_repository.md](./contracts/identity_repository.md)
- Contrato do IPinLock: [contracts/pin_lock.md](./contracts/pin_lock.md)
- Decisões de design: [research.md](./research.md)
- Regras de arquitetura: [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
