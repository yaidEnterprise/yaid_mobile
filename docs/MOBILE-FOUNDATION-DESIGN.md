# YaID Wallet — Design de Fundação

> **O que é este documento.** A fundação da frente **mobile/holder** da YaID: linguagem ubíqua,
> fronteiras de responsabilidade, modelo de segurança, arquitetura em camadas e as regras duras que
> os fluxos precisam respeitar.
>
> **O que ele não é.** Não é especificação de telas, nem plano de implementação, nem substituto do
> contrato de interface. Cada fluxo ganha sua própria spec depois desta.
>
> **Documentos irmãos.** [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md) descreve a solução como um
> todo. [`mobile-api-contract.md`](./mobile-api-contract.md) é a fronteira verificada contra a
> codebase da API YaID — **ele é a autoridade sobre rotas, headers e formatos**; onde este documento
> divergir dele, ele vence.
>
> **Data:** 2026-07-28

---

## 1. Fronteiras do app

O YaID Wallet é o **único detentor da chave privada da pessoa** e a **única origem possível de uma
apresentação**. Todo o resto do desenho decorre disso.

### 1.1 É responsável por

- Gerar a seed e derivar a identidade da pessoa, localmente, no primeiro uso.
- Guardar a seed e a credencial no aparelho.
- Capturar a foto do RG e entregá-la à API YaID na comprovação.
- Interpretar uma sessão de prova recebida por deep link e apresentar seu contexto à pessoa.
- Assinar a apresentação quando a pessoa autoriza, ou recusar a sessão quando ela nega.
- Revogar a credencial quando a pessoa pedir.

### 1.2 Não é responsável por — e isto é fronteira, não omissão

- **Ler ou interpretar o documento.** O OCR e a derivação das claims são da API YaID.
- **Decidir maioridade.** A API deriva; a credencial transporta; o app apenas lê o booleano.
- **Falar com a blockchain.** Só a API YaID escreve e consulta o registro público.
- **Conhecer a empresa além do que a sessão de prova informa.**
- **Guardar histórico de verificações.**

> **Consequência de escopo — o app não tem tela de histórico.** Ele não sabe onde a pessoa se
> verificou, e é deliberado: armazenar isso recriaria localmente o perfil comportamental que a
> arquitetura da solução existe para evitar.

---

## 2. Linguagem ubíqua

Vocabulário canônico do app. Nomes de código seguem estes termos.

### 2.1 Termos

| Termo | Definição |
|---|---|
| **Identidade** | O par de chaves Ed25519 da pessoa e seu DID. Criada no primeiro uso, imutável, local. |
| **Seed** | Os 32 bytes que originam a identidade. Segredo raiz. Nunca sai do aparelho e nunca atravessa a fronteira do ViewModel. |
| **DID** | `did:yaid:user:<hex>`, onde `hex` são os 64 caracteres **minúsculos** da chave pública. Autocertificante: a chave está dentro do identificador. |
| **Credencial** | A Verifiable Credential emitida pela API YaID. Uma **string JWT**, guardada exatamente como recebida. |
| **Claim** | `personhood` e `ageOver18`. Booleanos. Sempre os dois, nunca isolados. |
| **Comprovação** | O ato de enviar a foto do RG e receber a credencial. Acontece uma vez na vida da identidade. |
| **Sessão de prova** | O que chega pelo deep link, identificada pelo `sessionToken`. Carrega `status`, `proofType`, `companyName` e `expiresAt`. |
| **Desafio** | O `nonce` obtido para uma sessão de prova. Obtê-lo é irreversível. |
| **Apresentação** | A Verifiable Presentation que o app assina. É a **única coisa que o app assina com intenção de provar algo**. |
| **Autorizar** | A pessoa aprova a sessão de prova. Produz uma apresentação. |
| **Recusar** | A pessoa nega a **sessão de prova**. A credencial continua existindo. |
| **Revogar** | A pessoa invalida a **credencial**, permanentemente. |

### 2.2 Ambiguidades resolvidas

Três colisões de vocabulário que causariam divergência entre as frentes:

**"Cancelar" significa duas coisas.** A solução tem dois atos distintos com o mesmo verbo em
linguagem natural. Ficam separados e **não são intercambiáveis**:

| Verbo | Objeto | Efeito | Rota |
|---|---|---|---|
| **Recusar** | Sessão de prova | Aquela verificação é negada | `POST /api/proof-sessions/{t}/cancel` |
| **Revogar** | Credencial | A credencial deixa de valer para sempre | `POST /api/credentials/revoke` |

**"Pedido de verificação" não é vocabulário do app.** Existem duas entidades que o overview funde:

| Entidade | Quem manipula | Identificador | O app vê? |
|---|---|---|---|
| Verification request | Empresa ↔ API YaID | `requestId`, `external_reference` | **Nunca** |
| **Proof session** | Holder ↔ API YaID | `sessionToken` | Sim — a única |

O app conhece **somente a sessão de prova**. Usar "pedido de verificação" no código do holder
importaria um conceito que ele não acessa.

**"Environment" tem dois eixos ortogonais.** Confundi-los é fácil e caro:

| Eixo | Valores | Significado | O app conhece? |
|---|---|---|---|
| **Estágio de execução** | `test`, `dev`, `homol`, `prod` | Qual concreto o presenter injeta | Sim — é o único que ele usa |
| **Estágio da aplicação** | homologação, produção | Atributo de negócio da aplicação criada pela empresa no painel | Não hoje (ver §11) |

Uma API YaID em `prod` atende aplicações de homologação e de produção simultaneamente.

### 2.3 Grafia de `proofType`

O mesmo conceito chega em duas grafias, dependendo da rota — e trocá-las produz
`422 "Document processing failed"`, um erro de documento para o que é erro de contrato.

| Contexto | Grafia |
|---|---|
| `POST /api/credentials/issue` (envio) | `personhood` \| `ageOver18` |
| `GET /api/proof-sessions/{token}` (recebimento) | `personhood` \| `age_over_18` |

**Regra:** o domínio tem **um único enum canônico**. A conversão de grafia vive exclusivamente no
adaptador HTTP e em nenhum outro lugar. Após as Stories 5.7/5.8 a emissão deixa de aceitar
`proofType` e a divergência desaparece do lado do app — a regra permanece de qualquer forma.

---

## 3. Decisões de fundação

| # | Decisão | Motivo |
|---|---|---|
| D1 | Identidade Ed25519, seed de 32 bytes, DID `did:yaid:user:<hex64 minúsculo>` | Fixado pela solução. Alinhado ao ecossistema SSI e determinístico na assinatura. |
| D2 | A seed vive em software | Ed25519 não é suportado pelo Secure Enclave do iOS (só P-256) e tem suporte irregular no Android Keystore. **Não é escolha, é consequência de D1.** |
| D3 | Seed no armazenamento seguro do SO; credencial em arquivo cifrado | O armazenamento seguro tem teto prático de ~2 KB por valor no Android. Segredo pequeno e crítico separado de dado grande. |
| D4 | PIN de 6 dígitos exigido **por operação sensível**, com limite de tentativas | Sem sessão, sem estado de "destravado". Ver D11. |
| D5 | Sem recuperação | Preserva "quem tem o aparelho é a pessoa". Um mnemônico tornaria a identidade vendável, atacando as duas perguntas que a YaID responde. |
| D6 | Entrada de sessão apenas por deep link (`yaid://verify?session=<token>`) | Escopo atual. QR entra depois como nova **origem**, sem refatoração. |
| D7 | Stack Expo (React Native + TypeScript), **development build obrigatório** | Universal Links e App Links não funcionam no Expo Go — o fluxo de autorização seria intestável. |
| D8 | Captura do RG apenas por câmera ao vivo | Galeria tornaria trivial submeter documento de terceiro. Não há prova de vida no escopo; esta é a barreira disponível. |
| D9 | Zero telemetria | Coerente com a promessa do produto. Log local apenas em build de desenvolvimento. |
| D10 | TDD obrigatório, árvore de testes espelhando a de código | Definido pelo projeto. |
| D11 | Sem estado entre telas — todo caso de uso relê da infra | Reproduz o modelo do backend e torna cada caso de uso determinístico. |
| D12 | Ports and adapters em **toda** a codebase | Inclusive na borda cara: câmera, armazenamento, deep link, HTTP, relógio, aleatoriedade. |
| D13 | Construir contra o formato **pós-Epic 9** (VC e VP como JWT) | O Epic 9 está na Rodada 1 e sai antes do app existir. Construir contra o formato atual garante retrabalho. |
| D14 | TLS com **certificate pinning** | Única defesa contra servidor forjado: `companyName` e `proofType` não são assinados. |

---

## 4. Modelo de segurança

### 4.1 Identidade e chaves

- Seed de 32 bytes obtida da **porta de aleatoriedade** (CSPRNG do sistema).
- Chave pública de 32 bytes derivada da seed.
- DID montado como `did:yaid:user:` + hex **minúsculo** de 64 caracteres, sem `0x`.
  O servidor valida com `/^[0-9a-f]{64}$/` — **maiúsculas são rejeitadas**.
- Método de verificação: `<did>#key-1`.

### 4.2 Repouso

| Segredo | Onde | Proteção |
|---|---|---|
| Seed | Armazenamento seguro do SO | `WhenUnlockedThisDeviceOnly`, não sincronizável |
| Chave de cifragem da credencial | Armazenamento seguro do SO | idem |
| Credencial (VC-JWT) | Arquivo no sandbox do app | Cifrado pela chave acima |

### 4.3 Uso

PIN de 6 dígitos exigido nas três operações que usam a seed: **comprovar**, **autorizar** e
**revogar**. Limite de tentativas.

> **Divergência consciente com o overview.** O overview descreve o PIN como "senha de acesso ao
> app". Aqui ele é **gate por operação, não trava de abertura**. Abrir o app é livre; a tela inicial
> mostra apenas a existência da credencial, que não é dado sensível. Se ambos existissem, a pessoa
> digitaria o PIN duas vezes seguidas para autorizar.

### 4.4 O que o modelo não protege — declarado, não escondido

- A seed existe como `Uint8Array` no heap do JavaScript durante a assinatura e **não pode ser zerada
  de forma confiável** pelo garbage collector.
- Aparelho com root ou jailbreak derrota o modelo inteiro.
- `companyName` e `proofType` **não são assinados**. Um servidor forjado pode mentir sobre quem está
  pedindo. Mitigação é de transporte (D14), não de contrato.
- Quem obtiver o `sessionToken` de outra pessoa **não consegue aprovar** — a regra `vc.holder ===
  holderDid` impede — mas **consegue queimar a sessão** chamando challenge ou cancel com identidade
  própria. O risco de phishing de link é **negação de serviço, não aprovação indevida**.
- Reenvio verbatim de uma requisição capturada é válido por até ±5 minutos (não há rastreio de nonce
  nem de `jti` na autenticação por DID). O impacto é baixo e a defesa é TLS.

---

## 5. Arquitetura

Adaptação da arquitetura em camadas usada nos projetos de backend da organização. O modelo de dez
papéis é preservado; o que muda é a natureza do ponto de entrada.

### 5.1 Mapeamento dos papéis

| # | Papel | No YaID Wallet |
|---|---|---|
| 1 | **Entry Adapter** | Três tipos: **tela** (ação da pessoa), **deep link** e **ciclo de vida** (cold start, retorno de background). Finos: convertem toque ou URL em chamada ao presenter e mapeiam a resposta abstrata em navegação. |
| 2 | **Presenter** (composition root) | Único lugar que escolhe concretos, por estágio de execução. **`presenter` neste projeto significa composition root** e nada mais. |
| 3 | **Controller** | Valida a forma da entrada, monta o DTO, chama o caso de uso, mapeia erro de domínio para erro tipado de apresentação. |
| 4 | **Use Case** | Puro. Depende só de portas. |
| 5 | **ViewModel** | Molda a saída do caso de uso para a tela **e remove campo sensível**. A seed nunca atravessa esta fronteira. |
| 6 | **Domain** | Entidades, enums, erros e **todas as portas**. Zero React, zero Expo, zero `fetch`. |
| 7 | **Infra** | Concretos e **fakes**. Um fake por porta. |
| 8 | **Clients** | Envoltórios finos sobre SDK real: armazenamento seguro, câmera, deep link, criptografia Ed25519, HTTP. |
| 9 | **Contratos** | O app não *serve* protocolo, **consome** dois: o contrato da API YaID e o contrato de deep link. |
| 10 | **Environments** | Estágio de execução e endpoints, validados num lugar só. |

### 5.2 Por que MVP não é adotado

A separação que o MVP busca já está entregue: **View** é a tela (entry adapter), **Presenter** é o
controller, **Model** é o caso de uso mais o domínio. Adotá-lo como padrão nomeado causaria três
problemas: `presenter` já significa composition root; o Presenter do MVP é um objeto **com estado**,
o que contraria D11; e ele foi desenhado para UI imperativa, empurrando atualizações para a View —
o oposto do modelo declarativo do React.

### 5.3 Regras específicas desta adaptação

Além da Iron Rule herdada (toda dependência externa passa por porta → concreto → fake):

- **Relógio e fonte de aleatoriedade são portas.** Sem isso, a derivação `seed → DID` não é testável
  contra vetores fixos e a expiração de sessão não é verificável.
- **Navegação não é do domínio.** O controller devolve resultado tipado; a tela decide para onde ir.
  Nenhum caso de uso conhece rotas.
- **Nenhum `import` de `expo-*` fora da camada de clients.**
- **`app/` do Expo Router é o ponto de entrada de transporte**, análogo ao `app/api/**` do Next nos
  projetos de backend.

### 5.4 Estrutura de pastas

**Em aberto.** Fica para validação junto com as demais filosofias de projeto da organização. O que
está fixado aqui são os papéis, suas dependências permitidas e a exigência de árvore de testes
espelhada — não os caminhos de arquivo.

### 5.5 Portas do domínio

| Porta | Responsabilidade |
|---|---|
| `CofreDeSegredos` | Guardar e ler seed e chave de cifragem |
| `ArmazenamentoDeCredencial` | Guardar e ler a credencial cifrada |
| `Assinador` | Assinar bytes com a seed (Ed25519) |
| `FonteDeAleatoriedade` | Bytes aleatórios criptograficamente seguros |
| `Relogio` | Hora atual |
| `CapturadorDeDocumento` | Obter a imagem do RG pela câmera |
| `ProcessadorDeImagem` | Redimensionar, comprimir e codificar em base64 |
| `ApiYaID` | As seis rotas da fronteira |
| `TravaPorPin` | Validar PIN e contabilizar tentativas |

---

## 6. Fluxos e regras duras

### 6.1 Primeiro uso

Gerar seed → derivar chave pública → montar DID → gravar no cofre → definir PIN.

Sem rede. Sem cadastro. Nada é enviado a lugar nenhum.

### 6.2 Comprovação

```
PIN → câmera ao vivo → redimensionar e comprimir → base64
    → bodySignature + headers DID → POST /api/credentials/issue
    → recebe a credencial (string JWT) → grava cifrada
```

**Regras:**

- **A imagem é redimensionada e comprimida antes de codificar**, com teto de **1 MB após a
  codificação em base64** (lado maior limitado a 1600 px, JPEG com qualidade ajustada até caber).
  Foto de celular tem 2–5 MB, base64 infla 33%, e o `bodySignature` é calculado sobre a string
  inteira — sem esse teto são vários megabytes vivos no heap do JS ao mesmo tempo, causa clássica de
  crash por memória. O valor precisa ser revalidado contra a taxa de acerto real do OCR.
- O `bodySignature` cobre a string base64 **exatamente como enviada**. Assinar um hash, ou a imagem
  antes da compressão, produz `401`.
- Falha é **visível**. Nunca silenciosa com a pessoa achando que deu certo.

### 6.3 Autorização

```
1. deep link  yaid://verify?session=<token>
2. GET  /api/proof-sessions/<token>        (pública, idempotente, não queima nada)
3. [ tela de decisão: companyName, proofType, expiresAt ]
       recusa → POST /api/proof-sessions/<token>/cancel → fim
4. PIN
5. GET  /api/proof-sessions/<token>/challenge   (IRREVERSÍVEL — inicia janela de 10 min)
6. monta e assina a apresentação
7. POST /api/presentations/verify               (terminal em ambos os resultados)
```

**Regras duras:**

- **Nunca chamar o challenge antes da decisão da pessoa.** É um `GET` que muta estado: pedi-lo na
  abertura da tela queima a sessão se ela desistir.
- **Pré-checagem local da claim antes do passo 5.** Se a sessão pede `age_over_18` e a credencial
  tem `ageOver18: false`, o app avisa a pessoa **sem** pedir o challenge. Chamar a API nesse caso
  devolveria `valid: false` e destruiria a sessão sem necessidade.
- **A tela de decisão é superfície de segurança**, não tela informativa. É a única defesa contra
  phishing de link, e precisa deixar `companyName` e a pergunta inequívocos.
- **O prazo real é o do challenge (10 min), não o da sessão (30 min).**
- **`valid: false` é opaco e terminal.** Chega com HTTP 200, sem motivo, e não admite segunda
  tentativa na mesma sessão. A mensagem à pessoa é genérica e a recuperação é sempre "recomece pela
  empresa".
- **Sessão encontrada em `opened` é irrecuperável** — o challenge já foi consumido. O app orienta a
  recomeçar.

### 6.4 Recusa

`POST /api/proof-sessions/{token}/cancel`. A credencial permanece intacta.

### 6.5 Revogação

`POST /api/credentials/revoke` com `{ vcId, bodySignature }`, onde `bodySignature` assina `vcId`
sozinho, sem separador nem prefixo. Irreversível e por iniciativa exclusiva da pessoa.

> **Pendência do Epic 9.** `vcId` é hoje o campo `id` da VC-objeto. Quando a VC virar string JWT,
> esse campo deixa de ser diretamente acessível: passa a ser o `jti` do payload. Ou a API aceita o
> JWT, ou o app decodifica o payload para extraí-lo. Ver §11.

---

## 7. Formato da apresentação

**Alvo pós-Epic 9.** O formato da VC é definido pela Story 9.1. O formato da VP é estabelecido aqui
como linha de base e **depende de alteração na API** (ver §11).

```
header   { "alg": "EdDSA", "typ": "JWT", "kid": "did:yaid:user:<hex>#key-1" }

payload  { iss:   "<DID do holder>",
           aud:   "<identificador da API YaID>",
           jti:   "<uuid>",
           iat,
           exp:   iat + 10 min,
           vp: { "@context": ["https://www.w3.org/2018/credentials/v1"],
                 type: ["VerifiablePresentation"],
                 challenge: "<nonce recebido>",
                 verifiableCredential: [ "<a credencial, string JWT intacta>" ] } }
```

O valor concreto de `aud` — o DID do emissor ou um identificador próprio da API — entra no mesmo
pacote de alinhamento da questão 1 de §11.

**Por que cada campo existe:**

- `aud` amarra a apresentação à API YaID — impede reapresentação em outro verificador.
- `jti` e `challenge` fecham replay.
- `exp` alinhado em **10 minutos** para coincidir com a janela do challenge, evitando um terceiro
  relógio no sistema.
- `challenge` permanece **dentro do bloco `vp`**, que é onde o servidor o lê hoje.

**A credencial é reembutida como string, byte a byte.** O app pode manter uma versão decodificada
para exibição, mas a montagem da apresentação usa a string original.

**SD-JWT foi avaliado e descartado.** Divulgação seletiva serviria para revelar apenas a claim
perguntada — mas quem verifica é a própria API YaID, que emitiu a credencial e já conhece as duas
claims, e a empresa nunca vê a apresentação. Não há ganho de privacidade contra o único ator que a
lê.

---

## 8. Tratamento de erro

A API responde erros em **duas formas incompatíveis**, conforme a origem:

```jsonc
{ "error": "Invalid signature" }                                    // forma A — string
{ "error": { "code": "VALIDATION_ERROR", "message": "...", ... } }  // forma B — objeto
```

**Regra:** o adaptador HTTP normaliza com leitura tolerante — `typeof body.error === "string"
? body.error : body.error?.message` — e **nunca depende de `code`**, que só existe na forma B.

Dois erros exigem tradução específica para a pessoa:

| Erro da API | O que o app deve dizer |
|---|---|
| `401 Request expired` | "Confira a data e a hora do aparelho" — a janela é de ±5 min contra o relógio do servidor, e a causa quase sempre é relógio errado, não rede. |
| `200 { valid: false }` | Mensagem genérica de falha e orientação para recomeçar pela empresa. O app **não consegue** saber qual regra falhou, por decisão da API. |

---

## 9. Testes

- **TDD obrigatório.** Toda funcionalidade nasce como teste.
- **Árvore de testes espelha a árvore de código.**
- **Estágio `test` injeta fakes em todas as portas** — cofre, câmera, HTTP, relógio, aleatoriedade.
  Casos de uso completos rodam em Node, sem simulador.
- **Fakes são implementações em memória, não mocks de módulo Expo.** Mockar `expo-secure-store`
  testa que uma função foi chamada; um cofre falso testa que a seed foi realmente guardada e
  recuperada.
- **Vetores fixos obrigatórios** para `seed → chave pública → DID` e para a montagem da
  apresentação. São os pontos onde o erro é silencioso: assinatura válida localmente, inválida no
  servidor, com `401` sem diagnóstico.
- **Testes de regressão para as regras duras de §6.3**, em especial "challenge só após a decisão" e
  a pré-checagem local da claim.

---

## 10. Fora de escopo

- Tela de histórico de verificações (§1.2).
- Recuperação de identidade, backup, mnemônico ou sincronização entre aparelhos (D5).
- QR code e fluxo entre aparelhos diferentes — previsto como extensão futura, entra como nova
  origem de sessão (D6).
- Telemetria de qualquer natureza (D9).
- Múltiplas credenciais ou múltiplas identidades por instalação.
- Qualquer pergunta além de `personhood` e `ageOver18`.

---

## 11. Questões em aberto

| # | Item | Impacto no app | Dono |
|---|---|---|---|
| 1 | **VP como string e posição do `nonce`** — o schema de `/api/presentations/verify` exige `vp` como objeto (`z.record`); string é rejeitada | **Bloqueante** para §7 | API YaID |
| 2 | **`vcId` sob JWT** — o campo `id` deixa de existir quando a VC vira string; passa a ser o `jti` do payload | Bloqueia §6.5 pós-Epic 9 | API YaID |
| 3 | **`environment` não exposto** na sessão de prova | O app não consegue avisar que a verificação é de uma aplicação de homologação | API YaID (adicionar campo) |
| 4 | **Challenge devolve só `nonce`** — o contexto vem de chamada separada e não autenticada, então nada impede um app mal construído de assinar às cegas | Nenhum (este app sempre exibe antes), mas o reforço é barato | API YaID (adicionar campo) |
| 5 | **VC sem `exp`** — duas consequências: a credencial de um aparelho perdido vale para sempre, e quem comprovar aos 17 fica com `ageOver18: false` permanente e sem caminho de correção | Nenhum hoje; é buraco de produto | Produto |
| 6 | **Unicidade por documento (sybil)** — nada correlaciona documento e DID; o mesmo RG emite credenciais em N aparelhos | Nenhum hoje | Produto / API YaID |
| 7 | **Comprovação interrompida** — assume-se o caminho feliz; o cenário "registro on-chain concluído, app não recebeu a credencial" não tem tratamento definido | Diferido para pós-validação | Diferido |
| 8 | **Estrutura de pastas** — pendente das filosofias de projeto da organização | Nenhum; papéis já fixados | Este projeto |

---

## 12. Resumo em uma frase

O YaID Wallet guarda a única chave privada da pessoa, prova o que precisa ser provado sem revelar
quem ela é, e é construído de forma que a parte perigosa do sistema — chaves, assinatura e as regras
irreversíveis dos fluxos — seja código puro, testável sem simulador e impossível de quebrar em
silêncio.
