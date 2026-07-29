# Contrato de Interface — App Mobile ↔ API YaID

> **O que é este documento.** A especificação exata da fronteira entre o YaID Wallet e a API YaID:
> rotas, métodos, headers, formatos de corpo e tipos de retorno. Cada afirmação aqui foi verificada
> contra o código em execução, com referência ao arquivo e linha de origem.
>
> **Estado de referência:** codebase em 2026-07-28, antes das Stories 5.7, 5.8 e do Epic 9.
> A §9 lista o que muda quando essas stories forem entregues.

---

## 1. Superfície de contato

Seis rotas. Cinco autenticadas por DID, uma pública.

| Método | Rota | Auth | Momento do fluxo |
|---|---|---|---|
| `POST` | `/api/credentials/issue` | DID | Comprovação |
| `POST` | `/api/credentials/revoke` | DID | Cancelamento da credencial |
| `GET` | `/api/proof-sessions/{sessionToken}` | **Pública** | Autorização — leitura de contexto |
| `GET` | `/api/proof-sessions/{sessionToken}/challenge` | DID | Autorização — obtenção do nonce |
| `POST` | `/api/presentations/verify` | DID | Autorização — envio da apresentação |
| `POST` | `/api/proof-sessions/{sessionToken}/cancel` | DID | Recusa da sessão |

O roteamento de autenticação é resolvido por prefixo em
[`src/shared/middleware.ts:31-45`](../src/shared/middleware.ts#L31-L45). Nenhuma outra rota da API
aceita autenticação por DID.

---

## 2. Autenticação por DID

Aplica-se às cinco rotas marcadas como `DID`. Implementação em
[`src/shared/middlewares/withDIDAuth.ts`](../src/shared/middlewares/withDIDAuth.ts).

### 2.1 Headers obrigatórios

| Header | Formato | Observação |
|---|---|---|
| `X-YaID-DID` | `did:yaid:user:<hex>` | `hex` = 64 caracteres, **minúsculos**. Regex do servidor: `/^[0-9a-f]{64}$/` ([:44](../src/shared/middlewares/withDIDAuth.ts#L44)). Maiúsculas são rejeitadas. |
| `X-YaID-Timestamp` | Unix em **segundos**, inteiro, como string | Rejeitado se não for inteiro ([:31](../src/shared/middlewares/withDIDAuth.ts#L31)). Milissegundos quebram a janela. |
| `X-YaID-Signature` | base64url **sem padding**, 64 bytes decodificados | Tamanho verificado antes da criptografia ([:66](../src/shared/middlewares/withDIDAuth.ts#L66)). |

Os três são exigidos em conjunto — a ausência de qualquer um produz o mesmo erro.

### 2.2 Payload canônico da assinatura

```
{timestamp}:{MÉTODO}:{pathname}
```

Concatenação literal, sem espaços, assinada com Ed25519 pela chave privada do holder
([:51-55](../src/shared/middlewares/withDIDAuth.ts#L51-L55)).

Três armadilhas que produzem `401 Invalid signature` sem diagnóstico:

- **`{timestamp}` é a string exata enviada no header**, não o número reinterpretado. O servidor
  monta o payload com `tsHeader` bruto. Se o app enviar `"01712345678"`, precisa assinar
  `"01712345678"`.
- **`{MÉTODO}` em maiúsculas.** O servidor usa `request.method`, sempre maiúsculo em Next.js.
  Note que o challenge é `GET` — assinar `POST` ali é o erro mais comum.
- **`{pathname}` sem query string e sem barra final.** Vem de `request.nextUrl.pathname`. Para o
  challenge, inclui o token: `/api/proof-sessions/<token>/challenge`.

### 2.3 Janela de validade

**±5 minutos** (300 000 ms), comparada contra o relógio do servidor
([:31](../src/shared/middlewares/withDIDAuth.ts#L31)). É simétrica: um relógio adiantado falha
igual a um atrasado. O app deve tratar `Request expired` como sinal para conferir o relógio do
aparelho, não como erro de rede.

### 2.4 Erros de autenticação

Todos `401`, com corpo `{ "error": "<mensagem>" }` — **string simples**, não objeto (ver §7).

| Mensagem | Causa |
|---|---|
| `Missing auth headers` | Um ou mais dos três headers ausente |
| `Request expired` | Timestamp fora de ±5 min, ou não inteiro |
| `Invalid DID` | Formato do DID fora de `did:yaid:user:<hex64 minúsculo>` |
| `Invalid signature` | base64url inválido, tamanho ≠ 64 bytes, ou verificação Ed25519 falhou |

### 2.5 O que a autenticação por DID **não** faz

Passada a verificação, o middleware injeta o header interno `x-holder-did` e segue
([:83-86](../src/shared/middlewares/withDIDAuth.ts#L83-L86)). Duas consequências relevantes para o
design do app:

- **`challenge` e `cancel` não vinculam o DID à sessão.** Nenhum dos dois use cases lê o
  `holderDid`. Qualquer identidade válida que possua o `sessionToken` consegue abrir ou cancelar a
  sessão. O vínculo holder↔sessão só é verificado em `presentations/verify` (Regra 6:
  `vc.holder === holderDid`).
- **A assinatura do header não cobre o corpo.** Ela cobre apenas `{ts}:{método}:{path}`. A
  integridade do corpo vem do `bodySignature` (§3), quando existe.

---

## 3. Assinaturas de corpo (`bodySignature`)

Duas rotas exigem uma segunda assinatura, sobre o conteúdo. Mesma chave, mesmo algoritmo, mesma
codificação (Ed25519, base64url sem padding).

| Rota | Payload assinado | Origem |
|---|---|---|
| `POST /api/credentials/issue` | `` `${documentImage}:${proofType}` `` | [issue_credential_usecase.ts:83](../src/modules/credential/app/issue_credential_usecase.ts#L83) |
| `POST /api/credentials/revoke` | `` `${vcId}` `` — sem separador, sem prefixo | [revoke_credential_usecase.ts:39](../src/modules/credential/app/revoke_credential_usecase.ts#L39) |

`documentImage` entra no payload **na íntegra** — é a mesma string base64 enviada no corpo. Assinar
um hash da imagem, ou a imagem antes da compressão, produz `401`.

---

## 4. Contrato rota a rota

### 4.1 `POST /api/credentials/issue`

Comprovação. Registra o DID on-chain e devolve a credencial.

**Auth:** DID · **Content-Type:** `application/json`

**Corpo** ([issue_credential_viewmodel.ts](../src/modules/credential/app/issue_credential_viewmodel.ts)):

```jsonc
{
  "documentImage": "string, base64 puro, sem prefixo data:",
  "proofType": "personhood" | "ageOver18",   // camelCase nesta rota — ver §8.2
  "bodySignature": "string, base64url"
}
```

**Respostas:**

| Código | Corpo | Situação |
|---|---|---|
| `201` | Objeto VC (§4.1.1) | Sucesso |
| `401` | `{ "error": "Invalid DID" \| "Invalid signature" }` | DID malformado ou `bodySignature` inválida |
| `422` | `{ "error": "Document processing failed" }` | OCR falhou, `proofType` desconhecido, **ou holder menor de 18 no ramo `ageOver18`** |
| `502` | `{ "error": "Blockchain registration failed" }` | `registerDID` falhou |
| `400` | `{ "error": { "code": "VALIDATION_ERROR", ... } }` | Corpo fora do schema — **formato de objeto** |

**4.1.1 Formato da VC (hoje)** — objeto JSON, não JWT:

```jsonc
{
  "id": "uuid",
  "type": ["VerifiableCredential"],
  "issuer": "did:yaid:issuer:<hex64>",
  "holder": "did:yaid:user:<hex64>",
  "issuedAt": "ISO 8601",
  "claims": { "personhood": true },          // UMA claim só — ver §9
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "ISO 8601",
    "verificationMethod": "<issuerDid>#key-1",
    "proofPurpose": "assertionMethod",
    "signatureValue": "base64url"
  }
}
```

O app deve **guardar a credencial exatamente como recebida**. A assinatura do issuer cobre
`JSON.stringify({id, type, issuer, holder, issuedAt, claims})` nessa ordem de chaves; qualquer
reserialização quebra a verificação posterior.

### 4.2 `GET /api/proof-sessions/{sessionToken}`

Contexto da sessão. **Rota pública** — não envie headers de DID.

**Auth:** nenhuma, apenas posse do token ([middleware.ts:32](../src/shared/middleware.ts#L32))

**Resposta `200`** ([get_proof_session_viewmodel.ts](../src/modules/proof-session/app/get_proof_session_viewmodel.ts)):

```jsonc
{
  "status": "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled",
  "proofType": "personhood" | "age_over_18",   // snake_case nesta rota — ver §8.2
  "companyName": "string",
  "expiresAt": "ISO 8601"
}
```

| Código | Corpo | Situação |
|---|---|---|
| `404` | `{ "error": { "code": "PROOF_SESSION_NOT_FOUND", "message": "Session not found" } }` | Token inválido ou inexistente |

Chamar esta rota **não altera estado** — é seguro consultá-la quantas vezes for preciso. A única
exceção: se a sessão já passou do `expiresAt` sem ter sido marcada, a consulta sincroniza o status
para `expired` e dispara o webhook da empresa
([get_proof_session_usecase.ts:27-45](../src/modules/proof-session/app/get_proof_session_usecase.ts#L27-L45)).

> Esta é a rota que responde "quem está pedindo e o quê". Deve ser chamada **antes** de exibir
> qualquer tela de decisão e antes de pedir o challenge.

### 4.3 `GET /api/proof-sessions/{sessionToken}/challenge`

Obtém o nonce. **Método `GET`, mas altera estado.**

**Auth:** DID · **Sem corpo**

**Resposta `200`:**

```jsonc
{ "nonce": "base64url de 32 bytes aleatórios" }
```

Efeitos colaterais ([challenge_proof_session_usecase.ts](../src/modules/proof-session/app/challenge_proof_session_usecase.ts)):
`proof_session` → `opened`, `proof_request` → `processing`, e `challenge_created_at` passa a contar.
O nonce bruto é exposto **uma única vez** — o servidor guarda apenas o SHA-256.

| Código | Corpo | Situação |
|---|---|---|
| `422` | `{ "error": { "code": ..., "message": "Session not in waiting_user state" } }` | Challenge já pedido, ou sessão expirada/terminal |
| `404` | objeto | Token inválido |

**Validade do challenge: 10 minutos**, independente do `expiresAt` da sessão (30 min)
([verify_presentation_usecase.ts:73](../src/modules/presentation/app/verify_presentation_usecase.ts#L73)).
São dois relógios distintos — o app deve tratar o de 10 min como o prazo real para concluir a
autorização.

Como a operação é irreversível, o app só deve chamá-la **depois** de a pessoa decidir autorizar.
Pedir o challenge na abertura da tela queima a sessão se ela desistir.

### 4.4 `POST /api/presentations/verify`

Envia a apresentação.

**Auth:** DID · **Content-Type:** `application/json`

**Corpo** ([verify_presentation_viewmodel.ts](../src/modules/presentation/app/verify_presentation_viewmodel.ts)):

```jsonc
{
  "vp": { /* OBJETO JSON — o schema é z.record, string é rejeitada */ },
  "sessionToken": "string"
}
```

**Formato da VP (hoje):**

```jsonc
{
  "holder": "did:yaid:user:<hex64>",
  "challenge": "<nonce recebido>",
  "verifiableCredential": [ /* a VC inteira, exatamente como recebida */ ],
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "ISO 8601",
    "verificationMethod": "<holderDid>#key-1",
    "proofPurpose": "authentication",
    "signatureValue": "base64url"
  }
}
```

> **A ordem das chaves importa.** O servidor reserializa
> `JSON.stringify({holder, challenge, verifiableCredential})` **nessa ordem exata**, sem o `proof`,
> e verifica a assinatura contra o resultado
> ([:146-150](../src/modules/presentation/app/verify_presentation_usecase.ts#L146-L150)). O app deve
> montar o objeto nessa ordem, assinar, e só então acrescentar o `proof`. Em linguagens cujo
> serializador JSON não preserva ordem de inserção, isso exige serialização manual.

**Respostas:**

| Código | Corpo | Situação |
|---|---|---|
| `200` | `{ "valid": true }` | Todas as 11 regras passaram |
| `200` | `{ "valid": false }` | **Qualquer** falha — sessão inválida, assinatura errada, VC revogada, DID não registrado, nonce divergente, challenge expirado |
| `401` | `{ "error": "Missing holder DID" }` | Header ausente |

> **`valid: false` chega com HTTP 200 e sem motivo.** É deliberado: não vaza qual regra falhou. O
> app não consegue distinguir "nonce expirado" de "credencial revogada" — a mensagem ao usuário
> precisa ser genérica, e a recuperação é sempre "recomeçar a sessão". Além disso, **a falha é
> terminal**: a `proof_request` transiciona para `rejected` e o webhook da empresa dispara. Não há
> segunda tentativa na mesma sessão.

### 4.5 `POST /api/proof-sessions/{sessionToken}/cancel`

Recusa da sessão pela pessoa. **Esta rota existe e está implementada.**

**Auth:** DID · **Sem corpo**

| Código | Corpo | Situação |
|---|---|---|
| `200` | `{ "cancelled": true }` | Sessão cancelada; `proof_request` → `rejected` |
| `401` | `{ "error": "Missing auth headers" }` | Header ausente |
| `422` | objeto | Sessão já em estado terminal |

### 4.6 `POST /api/credentials/revoke`

Cancelamento da credencial. Só o holder pode fazê-lo.

**Auth:** DID · **Content-Type:** `application/json`

```jsonc
{ "vcId": "o campo id da VC", "bodySignature": "assinatura de vcId" }
```

| Código | Corpo | Situação |
|---|---|---|
| `200` | `{ "revoked": true }` | Hash registrado on-chain |
| `401` | `{ "error": "Invalid signature" }` | Assinatura de `vcId` inválida |
| `502` | `{ "error": "Blockchain revocation failed" }` | Transação falhou |

Nenhuma tabela relacional é alterada — a revogação existe apenas na blockchain.

---

## 5. Máquina de estados da sessão

```
waiting_user ──GET /challenge──> opened ──POST /verify (valid)──> approved_by_user
     │                              │
     ├──POST /cancel──> cancelled ◄──┤
     │                              │
     └────── expiresAt ──> expired ◄─┘
```

O app só encontra `waiting_user` (recém-aberta pelo deep link) ou estados terminais (se o link for
reaberto depois). Encontrar `opened` significa que o challenge já foi consumido — a sessão não é
recuperável e o app deve orientar a pessoa a recomeçar pela empresa.

---

## 6. Sequência canônica da autorização

```
1. deep link  yaid://verify?session=<token>
2. GET  /api/proof-sessions/<token>              (público, idempotente)
      → companyName, proofType, expiresAt, status
3. [ tela de decisão — a pessoa autoriza ou recusa ]
      recusa → POST /api/proof-sessions/<token>/cancel   (DID) → fim
4. GET  /api/proof-sessions/<token>/challenge     (DID, IRREVERSÍVEL)
      → nonce · inicia janela de 10 min
5. [ monta e assina a VP ]
6. POST /api/presentations/verify                 (DID)
      → { valid: true | false } · terminal em ambos os casos
```

O passo 2 é o único ponto em que o app obtém contexto. Os passos 4 e 6 são irreversíveis e não
admitem repetição na mesma sessão.

---

## 7. Formato de erro — duas formas incompatíveis

A API responde erros em **dois formatos diferentes**, dependendo de onde o erro nasce. O cliente
precisa tolerar ambos.

**Forma A — string** (middleware de auth, guards de header nas rotas, e erros 401/422/502 das rotas
de credencial):

```jsonc
{ "error": "Invalid signature" }
```

**Forma B — objeto** ([handleHttpError.ts](../src/shared/http/handleHttpError.ts) — todo o resto,
incluindo erros de validação de schema):

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request payload", "issues": [...] } }
```

Distribuição concreta:

| Rota | 401 | 422 | 502 | 400 (schema) | 404 |
|---|---|---|---|---|---|
| `credentials/issue` | A | A | A | B | — |
| `credentials/revoke` | A | B | A | B | — |
| `proof-sessions/{t}` | — | — | — | — | B |
| `.../challenge` | A¹ | B | — | — | B |
| `.../cancel` | A | B | — | — | B |
| `presentations/verify` | A | — | — | B | — |

¹ vindo do middleware, antes de a rota executar.

**Recomendação para o app:** normalizar na camada HTTP com uma leitura tolerante —
`typeof body.error === "string" ? body.error : body.error?.message` — e nunca depender de `code`,
que só existe na forma B.

> A decisão registrada na arquitetura é `{ error: string }`. A forma B é drift acumulado e
> majoritário. Enquanto não houver unificação, o contrato real é "as duas".

---

## 8. Correções às questões em aberto da spec do app

Cinco dos nove itens partem de premissas que o código contradiz.

### 8.1 Itens que já estão resolvidos no código

| # | Afirmação na spec | Realidade |
|---|---|---|
| 1 | *"Cancelamento não existe na API YaID"* | **Existe.** `POST /api/proof-sessions/{token}/cancel`, auth por DID, devolve `{ cancelled: true }` (§4.5). Está roteada em [middleware.ts:41](../src/shared/middleware.ts#L41) e implementada em `cancel_proof_session_usecase`. |
| 6 | *"Janela de tolerância do timestamp não documentada"* | **É ±5 minutos**, simétrica, contra o relógio do servidor ([withDIDAuth.ts:31](../src/shared/middlewares/withDIDAuth.ts#L31)). Não estava escrito, mas é determinístico. |
| 5 | *"`bodySignature` sem timestamp/nonce → replayável"* | **Superestimado.** Reenviar a requisição exige um `X-YaID-Signature` novo sobre `{ts}:{método}:{path}`, e produzi-lo requer a chave privada do holder. Um terceiro que capture o tráfego **não** consegue replay após ±5 min, e dentro da janela precisaria do header original — que não cobre o corpo, mas cujo corpo tem assinatura própria. O resíduo real é o próprio holder poder reenviar o mesmo par `(documentImage, bodySignature)`, o que é inofensivo. Não é bloqueante para o app. |

### 8.2 Item novo, não mapeado: grafia divergente de `proofType`

O mesmo conceito chega ao app em **duas grafias**, dependendo da rota:

| Rota | Grafia |
|---|---|
| `POST /api/credentials/issue` (envio) | `personhood` \| **`ageOver18`** (camelCase) |
| `GET /api/proof-sessions/{token}` (recebimento) | `personhood` \| **`age_over_18`** (snake_case) |

Não é intercambiável: enviar `age_over_18` na emissão cai no `else` e retorna
**422 "Document processing failed"** — um erro de documento para o que é erro de contrato. O app
precisa de conversão explícita entre as duas formas.

Isto está endereçado nas Stories 5.7/5.8 (enum `ProofType` compartilhado), mas até lá o app deve
tratar as duas grafias como constantes distintas.

### 8.3 Itens confirmados como lacunas reais

| # | Item | Confirmação |
|---|---|---|
| 2 | `environment` não exposto | Correto. O viewmodel da sessão não carrega o campo. O app não distingue homologação de produção. |
| 3 | Challenge devolve só `nonce` | Correto — `{ nonce }` e nada mais. O contexto vem da chamada pública separada, então um app mal construído pode assinar sem exibir nada. |
| 7 | Formato da VP e do corpo de `/verify` sob JWT | Correto e **bloqueante**: o schema atual exige `vp` como **objeto** (`z.record`). Passar a VP-JWT como string exige mudar o schema para `z.string()`. É alteração na API, não no app. |
| 4 | VC sem `exp` | Correto. Nenhum campo de expiração na VC atual. |
| 8 | Unicidade por documento | Correto. Nada correlaciona documento e DID; o mesmo RG emite credenciais em N aparelhos. |

### 8.4 Sobre a VP-JWT proposta

`aud`, `exp` curto, `nonce` e `jti` são adições sólidas. Dois pontos de atenção:

- **`nonce` deve permanecer no lugar que o servidor lê.** Hoje o servidor busca `vp.challenge` e
  compara o SHA-256 contra `challenge_nonce_hash`. Movê-lo para um claim `nonce` do JWT exige
  ajuste correspondente na API — entra no mesmo pacote do item 7.
- **`exp: iat + 5min` conflita com a janela de 10 min do challenge.** Não é erro, mas cria um
  terceiro relógio. Vale alinhar em 10 min ou documentar que a VP é o prazo mais curto dos três.

---

## 9. O que muda com as stories em backlog

Nada nesta seção está implementado. É o contrato-alvo, para o app não ser construído contra algo
que sai em seguida.

**Stories 5.7 + 5.8** (entrega acoplada):

- `POST /api/credentials/issue` **deixa de aceitar `proofType`**. Corpo passa a ser
  `{ documentImage, bodySignature }`, e o payload assinado passa a ser apenas `documentImage`.
- A VC passa a carregar **ambas** as claims: `{ personhood: true, ageOver18: <boolean> }`.
- **Menor de 18 deixa de receber 422** — emite normalmente com `ageOver18: false`.
- A verificação passa a exigir que a claim correspondente ao `proof_type` da sessão valha `true`.
  Consequência para o app: apresentar uma credencial com `ageOver18: false` a uma sessão de
  `age_over_18` retorna `valid: false`. O app pode **antecipar isso localmente** e avisar a pessoa
  antes de queimar a sessão — recomendado, já que a falha é terminal.

**Epic 9** (9.1 e 9.2):

- A VC passa a ser **string JWT compacta**, não objeto. `POST /api/credentials/issue` retorna a
  string.
- A VP passa a carregar a VC-JWT inteira, e o corpo de `/verify` muda conforme o item 7.

> **Recomendação de sequenciamento:** o app deve ser construído contra o formato **pós-Epic 9**
> (JWT), não contra o objeto JSON-LD atual. O Epic 9 está na Rodada 1 do plano de rodadas — vai
> mudar antes de o app existir. Construir contra o formato atual garante retrabalho.
