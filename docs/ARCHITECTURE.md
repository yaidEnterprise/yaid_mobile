# Arquitetura — YaID Wallet

> **O que é este documento.** Os requisitos técnicos desta codebase: stack, princípios de
> desenvolvimento, modelo de segurança, estrutura de pastas, camadas, convenções e as regras que não
> podem ser quebradas. É a referência para quem for implementar qualquer especificação deste
> projeto — inclusive para responder "onde eu ponho este arquivo?".
>
> **Documentos irmãos.** [`PROJECT-BASELINE.md`](./PROJECT-BASELINE.md) define **o quê** construímos
> e as regras de produto. [`UX.md`](./UX.md) define a experiência.
> [`MOBILE-API-CONTRACT.md`](./MOBILE-API-CONTRACT.md) é a fronteira verificada com a API YaID e
> **prevalece sobre este documento** em qualquer divergência sobre rotas, headers ou formatos.

---

## 1. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Plataforma | **Expo** (React Native + TypeScript) | **Development build obrigatório** — ver §1.1 |
| Roteamento | **Expo Router** | Roteamento por arquivos; é a camada de entry adapter |
| Criptografia | **Ed25519** | Definido pela solução YaID |
| Armazenamento de segredo | Armazenamento seguro do SO (Keychain / Keystore) | Teto prático de ~2 KB por valor no Android |
| Testes | Runner de TypeScript rodando em **Node** | Casos de uso não precisam de simulador |
| Telemetria | **Nenhuma** | Sem SDK de terceiro. Log local apenas em build de desenvolvimento |

### 1.1 Por que development build, e não Expo Go

Universal Links e App Links **não funcionam no Expo Go**. Como todo o domínio de autorização começa
por um link que abre o aplicativo, ele seria intestável. O projeto nasce com build de
desenvolvimento configurado; não há caminho alternativo.

---

## 2. Princípios

Esta codebase é a adaptação, para React Native + Expo, da arquitetura em camadas usada nos projetos
de backend da organização. Dois mecanismos fazem todo o trabalho; o resto é consequência deles.

**Separação de camadas.** Cada camada tem uma responsabilidade e não alcança além da vizinha. Uma
tela nunca toca no armazenamento seguro; um caso de uso nunca importa React nem Expo.

**Inversão de dependência.** Toda camada depende de uma **interface que ela própria define**, nunca
de um concreto. O concreto é escolhido em um único lugar — o presenter — conforme o estágio de
execução.

Disso decorre a propriedade que sustenta o TDD obrigatório: **um caso de uso completo roda em Node,
sem simulador, sem rede e sem aparelho.**

### 2.1 A Iron Rule

> Toda funcionalidade que dependa de recurso externo passa por **interface → concreto → fake**, sem
> exceção.

Vale para armazenamento seguro exatamente como vale para câmera, HTTP, biometria, relógio e fonte de
aleatoriedade. Nenhum caso de uso, controller ou tela importa um SDK diretamente. Se algo precisa de
um SDK, a interface existe primeiro.

**Relógio e aleatoriedade são portas.** Não é preciosismo: sem elas a derivação `seed → DID` não é
testável contra vetores fixos, e a expiração de solicitação não é verificável.

### 2.2 TDD é obrigatório

Toda funcionalidade nasce como teste, e a implementação existe para fazer o teste passar. A árvore de
testes espelha a árvore de código, um para um.

---

## 3. Decisões técnicas de fundação

| # | Decisão | Motivo |
|---|---|---|
| **T1** | Identidade **Ed25519**: seed de 32 bytes, chave pública de 32 bytes, DID `did:yaid:user:<hex64 minúsculo>` | Fixado pela solução. O DID é **autocertificante** — a chave pública está dentro dele, então o servidor resolve por derivação, sem consulta. |
| **T2** | **A seed vive em software** | Ed25519 **não é suportado pelo Secure Enclave do iOS** (que só faz P-256) e tem suporte irregular no Android Keystore. Não é escolha — é consequência de T1. Chave em hardware não-exportável está fora de alcance. |
| **T3** | Seed e chave de cifragem no armazenamento seguro; **credencial em arquivo cifrado** | O armazenamento seguro tem teto prático de ~2 KB por valor no Android, e uma credencial assinada pode ultrapassá-lo. Segredo pequeno e crítico fica separado de dado grande. |
| **T4** | Senha de 6 dígitos exigida **por operação sensível** | Sem sessão, sem estado de "destravado". Ver T7. |
| **T5** | Ports and adapters em **toda** a codebase, inclusive na borda cara | Câmera, armazenamento, deep link, HTTP, relógio e aleatoriedade são portas. Permite testar tudo com fakes. |
| **T6** | Navegação **não é do domínio** | O controller devolve resultado tipado; a tela decide para onde ir. Nenhum caso de uso conhece rotas. |
| **T7** | **Sem estado entre telas** | Cada caso de uso relê o que precisa das portas. Não há store global nem sessão de destravamento. |
| **T8** | Entrada de solicitação apenas por deep link: `yaid://verify?session=<token>` | Recorte atual. QR entra depois como nova **origem**, sem refatoração. |
| **T9** | Construir contra o formato **pós-Epic 9** (credencial e apresentação como JWT) | O Epic 9 sai antes de o app existir. Construir contra o formato atual garante retrabalho. |
| **T10** | **TLS com certificate pinning** | Única defesa contra servidor forjado: o nome da empresa e a pergunta **não são assinados**. |
| **T11** | Zero telemetria | Coerente com a promessa do produto. |

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
| Seed | Armazenamento seguro do SO | Acessível apenas com o aparelho desbloqueado, **não sincronizável**, restrito a este aparelho |
| Chave de cifragem da credencial | Armazenamento seguro do SO | idem |
| Credencial | Arquivo no sandbox do app | Cifrado pela chave acima |

### 4.3 Uso

Senha de 6 dígitos exigida nas três operações que usam a seed — **comprovar**, **autorizar** e
**revogar** — com limite de tentativas. Abrir o aplicativo é livre: a tela inicial não expõe nada
sensível, e exigir a senha também na abertura faria a pessoa digitá-la duas vezes seguidas para
autorizar.

### 4.4 O que o modelo **não** protege — declarado, não escondido

- A seed existe como array de bytes no heap do JavaScript durante a assinatura e **não pode ser
  zerada de forma confiável** pelo garbage collector. É limitação da stack.
- Aparelho com root ou jailbreak derrota o modelo inteiro.
- O nome da empresa e a pergunta **não são assinados**. Um servidor forjado pode mentir sobre quem
  está pedindo. A mitigação é T10, de transporte — não de contrato.
- Quem obtiver a solicitação de outra pessoa **não consegue aprová-la** — o servidor exige que o
  detentor da credencial seja quem assina — mas **consegue queimá-la**, porque as rotas de desafio e
  recusa não vinculam identidade à solicitação. O risco é **negação de serviço, não aprovação
  indevida**.
- Reenvio verbatim de uma requisição capturada é válido por até ±5 minutos, porque a autenticação por
  DID não rastreia nonce. Impacto baixo; a defesa é TLS.

---

## 5. Estrutura de pastas

```
src/
├── app/                                    ← ENTRY ADAPTERS (Expo Router)
│   ├── _layout.tsx
│   ├── index.tsx                             tela inicial
│   ├── _components/                          componentes compartilhados (não são rotas)
│   ├── onboarding/
│   │   ├── create-identity.tsx
│   │   └── define-pin.tsx
│   ├── credential/
│   │   ├── capture-document.tsx
│   │   └── revoke.tsx
│   └── verify/
│       └── [session].tsx                     alvo do deep link
│
├── modules/                                ← camadas por funcionalidade
│   ├── identity/
│   │   └── app/
│   │       ├── create_identity_usecase.ts
│   │       ├── create_identity_viewmodel.ts
│   │       ├── create_identity_controller.ts
│   │       └── create_identity_presenter.ts
│   ├── credential/
│   │   └── app/
│   │       ├── issue_credential_{usecase,viewmodel,controller,presenter}.ts
│   │       └── revoke_credential_{usecase,viewmodel,controller,presenter}.ts
│   ├── proof-session/
│   │   └── app/
│   │       ├── get_proof_session_{usecase,viewmodel,controller,presenter}.ts
│   │       └── cancel_proof_session_{usecase,viewmodel,controller,presenter}.ts
│   ├── presentation/
│   │   └── app/
│   │       └── present_proof_{usecase,viewmodel,controller,presenter}.ts
│   └── access/
│       └── app/
│           └── define_pin_{usecase,viewmodel,controller,presenter}.ts
│
└── shared/                                 ← exatamente 5 entradas
    ├── domain/
    │   ├── entities/         identity.ts · credential.ts · proof_session.ts
    │   ├── enums/            proof_type.ts · proof_session_status.ts · stage.ts
    │   ├── errors/           erros de domínio, sem código de protocolo
    │   └── interfaces/
    │       ├── repositories/ identity_repository.ts · credential_repository.ts
    │       └── providers/    signer.ts · clock.ts · randomness.ts · pin_lock.ts
    │                         document_capture.ts · image_processor.ts · yaid_api.ts
    ├── infra/
    │   ├── dto/              DTOs da API YaID, mappers, parser do deep link
    │   ├── repositories/     implementações concretas
    │   ├── providers/        implementações concretas
    │   └── mock/             um fake por interface
    ├── result/               resultado tipado que o controller devolve à tela
    ├── clients/              envoltórios finos sobre SDK real
    └── environments.ts       config validada, um lugar só

tests/                                      ← espelha src/ 1:1
├── modules/
└── shared/
```

**`shared/` tem exatamente cinco entradas e não ganha mais nenhuma.** Não existe `shared/utils`,
`shared/helpers`, `shared/errors` ou `shared/middlewares` — tudo tem casa em uma das cinco.

---

## 6. Os dez papéis

| # | Papel | Onde vive | Responsabilidade | Nunca faz |
|---|---|---|---|---|
| 1 | **Entry Adapter** | `src/app/**` | Recebe a ação (toque, deep link, ciclo de vida), chama o presenter, converte o resultado em navegação e renderização | Lógica de negócio, acesso a armazenamento, leitura de env, chamada de SDK |
| 2 | **Presenter** | `modules/*/app/*_presenter.ts` | Único lugar que escolhe e monta concretos, por estágio | Lógica de negócio, validação, formatação |
| 3 | **Controller** | `modules/*/app/*_controller.ts` | Valida a forma da entrada, monta o DTO, chama o caso de uso, mapeia erro de domínio para resultado tipado | Lógica de negócio, instanciar concretos |
| 4 | **Use Case** | `modules/*/app/*_usecase.ts` | A regra de aplicação. Orquestra entidades e portas | Importar React, Expo, `fetch`, rota, ler env |
| 5 | **ViewModel** | `modules/*/app/*_viewmodel.ts` | Molda a saída para a tela e **remove campo sensível** | Lógica de negócio, acesso a infra |
| 6 | **Domain** | `shared/domain/` | Entidades, enums, erros e **todas as interfaces** | Qualquer import de framework, SDK ou concreto |
| 7 | **Infra** | `shared/infra/` | Implementações concretas, DTOs, mappers e **fakes** | Lógica de negócio |
| 8 | **Clients** | `shared/clients/` | Envoltório fino sobre serviço ou SDK real | Ser chamado direto de um caso de uso ou controller |
| 9 | **Result** | `shared/result/` | Tipos de sucesso e falha que o controller devolve, cada falha com mensagem de contexto | Lógica de negócio, import de framework |
| 10 | **Environments** | `shared/environments.ts` | Lê e valida estágio e endpoints, num lugar só | Ser importado por domínio ou caso de uso |

### 6.1 Sobre o papel 9

No backend este slot é a camada de protocolo — códigos de status e respostas tipadas. **O app não
serve protocolo, ele consome.** O papel se preserva com o consumidor trocado: o controller devolve um
resultado tipado e a tela o converte em navegação e mensagem, exatamente como um entry adapter de
backend converte a resposta abstrata na resposta nativa do transporte.

Os tipos de requisição e resposta **da API YaID** não moram aqui — são dados externos, e ficam em
`shared/infra/dto/` com os mappers que os convertem para entidades.

### 6.2 Sobre o papel 5 — a regra mais importante deste documento

O ViewModel existe **principalmente por segurança**. A entidade de identidade contém a seed. Se ela
chegasse à tela, a seed entraria no estado do React, na árvore de componentes, no inspetor de
desenvolvimento e em qualquer log de exceção.

> **A seed nunca atravessa a fronteira do ViewModel.**

### 6.3 O que "presenter" significa aqui

**Composition root, e nada mais.** Não é o Presenter do padrão MVP.

MVP não é adotado porque a separação que ele busca já está entregue pelas camadas — a tela é a View,
o controller é o Presenter, o caso de uso mais o domínio são o Model — e porque o Presenter do MVP é
um objeto **com estado** que empurra atualizações imperativas para a View, o oposto do modelo
declarativo do React e incompatível com T7.

---

## 7. Regras de dependência

```
Permitido:
  entry adapter  →  presenter  →  controller  →  use case  →  domain
  infra          →  domain (interfaces)
  presenter      →  environments, infra, clients
  controller     →  result, erros de domínio
  use case       →  portas injetadas, apenas

Proibido:
  domain         →  infra
  domain         →  React, Expo, qualquer framework
  use case       →  React, Expo, fetch, navegação, env
  controller     →  concreto de infra ou client
  entry adapter  →  armazenamento, SDK, env, lógica de negócio
  qualquer coisa →  import de `expo-*` fora de shared/clients
  módulo         →  internals de outro módulo
  shared/        →  qualquer sexta pasta de topo
```

---

## 8. Fluxo de uma ação

O análogo mobile do fluxo de requisição do backend. A pessoa toca em "Autorizar":

```
 1. A tela (entry adapter) captura o toque
 2. Chama o presenter do módulo
 3. O presenter lê environments
 4. O presenter instancia os concretos conforme o estágio
 5. O presenter monta caso de uso e controller, e devolve o controller
 6. A tela entrega a entrada ao controller
 7. O controller valida a forma da entrada
 8. O controller monta o DTO de entrada
 9. O controller chama o caso de uso
10. O caso de uso executa a regra
11. O caso de uso chama as portas de que precisa
12. A infra executa o concreto — ou o fake, no estágio `test`
13. O caso de uso devolve o DTO de saída
14. O controller chama o ViewModel
15. O ViewModel monta a saída segura, sem campo sensível
16. O controller devolve um resultado tipado
17. A tela navega e renderiza conforme o resultado
```

**O presenter é montado por ação, não uma vez na inicialização.** É uma função simples, chamada como
qualquer outra — o mesmo desenho do backend, que monta por requisição. Isso preserva T7: cada ação
relê o que precisa, e nada fica pendurado em memória entre telas.

**Um hook de React que dispara a ação não contém lógica.** Ele chama o presenter, chama o controller,
guarda o resultado para renderizar. Nada além disso.

---

## 9. Wiring por estágio

O presenter escolhe implementações pelo **estágio de execução**, nunca espalhando condicionais pela
codebase.

| Estágio | Infraestrutura |
|---|---|
| `test` | **Fakes em tudo** — sem rede, sem aparelho, totalmente determinístico |
| `dev` | Stack real replicada localmente |
| `homol` | Stack real, espelhando produção |
| `prod` | Produção |

Lido de `EXPO_PUBLIC_STAGE` e validado em `shared/environments.ts`. `test` **sempre** resolve para o
fake; qualquer outro estágio resolve para o concreto.

> **Não confundir com o ambiente da aplicação da empresa.** Homologação e produção, no painel
> empresarial, são atributo de negócio da aplicação criada pela empresa — eixo **ortogonal** a este.
> Uma API YaID em `prod` atende aplicações de homologação e de produção ao mesmo tempo. O app conhece
> apenas o estágio de execução.

---

## 10. Portas e fakes

| Porta | Concreto envolve | Fake |
|---|---|---|
| `IdentityRepository` | armazenamento seguro do SO | em memória |
| `CredentialRepository` | arquivo cifrado no sandbox | em memória |
| `Signer` | Ed25519 | chave fixa de teste |
| `Randomness` | CSPRNG do sistema | sequência determinística |
| `Clock` | relógio do sistema | hora controlada pelo teste |
| `DocumentCapture` | câmera | imagem de fixture |
| `ImageProcessor` | redimensionamento e compressão | passthrough |
| `PinLock` | armazenamento seguro e contagem de tentativas | em memória |
| `YaIDApi` | HTTP para as seis rotas | respostas roteirizadas |

**Fakes são implementações em memória, não mocks de módulo.** Mockar o módulo de armazenamento seguro
prova que uma função foi chamada; um cofre falso prova que a seed foi realmente guardada e
recuperada. O fake também é a especificação executável do contrato daquela porta.

**Cada fake honra o contrato inteiro da sua interface**, incluindo casos de borda, e tem teste próprio
verificando isso.

---

## 11. Fronteira com a API YaID

A autoridade é [`MOBILE-API-CONTRACT.md`](./MOBILE-API-CONTRACT.md). Aqui ficam apenas as
consequências arquiteturais.

### 11.1 Autenticação por DID

Cinco das seis rotas exigem três headers, com assinatura Ed25519 sobre
`{timestamp}:{MÉTODO}:{pathname}`. Três armadilhas que produzem `401` sem diagnóstico:

- O timestamp assinado é **a string exata enviada no header**, não o número reinterpretado.
- O método vai em **maiúsculas** — o desafio é `GET`, e assinar `POST` ali é o erro mais comum.
- O caminho vai **sem query string e sem barra final**.

**A janela é de ±5 minutos contra o relógio do servidor.** Relógio errado no aparelho derruba toda
requisição, e a mensagem de erro aponta para assinatura — o que manda depurar criptografia quando o
problema é a hora. O app traduz esse erro específico para uma orientação sobre o relógio.

### 11.2 Regras irreversíveis do domínio de autorização

Estas regras têm teste de regressão obrigatório:

- **O desafio só é pedido depois da decisão da pessoa.** É um `GET` que muta estado: pedi-lo ao abrir
  a tela queima a solicitação se ela desistir.
- **Checagem local da resposta antes de pedir o desafio.** Se a solicitação pergunta maioridade e a
  credencial diz que não, o app avisa **sem** chamar a API. Chamar devolveria falha e destruiria a
  solicitação sem necessidade.
- **O prazo real é o do desafio (10 minutos), não o da solicitação (30 minutos).**
- **Falha na verificação é opaca e terminal.** Chega com sucesso HTTP e sem motivo, e não admite
  segunda tentativa na mesma solicitação. A mensagem é genérica e a recuperação é sempre recomeçar
  pela empresa.
- **Solicitação encontrada em estado já aberto é irrecuperável** — o desafio foi consumido.

### 11.3 Formato da apresentação

Alvo pós-Epic 9. O formato da credencial é definido pela API; **o formato da apresentação é
estabelecido aqui** e depende de alteração no servidor (§16, questão 1).

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

- `aud` amarra a apresentação à API YaID — impede reapresentação em outro verificador.
- `jti` e `challenge` fecham replay.
- `exp` alinhado em **10 minutos** para coincidir com a janela do desafio, evitando um terceiro
  relógio no sistema.
- `challenge` permanece **dentro do bloco `vp`**, que é onde o servidor o lê.

**A credencial é reembutida como string, byte a byte.** O app pode manter uma versão decodificada
para exibição, mas a montagem da apresentação usa a string original.

> **SD-JWT foi avaliado e descartado.** Divulgação seletiva serviria para revelar apenas a resposta
> perguntada — mas quem verifica é a própria API YaID, que emitiu a credencial e já conhece as duas
> respostas, e a empresa nunca vê a apresentação. Não há ganho de privacidade contra o único ator que
> a lê.

### 11.4 Grafia divergente de `proofType`

O mesmo conceito chega em duas grafias conforme a rota — `ageOver18` na emissão, `age_over_18` na
solicitação — e trocá-las produz um erro de documento para o que é erro de contrato.

**Regra:** o domínio tem **um único enum canônico**, e a conversão de grafia vive exclusivamente no
adaptador HTTP.

### 11.5 Duas formas de erro

A API responde erros em duas formas incompatíveis:

```jsonc
{ "error": "Invalid signature" }                                    // forma A — string
{ "error": { "code": "VALIDATION_ERROR", "message": "...", ... } }  // forma B — objeto
```

**Regra:** o adaptador HTTP normaliza com leitura tolerante e **nunca depende de `code`**, que só
existe na forma B.

### 11.6 Envio da imagem do documento

A imagem é **redimensionada e comprimida antes de codificar**, com teto de **1 MB após a codificação
em base64** (lado maior limitado a 1600 px, qualidade ajustada até caber). Foto de celular tem 2–5 MB
e a codificação infla 33%; a assinatura de corpo é calculada sobre a string inteira. Sem esse teto,
são vários megabytes vivos no heap ao mesmo tempo — causa clássica de crash por memória em React
Native.

A assinatura de corpo cobre a string **exatamente como enviada**. Assinar um hash, ou a imagem antes
da compressão, produz `401`.

> O teto de 1 MB é palpite calibrado, não medição. Precisa ser revalidado contra a taxa de acerto
> real do reconhecimento do documento.

---

## 12. Convenções

| Item | Convenção | Exemplo |
|---|---|---|
| Arquivos | `snake_case` | `issue_credential_usecase.ts` |
| Pastas de módulo | `kebab-case` | `proof-session/` |
| Rotas do Expo Router | `kebab-case` | `capture-document.tsx` |
| Classes e tipos | `PascalCase` | `IssueCredentialUseCase` |
| Camada de app | `{ação}_{funcionalidade}_{papel}.ts` | `revoke_credential_controller.ts` |
| Domínio e infra | `{conceito}_{papel}.ts` | `credential_repository.ts` · `credential_repository_mock.ts` |

Alinhadas com a codebase da API YaID, para que um dev transite entre as duas frentes sem trocar de
vocabulário.

### 12.1 Termos do domínio no código

O vocabulário canônico está em [`PROJECT-BASELINE.md`](./PROJECT-BASELINE.md). No código, os nomes
seguem o contrato da API, que é a fronteira real:

| Conceito de produto | Nome no código |
|---|---|
| Identidade | `Identity` |
| Credencial | `Credential` |
| Solicitação de verificação | `ProofSession` |
| Autorizar | `PresentProof` |
| Recusar | `CancelProofSession` |
| Revogar | `RevokeCredential` |
| Comprovar | `IssueCredential` |

**"Cancelar" nunca é usado sozinho.** `Cancel` refere-se exclusivamente à solicitação; revogação da
credencial é sempre `Revoke`.

---

## 13. Testes

O alvo padrão e obrigatório é o estágio `test` — fakes em tudo, determinístico, sem serviço externo,
seguro como gate de merge.

Ordem de prioridade de cobertura:

1. **Casos de uso** — a regra, com portas dubladas
2. **Controllers** — entrada inválida, entrada válida, e cada erro esperado gerando o resultado certo
3. **ViewModels** — forma correta e **remoção de campo sensível**
4. **Mappers** — conversão entre DTO e entidade
5. **Fakes** — cada um honra o contrato da sua interface
6. **Presenters** — escolhem fake ou concreto corretamente por estágio
7. **Entry adapters** — só quando acrescentam cobertura além do controller

**Vetores fixos obrigatórios** para `seed → chave pública → DID` e para a montagem da apresentação.
São os pontos onde o erro é silencioso: assinatura válida localmente, inválida no servidor, e retorno
`401` sem diagnóstico.

**Testes de regressão obrigatórios** para as regras irreversíveis de §11.2.

---

## 14. Padrões proibidos

- Lógica de negócio na tela ou no presenter
- Acesso a SDK ou armazenamento fora de `clients` e `infra`
- Leitura de variável de ambiente fora de `environments.ts`
- Import de React, Expo, `fetch` ou rota dentro de um caso de uso
- Concreto de infra importado por caso de uso ou controller
- Entidade de domínio devolvida à tela sem passar por ViewModel
- **Seed atravessando a fronteira do ViewModel**
- Hook de React contendo regra de negócio
- Qualquer pasta nova no topo de `shared/`
- Um módulo importando internals de outro módulo
- Mock de módulo Expo no lugar de fake da porta
- Chamar o desafio antes da decisão da pessoa
- SDK de telemetria, analytics ou crash reporting

---

## 15. Onde eu ponho este arquivo?

| O que estou escrevendo | Onde vai |
|---|---|
| Uma tela | `src/app/**` |
| Um componente reutilizável de UI | `src/app/_components/` |
| Uma regra de aplicação nova | `src/modules/{funcionalidade}/app/*_usecase.ts` |
| Validação da entrada de uma ação | o controller daquela ação |
| Uma entidade, enum ou erro de domínio | `src/shared/domain/` |
| Uma interface nova | `src/shared/domain/interfaces/` |
| A implementação de uma interface | `src/shared/infra/` — e o fake correspondente, junto |
| Um envoltório sobre SDK ou HTTP | `src/shared/clients/` |
| Conversão entre payload da API e entidade | `src/shared/infra/dto/` |
| Um tipo de resultado ou falha | `src/shared/result/` |
| Uma configuração ou endpoint | `src/shared/environments.ts` |
| Uma função utilitária solta | **em lugar nenhum** — ela pertence a uma das camadas acima |

### 15.1 Decisões específicas desta adaptação

**`src/app/` para as rotas.** Espelha o `src/app/api/**` da API YaID. Existe uma ambiguidade herdada
— `src/app/` são rotas, `src/modules/*/app/` são camadas de aplicação — que já existe na codebase do
backend, mantida por consistência entre as frentes.

**Componentes compartilhados em `src/app/_components/`.** Componentes de UI não têm slot no modelo do
backend, que não tem interface. Ficam dentro da camada de entry adapter, onde conceitualmente
pertencem, e o prefixo `_` faz o Expo Router ignorá-los como rota. Evita abrir uma sexta pasta em
`shared/`.

**Um caso de uso por intenção da pessoa, não por chamada de API.** Autorizar envolve pedir o desafio,
montar a apresentação e enviá-la — três chamadas, **um** caso de uso, porque é uma decisão só. Da
mesma forma, abrir a tela de decisão lê o contexto da solicitação **e** confere localmente se a
credencial responde à pergunta, num único caso de uso.

---

## 16. Questões técnicas em aberto

| # | Questão | Impacto | Dono |
|---|---|---|---|
| 1 | **Apresentação como string** — o schema de verificação exige objeto; string é rejeitada | **Bloqueante** para §11.3 | API YaID |
| 2 | **Identificação da credencial sob JWT** — a revogação exige um campo `id` que deixa de existir quando a credencial vira string; passa a ser um claim do payload | Bloqueia revogação pós-Epic 9 | API YaID |
| 3 | **Ambiente da aplicação não é exposto** na solicitação | O app não consegue avisar que a verificação é de homologação | API YaID |
| 4 | **O desafio devolve só o nonce** — repetir o contexto na resposta impediria um cliente mal construído de assinar às cegas | Nenhum neste app; reforço barato | API YaID |
| 5 | **Comportamento na comprovação interrompida** não definido | Diferido para pós-validação | Diferido |
| 6 | **Teto de 1 MB da imagem** não foi medido contra a taxa de acerto do reconhecimento | Pode exigir ajuste | Este projeto |
