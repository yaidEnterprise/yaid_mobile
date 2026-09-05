# Contrato de Interface — App Mobile ↔ API YaID

> **O que é este documento.** A especificação exata da fronteira entre o YaID Wallet e a API YaID:
> rotas, métodos, headers, formatos de corpo e tipos de retorno. Cada afirmação aqui foi verificada
> contra o código em execução, com referência ao arquivo e linha de origem.
>
> **Estado de referência:** codebase em 2026-08-11, com as Stories 5.7, 5.8 e o Epic 9 já
> mesclados. O contrato abaixo descreve o formato VC-JWT como o formato atual — não há mais um
> formato JSON-LD em produção.

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
| `POST /api/credentials/issue` | `` `${documentImage}` `` — só a imagem, sem `proofType`, sem separador | [issue_credential_usecase.ts:67](../src/modules/credential/app/issue_credential_usecase.ts#L67) |
| `POST /api/credentials/revoke` | `` `${vcId}` `` — sem separador, sem prefixo | [revoke_credential_usecase.ts:39](../src/modules/credential/app/revoke_credential_usecase.ts#L39) |

`documentImage` entra no payload **na íntegra** — é a mesma string base64 enviada no corpo. Assinar
um hash da imagem, ou a imagem antes da compressão, produz `401`.

---

## 4. Contrato rota a rota

### 4.1 `POST /api/credentials/issue`

Comprovação. Registra o DID on-chain e devolve a credencial — sempre com **ambas** as claims
(`personhood` e `ageOver18`), independente de qual a pessoa pretende usar depois.

**Auth:** DID · **Content-Type:** `application/json`

**Corpo** ([issue_credential_viewmodel.ts](../src/modules/credential/app/issue_credential_viewmodel.ts)),
schema `.strict()` — **não existe mais campo `proofType`**; enviá-lo cai em `400 VALIDATION_ERROR`:

```jsonc
{
  "documentImage": "string, base64 puro, sem prefixo data:",
  "bodySignature": "string, base64url"
}
```

**Respostas:**

| Código | Corpo | Situação |
|---|---|---|
| `201` | VC-JWT compacta, string (§4.1.1) | Sucesso |
| `401` | `{ "error": "Invalid DID" \| "Invalid signature" }` | DID malformado ou `bodySignature` inválida |
| `422` | `{ "error": "Document processing failed" }` | OCR falhou ou data de nascimento ilegível |
| `502` | `{ "error": "Blockchain registration failed" }` | `registerDID` falhou |
| `400` | `{ "error": { "code": "VALIDATION_ERROR", ... } }` | Corpo fora do schema — **formato de objeto** |

Não existe mais um caso de `422` para menor de idade. Holder com menos de 18 anos recebe `201`
normalmente, com a claim `ageOver18: false` na VC.

**4.1.1 Formato da VC (hoje)** — VC-JWT compacta (`header.payload.signature`), **string, não
objeto** ([issue_credential_usecase.ts:136-152](../src/modules/credential/app/issue_credential_usecase.ts#L136-L152)):

- **Header:** `{ "alg": "EdDSA", "typ": "JWT", "kid": "<issuerDid>#key-1" }`
- **Payload:**
  ```jsonc
  {
    "iss": "did:yaid:issuer:<hex64>",
    "sub": "did:yaid:user:<hex64>",   // holder
    "jti": "uuid",                     // id da VC
    "iat": 1234567890,                 // unix seconds
    "nbf": 1234567890,                 // igual a iat
    "vc": { "personhood": true, "ageOver18": true | false }
  }
  ```
- **Signature:** Ed25519 (`EdDSA`) sobre `` `${base64url(header)}.${base64url(payload)}` ``.

As chaves de claim são **sempre** camelCase (`personhood`, `ageOver18`) — vêm de
`PROOF_TYPE_CLAIM_KEY` em [ProofType.ts](../src/shared/domain/enums/ProofType.ts). O app deve
**guardar a string da VC-JWT exatamente como recebida**; não há reserialização a preservar porque
não há objeto — é a string compacta que viaja para `presentations/verify` (§4.4).

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
  "verifiableCredential": [ "<VC-JWT compacta, exatamente como recebida em issue>" ],  // array de 1 string, não de objetos
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "ISO 8601",
    "verificationMethod": "<holderDid>#key-1",
    "proofPurpose": "authentication",
    "signatureValue": "base64url"
  }
}
```

`verifiableCredential` é um array de **strings** (VC-JWT compacta), não de objetos JSON-LD — e o
servidor exige **exatamente um** elemento (Regra 3); mais de um rejeita.

> **A ordem das chaves importa.** O servidor reserializa
> `JSON.stringify({holder, challenge, verifiableCredential})` **nessa ordem exata**, sem o `proof`,
> e verifica a assinatura contra o resultado
> ([:156-160](../src/modules/presentation/app/verify_presentation_usecase.ts#L156-L160)). O app deve
> montar o objeto nessa ordem, assinar, e só então acrescentar o `proof`. Em linguagens cujo
> serializador JSON não preserva ordem de inserção, isso exige serialização manual.

O servidor decodifica a VC-JWT (header/payload/signature), confere `alg`, `typ`, `kid` e `iss`, e
então checa que a claim correspondente ao `proofType` da sessão (mapeada via
`PROOF_TYPE_CLAIM_KEY`) existe e vale exatamente `true` — ausência ou `false` rejeitam
([verify_presentation_usecase.ts:282-288](../src/modules/presentation/app/verify_presentation_usecase.ts#L282-L288)).
Isto corresponde às Stories 5.7/5.8 (unificação de claims) e ao Epic 9 (VC-JWT) — já em produção,
não mais backlog.

**Respostas:**

| Código | Corpo | Situação |
|---|---|---|
| `200` | `{ "valid": true }` | Todas as 11 regras passaram |
| `200` | `{ "valid": false }` | **Qualquer** falha — sessão inválida, assinatura errada, VC-JWT malformada ou revogada, DID não registrado, nonce divergente, challenge expirado, claim do `proofType` ausente ou `false` |
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

### 8.2 Grafia divergente de `proofType` — resolvido para o envio, ainda presente na leitura

`POST /api/credentials/issue` **não recebe mais `proofType`** — a rota emite sempre as duas claims
juntas, então não há mais grafia a escolher no envio (ver §4.1). A divergência de grafia
remanescente é só entre representação da claim e representação da sessão:

| Onde | Grafia |
|---|---|
| Claim dentro da VC-JWT (`vc.personhood`, `vc.ageOver18`) | camelCase |
| `GET /api/proof-sessions/{token}` (campo `proofType` recebido) | `personhood` \| **`age_over_18`** (snake_case) |

O mapeamento entre as duas formas é centralizado em `PROOF_TYPE_CLAIM_KEY`
([ProofType.ts](../src/shared/domain/enums/ProofType.ts)) e usado pelo servidor tanto para montar a
VC quanto para conferir a claim correta em `presentations/verify` (§4.4). O app só precisa dessa
conversão se quiser **antecipar localmente** se a VC guardada satisfaz o `proofType` da sessão
antes de montar a VP (recomendado — a falha em `/verify` é terminal, ver §4.4).

### 8.3 Itens confirmados como lacunas reais

| # | Item | Confirmação |
|---|---|---|
| 2 | `environment` não exposto | Correto. O viewmodel da sessão não carrega o campo. O app não distingue homologação de produção. |
| 3 | Challenge devolve só `nonce` | Correto — `{ nonce }` e nada mais. O contexto vem da chamada pública separada, então um app mal construído pode assinar sem exibir nada. |
| 7 | Formato da VP e do corpo de `/verify` sob JWT | **Resolvido de forma diferente da proposta.** `vp` continua sendo objeto (`z.record`), não virou string. O que passou a ser JWT foi só o elemento dentro de `verifiableCredential` — cada item do array agora é uma VC-JWT compacta, não um objeto JSON-LD (ver §4.4). A VP em si nunca virou JWT. |
| 4 | VC sem `exp` | Correto. Nenhum campo de expiração na VC atual. |
| 8 | Unicidade por documento | Correto. Nada correlaciona documento e DID; o mesmo RG emite credenciais em N aparelhos. |

### 8.4 Sobre a VP-JWT proposta na spec do app

A proposta original pedia que a **VP inteira** virasse um JWT, com `aud`, `exp` curto, `nonce` e
`jti` como claims do token. **Não foi isso que foi implementado.** O que shippou (§4.4) foi mais
conservador: a VP continua sendo o mesmo objeto JSON de sempre (`holder`, `challenge`,
`verifiableCredential`, `proof`), e só o item dentro de `verifiableCredential` virou uma VC-JWT
compacta. `challenge` continua sendo o nonce bruto comparado contra `challenge_nonce_hash`, não um
claim `nonce` dentro de um JWT — então os dois pontos de atenção abaixo (que valiam para a proposta
original) hoje não se aplicam, porque a VP nunca ganhou claims próprias:

- ~~`nonce` deve permanecer no lugar que o servidor lê~~ — não relevante; `vp.challenge` nunca
  mudou de lugar.
- ~~`exp: iat + 5min` conflita com a janela de 10 min do challenge~~ — não relevante; não existe
  `exp` na VP. A VC-JWT em si também não carrega `exp` (ver §8.3, item 4).

Se a proposta de VP-JWT completa ainda for desejada, ela segue como trabalho não iniciado — mas o
estado atual do código já resolveu a parte que a spec do app apontava como bloqueante (item 7),
por um caminho mais simples.
