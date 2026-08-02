# Feature Specification: D3 — Autorização

**Feature Branch**: `003-autorizacao`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "@docs/PROJECT-BASELINE.md" — recorte D3 (§1.1), o terceiro dos quatro domínios do YaID Wallet. D3 depende de D1 e D2 e é o domínio que justifica o produto: é aqui que a credencial é usada pela primeira vez para responder a uma solicitação real de uma empresa.

## Escopo deste documento

O baseline (§1) determina que o projeto exige **múltiplas especificações, separadas por domínio**. Esta especificação cobre **apenas D3 — Autorização**: o fluxo completo pelo qual a pessoa responde, dentro do aplicativo, a uma solicitação de verificação iniciada por uma empresa parceira.

**Dentro do escopo**: chegada pelo link (Universal Link / App Link), consulta da solicitação, verificação de elegibilidade local, tela de decisão (autorizar ou recusar), entrada da senha, envio da apresentação à YaID, e os quatro estados terminais (verificado, recusado, expirado, falhou). Inclui também os comportamentos de chegada sem identidade, sem credencial, e com link expirado ou já utilizado.

**Fora do escopo, coberto por outras especificações**: criação da identidade (D1), emissão da credencial (D2), e revogação da credencial (D4). D3 consome a credencial entregue por D2 sem redefiní-la, e a tela de senha entregue por D1.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Autorizar uma verificação com sucesso (Priority: P1)

Uma pessoa com identidade e credencial está navegando no site de uma empresa parceira. Ela toca no botão de verificação YaID da página, o aplicativo abre e mostra a tela de chegada enquanto consulta a solicitação. Em seguida, vê a tela de decisão: o nome da empresa e a pergunta estão claramente exibidos, com a garantia de privacidade. Ela decide autorizar, digita sua senha e o aplicativo constrói e envia a apresentação à YaID. O resultado exibe "Pronto. A empresa recebeu sua resposta." e ela retorna ao início.

**Why this priority**: É o único fluxo que entrega o valor do produto — a empresa recebe a resposta sem receber dados pessoais. Todo o resto do produto existe para tornar este momento possível.

**Independent Test**: Pode ser testado completamente com um aparelho com credencial emitida, um link de sessão válido fornecido por uma empresa em homologação, percorrendo chegada → tela de decisão → senha → enviando → resultado "Verificado".

**Acceptance Scenarios**:

1. **Given** a pessoa toca no botão de verificação no site da empresa com o app instalado e a credencial emitida, **When** o link abre o aplicativo, **Then** o app exibe a tela de chegada com as cores e o logotipo da empresa enquanto consulta a solicitação — sem exibir tela de decisão ainda.
2. **Given** a consulta da solicitação retornou com sucesso e a credencial consegue responder à pergunta, **When** a tela de decisão aparece, **Then** ela exibe o nome da empresa como elemento de maior peso visual, seguido da pergunta em linguagem natural, seguido da garantia de privacidade, e dois botões de mesmo tamanho: "Autorizar" e "Recusar".
3. **Given** a tela de decisão está visível, **When** os primeiros ~400 ms se passam, **Then** os botões tornam-se interativos — antes disso estão inertes.
4. **Given** a pessoa toca em "Autorizar", **When** o aplicativo avança, **Then** apresenta a tela de senha (seis dígitos) antes de qualquer chamada irreversível à API.
5. **Given** a pessoa digitou a senha correta, **When** o aplicativo obtém o desafio da YaID e constrói a apresentação, **Then** exibe tela de espera com texto descrevendo o que está acontecendo — sem barra de progresso falsa.
6. **Given** a YaID validou a apresentação com sucesso, **When** o resultado chega ao aplicativo, **Then** a tela de resultado "Verificado" é exibida com a mensagem "Pronto. A empresa recebeu sua resposta." em verde, com saída para a tela inicial.
7. **Given** a autorização foi concluída com sucesso, **When** a pessoa retorna à tela inicial, **Then** ela está na terceira forma (com credencial), sem rastro da solicitação.

---

### User Story 2 — Recusar uma verificação (Priority: P1)

A pessoa vê a tela de decisão, decide não autorizar e toca em "Recusar". O aplicativo confirma a recusa sem pedir justificativa, sem "tem certeza?" e sem custo. A credencial permanece intacta. A sessão é cancelada junto à YaID.

**Why this priority**: R10 do baseline é explícita: recusar precisa ser tão fácil quanto autorizar, ou o consentimento não é real. Esta story é o que dá significado ao botão "Autorizar" — sem a recusa real e sem custo, a escolha é ilusória.

**Independent Test**: Pode ser testado abrindo um link válido, chegando à tela de decisão e tocando em "Recusar" — verificando que o resultado "Recusado" aparece e que a credencial permanece intacta na tela inicial.

**Acceptance Scenarios**:

1. **Given** a pessoa está na tela de decisão, **When** ela toca em "Recusar", **Then** o aplicativo não exibe diálogo de confirmação nem solicita justificativa — avança direto ao resultado.
2. **Given** a pessoa tocou em "Recusar", **When** o resultado aparece, **Then** exibe "Você recusou. Nada foi enviado." em cinza, com saída para a tela inicial.
3. **Given** a recusa foi registrada, **When** a pessoa retorna à tela inicial, **Then** a credencial está intacta — na terceira forma, como antes da solicitação.
4. **Given** a pessoa tocou em "Recusar", **When** o aplicativo envia o cancelamento à YaID, **Then** a YaID registra a sessão como cancelada e a empresa recebe a notificação correspondente — tudo sem que a credencial seja consumida.

---

### User Story 3 — Credencial inelegível para a pergunta (Priority: P1)

A empresa pede confirmação de maioridade, mas a credencial da pessoa indica `ageOver18: false` (ela comprovou sendo menor de 18 anos). O aplicativo detecta isso **antes** de abrir a tela de decisão e antes de qualquer chamada irreversível. Exibe uma tela específica explicando a situação e oferece apenas a opção de recusar — porque autorizar seria inútil e queimaria a sessão.

**Why this priority**: Sem esta verificação, a pessoa tocaria em "Autorizar", a YaID rejeitaria a apresentação, a sessão seria destruída e ela não saberia por quê. A inelegibilidade silenciosa é a forma de falha mais frustrante e mais evitável.

**Independent Test**: Pode ser testado com uma credencial que tenha `ageOver18: false` e um link de sessão de tipo `ageOver18` — verificando que a tela de decisão não aparece e que a tela de inelegibilidade é exibida corretamente.

**Acceptance Scenarios**:

1. **Given** a solicitação pede `ageOver18` e a credencial da pessoa tem `ageOver18: false`, **When** a consulta da solicitação é processada, **Then** o aplicativo exibe a tela de inelegibilidade com a mensagem "A [empresa] quer confirmar que você tem mais de 18 anos. Sua verificação YaID indica que não. Você pode recusar este pedido." — sem nunca exibir a tela de decisão.
2. **Given** a tela de inelegibilidade está visível, **When** a pessoa toca em "Recusar", **Then** o fluxo segue o mesmo caminho de recusa normal — a sessão é cancelada e o resultado "Recusado" é exibido.
3. **Given** a inelegibilidade foi detectada, **When** o aplicativo exibe a tela de inelegibilidade, **Then** nenhuma chamada ao endpoint de challenge foi feita — a sessão não foi consumida.

---

### User Story 4 — Link expirado ou já utilizado (Priority: P2)

A pessoa abre um link de solicitação que já expirou ou já foi utilizado. O aplicativo consulta a solicitação, detecta o estado terminal e exibe a tela de resultado "Expirado" com orientação para solicitar um novo link à empresa.

**Why this priority**: É o estado não-feliz mais comum no uso real — links têm validade de 30 minutos e a pessoa pode demorar a abrir. O aplicativo precisa responder claramente, sem entrar em loop ou trava.

**Independent Test**: Pode ser testado abrindo um link cuja sessão já passou dos 30 minutos ou foi usada anteriormente.

**Acceptance Scenarios**:

1. **Given** a pessoa abre um link cuja sessão está expirada, **When** o aplicativo consulta a solicitação, **Then** exibe a tela de resultado "Expirado" com "Este pedido expirou. Peça um novo à empresa." em âmbar.
2. **Given** a pessoa abre um link cuja sessão já está no estado `opened` (challenge já consumido), **When** o aplicativo detecta o estado, **Then** trata a sessão como irrecuperável e exibe a tela "Expirado" — nunca tenta prosseguir.
3. **Given** a pessoa abre um link cuja sessão já está aprovada ou cancelada (estado terminal), **When** o aplicativo detecta, **Then** exibe a tela "Expirado" com orientação para solicitar um novo link.

---

### User Story 5 — Chegada sem identidade ou sem credencial (Priority: P2)

A pessoa abre um link de solicitação, mas não tem identidade criada ou não tem credencial emitida. O aplicativo mostra quem está pedindo e explica o que precisa ser feito antes de poder responder à solicitação, orientando a voltar ao site da empresa depois de concluir o passo necessário.

**Why this priority**: A ordem de dependência é D1 → D2 → D3. A pessoa pode instalar o app sem percorrer D1 e D2 antes de ser enviada ao aplicativo pela empresa. O app precisa acolher esse estado sem travar.

**Independent Test**: Pode ser testado abrindo um link de solicitação válido em um app recém-instalado sem identidade, e depois em um app com identidade mas sem credencial.

**Acceptance Scenarios**:

1. **Given** a pessoa abre um link de solicitação sem ter identidade criada, **When** o aplicativo detecta, **Then** exibe a empresa que está pedindo e explica que é preciso concluir o primeiro uso antes — com orientação para voltar ao site da empresa depois.
2. **Given** a pessoa abre um link de solicitação sem ter credencial emitida, **When** o aplicativo detecta, **Then** exibe a empresa que está pedindo e explica que é preciso verificar o documento antes — com orientação para voltar ao site da empresa depois.
3. **Given** a pessoa sem credencial vê a tela de orientação, **When** ela decide ir verificar o documento, **Then** o link da solicitação não é preservado — ela precisará voltar ao site da empresa para obter um novo link após a comprovação.

---

### User Story 6 — Aplicativo volta do segundo plano na tela de decisão (Priority: P2)

A pessoa está na tela de decisão e manda o aplicativo para o segundo plano (troca de app, ligação, notificação). Quando retorna, o aplicativo reconsulta a solicitação antes de permitir qualquer ação. A sessão pode ter expirado nesse intervalo.

**Why this priority**: Uma sessão que expirou enquanto o app estava em segundo plano não deve permitir que a pessoa toque em "Autorizar" — isso queimaria a sessão e retornaria uma falha opaca.

**Independent Test**: Pode ser testado abrindo a tela de decisão, mandando o app ao segundo plano por mais de 30 minutos, retornando e verificando se o app reconsolida a sessão corretamente.

**Acceptance Scenarios**:

1. **Given** a pessoa está na tela de decisão e o aplicativo vai ao segundo plano, **When** ela retorna ao primeiro plano, **Then** o aplicativo reconsulta a sessão antes de reabilitar os botões.
2. **Given** a sessão expirou enquanto o app estava em segundo plano, **When** o app reconsolida e detecta o estado, **Then** exibe a tela "Expirado" — sem permitir que a pessoa tente autorizar uma sessão morta.
3. **Given** a sessão ainda está válida ao retornar, **When** o app confirma o estado, **Then** a tela de decisão é reapresentada normalmente.

---

### Edge Cases

- **Sem internet ao abrir o link.** O aplicativo detecta a ausência de conexão antes da consulta, informa que não há conexão e oferece tentar de novo. Nunca trava nem exibe tela de decisão incompleta.
- **Sem internet durante o envio da apresentação.** A tela de espera informa a falha de conectividade e oferece tentar de novo. A sessão não foi consumida — o challenge foi obtido mas a apresentação não chegou ao servidor.
- **Relógio do aparelho incorreto.** A autenticação DID falha por timestamp fora da janela. O aplicativo exibe mensagem específica: "A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo." — nunca uma mensagem genérica.
- **YaID retorna `{ "valid": false }` após a apresentação.** A falha é opaca e terminal. O app exibe "Não foi possível concluir. Comece de novo pelo site da empresa." em vermelho. Não há retry na mesma sessão.
- **A pessoa tenta usar o gesto de voltar na tela de decisão.** O gesto não produz efeito. A única saída da tela de decisão são os botões "Autorizar" e "Recusar".
- **A pessoa toca fora dos botões na tela de decisão.** Sem efeito. Toques fora dos dois botões não produzem ação.
- **Sem internet durante a consulta inicial da sessão.** A tela de chegada aguarda ou informa ausência de conexão — nunca exibe tela de decisão sem dados da solicitação.
- **A empresa está em ambiente de homologação.** O aplicativo não distingue homologação de produção na tela de decisão — exibe o nome da empresa conforme registrado (Q4 do baseline, questão em aberto).

---

## Requirements *(mandatory)*

### Functional Requirements

**Chegada pelo link**

- **FR-001**: O aplicativo MUST responder ao Universal Link / App Link `yaid://verify?session=<token>` ou ao scheme equivalente e iniciar o fluxo de autorização sem intervenção da pessoa.
- **FR-002**: Ao abrir pelo link, o aplicativo MUST exibir a tela de chegada enquanto consulta a solicitação — nunca exibir a tela de decisão antes de ter os dados da sessão.
- **FR-003**: A tela de chegada MUST manter continuidade visual com a página da empresa que iniciou o fluxo (mesmo tom, logotipo YaID).
- **FR-004**: A tela de chegada é a **única tela que pode conter transição de carregamento** em todo o domínio D3.

**Consulta da solicitação**

- **FR-005**: O aplicativo MUST consultar `GET /api/proof-sessions/{sessionToken}` ao abrir o link — chamada pública, idempotente, que retorna companyName, proofType, expiresAt e status.
- **FR-006**: Se a solicitação estiver em estado terminal (expirada, aprovada, cancelada) ou em estado `opened` (challenge já consumido), o aplicativo MUST exibir a tela "Expirado" e não prosseguir.
- **FR-007**: O aplicativo MUST verificar se a pessoa tem identidade antes de exibir a tela de decisão. Se não tiver, MUST exibir orientação com o nome da empresa e a instrução de concluir o primeiro uso.
- **FR-008**: O aplicativo MUST verificar se a pessoa tem credencial emitida antes de exibir a tela de decisão. Se não tiver, MUST exibir orientação com o nome da empresa e a instrução de verificar o documento.

**Verificação de elegibilidade local**

- **FR-009**: Antes de exibir a tela de decisão, o aplicativo MUST verificar localmente se a credencial da pessoa consegue responder ao `proofType` da solicitação.
- **FR-010**: Se a credencial não puder responder (ex.: `ageOver18: false` para uma solicitação de maioridade), o aplicativo MUST exibir a tela de inelegibilidade com o nome da empresa, a pergunta que foi feita e a explicação do porquê não pode autorizar — sem jamais exibir a tela de decisão.
- **FR-011**: A verificação de elegibilidade MUST ocorrer **sem** qualquer chamada ao endpoint de challenge — a sessão não deve ser consumida por uma verificação de elegibilidade.

**Tela de decisão**

- **FR-012**: A tela de decisão MUST exibir o nome da empresa como elemento de maior peso visual.
- **FR-013**: A tela de decisão MUST exibir a pergunta em linguagem natural, conforme o mapeamento de vocabulário (§9 do UX.md): `personhood` → "você é uma pessoa real"; `age_over_18` → "você tem mais de 18 anos".
- **FR-014**: A tela de decisão MUST exibir a garantia de privacidade: "A empresa recebe apenas sim ou não. Nenhum dado seu é enviado."
- **FR-015**: A tela de decisão MUST exibir exatamente dois botões — "Autorizar" e "Recusar" — com **a mesma área de toque e o mesmo tamanho**.
- **FR-016**: Os botões da tela de decisão MUST ser inertes por aproximadamente 400 ms após a tela aparecer.
- **FR-017**: **Nada** na tela de decisão MUST animar — a tela aparece completamente composta.
- **FR-018**: **Nenhum toque** fora dos dois botões MUST produzir qualquer efeito na tela de decisão.
- **FR-019**: O gesto de voltar MUST ser desabilitado na tela de decisão.
- **FR-020**: **Nenhum contador regressivo** MUST ser exibido na tela de decisão.
- **FR-021**: Para acessibilidade, o nome da empresa e a pergunta MUST ser anunciados pelo leitor de tela **antes** dos botões, na ordem de leitura.

**Recusa**

- **FR-022**: Se a pessoa tocar em "Recusar", o aplicativo MUST cancelar a sessão via `POST /api/proof-sessions/{sessionToken}/cancel` (autenticado por DID).
- **FR-023**: O aplicativo MUST NOT exibir diálogo de confirmação de recusa nem solicitar justificativa.
- **FR-024**: Após a recusa, o aplicativo MUST exibir a tela de resultado "Recusado" com a mensagem "Você recusou. Nada foi enviado." em cinza.
- **FR-025**: A recusa MUST NOT afetar a credencial — ela permanece válida e intacta.

**Autorização — sequência obrigatória**

- **FR-026**: Se a pessoa tocar em "Autorizar", o aplicativo MUST exibir a tela de senha antes de qualquer chamada irreversível à API.
- **FR-027**: O aplicativo MUST obter o challenge via `GET /api/proof-sessions/{sessionToken}/challenge` **somente após** a pessoa digitar a senha correta e confirmar a autorização — nunca na abertura da tela de decisão.
- **FR-028**: O aplicativo MUST construir a apresentação assinando `JSON.stringify({holder, challenge, verifiableCredential})` nessa ordem exata com a chave privada da identidade, e incluir o proof resultante.
- **FR-029**: O aplicativo MUST enviar a apresentação via `POST /api/presentations/verify` (autenticado por DID).
- **FR-030**: Durante o envio, o aplicativo MUST exibir tela de espera com texto descrevendo o que está acontecendo.

**Resultado — autorização**

- **FR-031**: Se `presentations/verify` retornar `{ "valid": true }`, o aplicativo MUST exibir a tela "Verificado" com a mensagem "Pronto. A empresa recebeu sua resposta." em verde.
- **FR-032**: Se `presentations/verify` retornar `{ "valid": false }` (qualquer causa — assinatura, VC revogada, nonce divergente, challenge expirado), o aplicativo MUST exibir a tela "Falhou" com a mensagem "Não foi possível concluir. Comece de novo pelo site da empresa." em vermelho — sem tentar identificar a causa específica.
- **FR-033**: A falha em `presentations/verify` MUST ser tratada como **terminal** — o aplicativo MUST NOT oferecer retry na mesma sessão.

**Retorno ao segundo plano**

- **FR-034**: Se o aplicativo retornar ao primeiro plano enquanto a tela de decisão está ativa, MUST reconsultar a sessão antes de reabilitar os botões.
- **FR-035**: Se a sessão expirou durante o segundo plano, MUST exibir a tela "Expirado" ao retornar.

**Falhas e estados excepcionais**

- **FR-036**: Se não houver conexão ao consultar a solicitação, o aplicativo MUST informar ausência de conexão e oferecer tentar de novo.
- **FR-037**: Se o relógio do aparelho estiver incorreto e a autenticação DID falhar, o aplicativo MUST exibir mensagem específica orientando a ajustar a data e hora — nunca mensagem genérica.
- **FR-038**: Toda mensagem de falha MUST nomear o que houve e indicar a próxima ação — mensagens genéricas como "algo deu errado" são proibidas.
- **FR-039**: O aplicativo MUST NOT emitir qualquer evento, métrica ou sinal comportamental fora do dispositivo em nenhuma etapa de D3.

**Vocabulário e acessibilidade**

- **FR-040**: O aplicativo MUST NOT exibir termos técnicos do domínio (DID, chave, assinatura, token, sessão, nonce, blockchain, credencial verificável, apresentação, criptografia) em nenhuma tela de D3.
- **FR-041**: Todos os estados terminais MUST usar tela dedicada — nenhum resultado MUST ser comunicado via toast ou notificação efêmera.

### Key Entities

- **ProofSession (Solicitação de verificação)**: A sessão iniciada pela empresa. Carrega `sessionToken`, `companyName`, `proofType` (personhood | age_over_18), `expiresAt` e `status`. É efêmera — o aplicativo não a persiste; cada uso do link começa com uma nova consulta ao servidor.
- **Presentation (Apresentação)**: Construída pelo aplicativo durante o fluxo de autorização. Contém a credencial da pessoa, o DID do holder, o challenge obtido do servidor e a assinatura Ed25519 sobre `JSON.stringify({holder, challenge, verifiableCredential})` nessa ordem exata. Nunca é armazenada localmente.
- **Challenge**: Nonce de uso único obtido via `GET .../challenge`. Irreversível — consumi-lo muda o estado da sessão para `opened`. O aplicativo só o obtém após a pessoa confirmar a autorização com a senha.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa com credencial consegue autorizar uma verificação, da abertura do link ao resultado "Verificado", em **menos de 90 segundos** em condições normais de rede.
- **SC-002**: **100% das autorizações** em que o `GET /challenge` é chamado antes da decisão da pessoa são identificadas como violação de sequência em revisão de código — o sequenciamento correto é verificável por inspeção.
- **SC-003**: **Zero** chamadas ao endpoint de challenge ocorrem em sessões onde a elegibilidade local foi negada — verificável por inspeção de tráfego.
- **SC-004**: **100% dos estados terminais** (Verificado, Recusado, Expirado, Falhou) exibem tela dedicada — nenhum resultado é comunicado por toast ou mensagem efêmera.
- **SC-005**: **100% das falhas** identificam a causa (ausência de conexão, relógio incorreto, sessão expirada, falha de verificação) e oferecem próxima ação — nenhuma mensagem é genérica.
- **SC-006**: A credencial permanece intacta em **100% das recusas** — verificável inspecionando o estado da tela inicial após a recusa.
- **SC-007**: A tela de decisão aparece **sem animação** e com botões inertes nos primeiros ~400 ms em **100% das exibições** — verificável por inspeção de interface.
- **SC-008**: **"Autorizar" e "Recusar" têm área de toque idêntica** em todas as resoluções de dispositivo suportadas — verificável por inspeção de layout.
- **SC-009**: **Nenhuma tela de D3** exibe termos técnicos do domínio (DID, assinatura, nonce, token, sessão, blockchain, credencial verificável) — verificável por inspeção de textos.
- **SC-010**: O aplicativo reconsulta a sessão em **100% dos retornos** do segundo plano enquanto a tela de decisão está ativa — verificável por inspeção de chamadas de rede.

---

## Assumptions

- **Recorte por domínio.** Esta especificação cobre apenas D3. A tela de senha, a identidade e a credencial são entregues por D1 e D2 e consumidas aqui sem redefinição. O link é sempre o ponto de entrada — não há chegada ao fluxo de autorização pela navegação interna do app.
- **Mesmo aparelho.** Conforme R5 do baseline, a solicitação só funciona no aparelho onde a pessoa está navegando. O fluxo entre aparelhos diferentes é extensão futura e não está nesta especificação.
- **Uma pergunta por solicitação.** Conforme R8 do baseline, cada solicitação faz uma pergunta só e a resposta é binária (sim/não). Não há resposta parcial nem pontuação.
- **Falha de verificação é opaca.** O servidor retorna `{ "valid": false }` sem especificar a causa (assinatura inválida, VC revogada, nonce expirado, DID não registrado). O aplicativo exibe mensagem genérica única para todos esses casos — isso é decisão de produto, não limitação técnica.
- **O challenge é irreversível.** Após `GET .../challenge`, a sessão muda para `opened` e o challenge não pode ser reobtido. Encontrar uma sessão em `opened` ao reconectar significa que o challenge foi consumido e a sessão é irrecuperável.
- **Não há notificações push em D3.** O aplicativo só entra no fluxo de autorização quando a pessoa abre o link ativamente. Notificações enviadas ao aparelho estão fora de escopo (§7 do baseline).
- **Não há histórico de verificações.** Conforme §3.2 do baseline, o aplicativo não guarda registro de quais empresas fizeram solicitações nem quais foram autorizadas ou recusadas — por decisão de produto, não por limitação.
- **A grafia do proofType diverge entre endpoints.** `POST /credentials/issue` usa `ageOver18` (camelCase); `GET /proof-sessions/{token}` usa `age_over_18` (snake_case). O domínio mantém um enum canônico único; a conversão ocorre exclusivamente no adaptador HTTP — conforme §8.2 do MOBILE-API-CONTRACT.md.
- **A empresa em homologação não é distinguível.** O aplicativo não informa à pessoa se a solicitação vem de uma aplicação de homologação ou produção (Q4 do baseline — questão em aberto sem impacto no início da construção).
