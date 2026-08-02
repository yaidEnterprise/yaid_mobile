# Feature Specification: D1 — Identidade e Acesso

**Feature Branch**: `001-identidade-acesso`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "@docs/PROJECT-BASELINE.md" — recorte D1 (§1.1), o primeiro dos quatro domínios do YaID Wallet. D1 não depende de nada e é construível e demonstrável isoladamente, sem servidor.

## Escopo deste documento

O baseline (§1) determina que o projeto exige **múltiplas especificações, separadas por domínio**. Esta especificação cobre **apenas D1 — Identidade e Acesso**: o momento em que a pessoa passa a existir para a YaID e define como protege o aplicativo.

**Dentro do escopo**: criação da identidade no primeiro uso, definição da senha de seis dígitos, a tela de senha reutilizável que os demais domínios invocam, a política de tentativas e bloqueio, e as duas primeiras formas da tela inicial (sem identidade, e com identidade sem credencial).

**Fora do escopo, coberto por outras especificações**: comprovação (D2), autorização (D3) e revogação (D4). D1 entrega a tela de senha como capacidade reutilizável, mas não entrega nenhuma das operações sensíveis que ela protege.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Passar a existir para a YaID (Priority: P1)

Uma pessoa instala o aplicativo e o abre pela primeira vez. Ela vê uma tela de boas-vindas explicando em duas frases o que a YaID faz. Ao tocar em "Começar", define seis dígitos como senha e os confirma. A identidade dela é criada no próprio aparelho, sem tela de espera e sem que nada seja enviado a lugar nenhum. Ao final, ela tem uma identidade, nenhuma credencial, e a tela inicial diz o que falta e por quê.

**Why this priority**: É o pré-requisito absoluto de todo o produto. Sem identidade não há credencial, e sem credencial não há autorização. Nenhum outro domínio é construível antes deste.

**Independent Test**: Pode ser testado completamente instalando o aplicativo num aparelho sem rede, percorrendo boas-vindas → criar senha → tela inicial, e confirmando que a identidade existe e persiste após fechar e reabrir o aplicativo. Entrega valor demonstrável: a tese de "identidade sem cadastro" fica provada.

**Acceptance Scenarios**:

1. **Given** o aplicativo recém-instalado e nunca aberto, **When** a pessoa o abre, **Then** ela vê a tela de boas-vindas com a explicação do que a YaID faz e uma única ação para começar.
2. **Given** a pessoa na tela de criar senha, **When** ela digita seis dígitos e os repete corretamente na confirmação, **Then** a senha é aceita e ela chega à tela inicial na forma "com identidade, sem verificação".
3. **Given** a pessoa na tela de criar senha, **When** ela digita seis dígitos e a confirmação não coincide, **Then** o aplicativo informa que os dígitos não coincidem e permite tentar a confirmação de novo, sem apagar o progresso nem culpar a pessoa.
4. **Given** o aparelho sem qualquer conexão de rede, **When** a pessoa percorre o primeiro uso inteiro, **Then** a identidade é criada com sucesso e nenhum erro de conexão aparece.
5. **Given** a pessoa concluiu o primeiro uso, **When** ela fecha o aplicativo completamente e o abre de novo, **Then** ela vê a tela inicial na forma "com identidade, sem verificação" — nunca a tela de boas-vindas de novo.
6. **Given** a pessoa concluiu o primeiro uso, **When** ela observa a tela inicial, **Then** o aplicativo declara uma vez, com clareza, que a verificação fica só naquele aparelho e que trocar de celular exigirá fotografar o documento de novo.
7. **Given** a pessoa em qualquer ponto do primeiro uso, **When** ela procura por uma tela de cadastro, e-mail, senha de conta ou palavras de recuperação, **Then** não existe nenhuma — o fluxo inteiro pede apenas os seis dígitos.

---

### User Story 2 - Provar que é ela antes de uma operação sensível (Priority: P1)

Quando o aplicativo precisa confirmar que quem está com o aparelho é a dona da identidade, ele apresenta uma tela de senha. A pessoa digita os seis dígitos. Se acertar, a operação prossegue. Se errar, o aplicativo diz quantas tentativas restam. Se esgotar as tentativas, o aplicativo bloqueia por um tempo que cresce a cada novo esgotamento — e nunca, em hipótese alguma, apaga a identidade dela.

**Why this priority**: É a única barreira entre um aparelho destravado na mão de terceiro e as três operações irreversíveis do produto. D2, D3 e D4 dependem desta capacidade existir e funcionar corretamente; ela é entregue aqui.

**Independent Test**: Pode ser testado invocando a tela de senha isoladamente e verificando os três desfechos — acerto, erro com tentativas restantes, e esgotamento com bloqueio temporário — além de confirmar que a identidade sobrevive intacta ao esgotamento.

**Acceptance Scenarios**:

1. **Given** uma pessoa com identidade criada e a tela de senha apresentada, **When** ela digita a senha correta, **Then** o aplicativo confirma sua identidade e devolve o controle a quem pediu a confirmação.
2. **Given** a tela de senha apresentada, **When** a pessoa digita uma senha incorreta e ainda tem tentativas, **Then** o aplicativo informa que a senha está incorreta e **quantas tentativas restam**, e permite tentar de novo.
3. **Given** a pessoa esgotou as tentativas disponíveis, **When** ela tenta digitar a senha de novo, **Then** o aplicativo informa que está bloqueado, por quanto tempo, e não aceita a digitação até o prazo terminar.
4. **Given** a pessoa esgotou as tentativas e o bloqueio terminou, **When** ela digita a senha correta, **Then** o aplicativo confirma sua identidade e o contador de tentativas volta ao início.
5. **Given** a pessoa esgotou as tentativas repetidas vezes, **When** cada novo esgotamento ocorre, **Then** o período de bloqueio é maior que o anterior.
6. **Given** a pessoa esgotou as tentativas qualquer número de vezes, **When** ela consulta o estado do aplicativo, **Then** sua identidade continua existindo e intacta — o esgotamento nunca a apaga.
7. **Given** a pessoa fecha o aplicativo durante um bloqueio, **When** ela o reabre antes do prazo terminar, **Then** o bloqueio continua valendo pelo tempo restante.
8. **Given** a tela de senha apresentada por qualquer operação, **When** a pessoa desiste e volta, **Then** a operação que a invocou é abandonada sem efeito e sem penalidade.

---

### User Story 3 - Abrir o aplicativo sem atrito (Priority: P2)

A pessoa abre o aplicativo para conferir seu estado. Ela chega direto à tela inicial, sem senha, porque a tela inicial não mostra nada sensível. A tela lhe diz, sem ambiguidade, em que ponto ela está: ainda não começou, ou já tem identidade e falta verificar o documento.

**Why this priority**: Depende de US1 para ter estado a exibir, mas é o que torna o aplicativo utilizável no dia a dia. R3 do baseline é explícita: abrir o aplicativo é livre. Sem esta história, o produto existe mas não se explica.

**Independent Test**: Pode ser testado abrindo o aplicativo em cada um dos dois estados de D1 e verificando que a tela correta aparece, sem senha exigida, com a próxima ação evidente.

**Acceptance Scenarios**:

1. **Given** o aplicativo instalado sem identidade, **When** a pessoa o abre, **Then** ela vê as boas-vindas e nenhuma senha é exigida.
2. **Given** uma pessoa com identidade e sem credencial, **When** ela abre o aplicativo, **Then** ela vê o que falta e por quê, com uma ação para verificar o documento, e nenhuma senha é exigida.
3. **Given** qualquer estado da tela inicial, **When** a pessoa a observa, **Then** nenhum dado sensível está visível.

---

### Edge Cases

- **A pessoa interrompe o primeiro uso antes de confirmar a senha.** Fecha o aplicativo entre as boas-vindas e a confirmação dos seis dígitos. Ao reabrir, o primeiro uso recomeça do início e nenhuma identidade parcial permanece. Uma identidade sem senha não é um estado alcançável.
- **A pessoa digita a senha e a confirmação não coincide repetidamente.** Não há limite de tentativas na *criação* — o limite existe apenas na *verificação*. Errar a confirmação ao criar não é sinal de ataque.
- **A criação da identidade não conclui.** O aplicativo informa o que houve e o que fazer, e não deixa a pessoa numa tela inicial que sugira que ela tem uma identidade. Falhar é visível, nunca silencioso (R11).
- **A pessoa desinstala e reinstala o aplicativo.** Toda a identidade se perde e o primeiro uso recomeça do zero. Não existe recuperação (R2) — e o aplicativo já avisou disso.
- **O aplicativo é aberto num aparelho cuja data e hora estão erradas.** D1 não depende de relógio correto para criar a identidade nem para verificar a senha.
- **A pessoa esgota as tentativas e desinstala o aplicativo para escapar do bloqueio.** Ela perde a identidade junto — não há atalho que preserve a identidade e zere o bloqueio.
- **A tela de senha é invocada num aparelho sem identidade criada.** Situação impossível por construção: nenhuma operação sensível existe antes do primeiro uso terminar.

## Requirements *(mandatory)*

### Functional Requirements

**Criação da identidade**

- **FR-001**: O aplicativo MUST criar a identidade da pessoa no próprio aparelho, no primeiro uso, sem enviar nada a servidor algum.
- **FR-002**: O aplicativo MUST criar a identidade sem exigir cadastro, e-mail, telefone, nome ou senha de conta — os seis dígitos são a única coisa que a pessoa digita.
- **FR-003**: O aplicativo MUST funcionar integralmente sem conexão de rede durante todo o primeiro uso.
- **FR-004**: O aplicativo MUST criar a identidade sem apresentar tela de espera, carregamento ou progresso — a operação é instantânea da perspectiva da pessoa.
- **FR-005**: O aplicativo MUST manter exatamente uma identidade por instalação. Não há como criar uma segunda.
- **FR-006**: O aplicativo MUST persistir a identidade entre execuções, de modo que ela sobreviva a fechar e reabrir o aplicativo e a reiniciar o aparelho.
- **FR-007**: O aplicativo MUST NOT oferecer qualquer mecanismo de recuperação, backup, exportação ou sincronização da identidade, e MUST NOT apresentar tela de palavras de recuperação.
- **FR-008**: O aplicativo MUST declarar à pessoa, uma vez e com clareza, que sua verificação fica apenas naquele aparelho e que trocar de aparelho exigirá comprovar de novo.
- **FR-009**: Se a criação da identidade falhar, o aplicativo MUST informar visivelmente o que houve e o que fazer, e MUST NOT apresentar a pessoa como tendo identidade.
- **FR-010**: O aplicativo MUST NOT deixar uma identidade parcial persistida se o primeiro uso for interrompido antes da confirmação da senha.

**Senha do aplicativo**

- **FR-011**: O aplicativo MUST exigir que a pessoa defina uma senha de exatamente seis dígitos numéricos durante o primeiro uso.
- **FR-012**: O aplicativo MUST exigir confirmação da senha na criação, e MUST informar de forma neutra quando os dígitos não coincidirem, permitindo nova tentativa sem perder o progresso.
- **FR-013**: O aplicativo MUST explicar, na tela de criação, para que a senha serve, em uma linha.
- **FR-014**: O aplicativo MUST recusar senhas óbvias — dígitos todos iguais e sequências crescentes ou decrescentes — explicando o motivo e permitindo escolher outra.
- **FR-015**: O aplicativo MUST apresentar teclado numérico na criação e na verificação da senha, e MUST ocultar os dígitos digitados de observadores próximos.
- **FR-016**: O aplicativo MUST NOT oferecer, no escopo de D1, alterar a senha após criada.

**Verificação da senha e política de tentativas**

- **FR-017**: O aplicativo MUST oferecer uma capacidade de verificação de senha reutilizável, invocável por qualquer operação sensível, que não conhece a operação que a invocou e apenas devolve se a pessoa foi confirmada ou desistiu.
- **FR-018**: O aplicativo MUST permitir que a pessoa desista da verificação de senha, e a desistência MUST abandonar a operação sem efeito, sem custo e sem consumir tentativa.
- **FR-019**: Ao errar a senha, o aplicativo MUST informar que ela está incorreta e **quantas tentativas restam** antes do bloqueio.
- **FR-020**: O aplicativo MUST permitir 5 tentativas incorretas consecutivas antes de bloquear a verificação de senha.
- **FR-021**: Esgotadas as tentativas, o aplicativo MUST bloquear a verificação de senha por um período crescente a cada novo esgotamento, seguindo a progressão 1 minuto, 5 minutos, 15 minutos, 1 hora, e 1 hora para os esgotamentos seguintes.
- **FR-022**: Durante o bloqueio, o aplicativo MUST informar que está bloqueado e por quanto tempo, e MUST NOT aceitar digitação da senha.
- **FR-023**: O bloqueio MUST sobreviver a fechar e reabrir o aplicativo, e MUST NOT ser encurtado por qualquer ação da pessoa dentro do aplicativo.
- **FR-024**: Uma verificação bem-sucedida MUST zerar o contador de tentativas incorretas.
- **FR-025**: O esgotamento de tentativas MUST NEVER apagar, invalidar ou tornar inacessível a identidade da pessoa, independentemente de quantas vezes ocorra.
- **FR-026**: O aplicativo MUST exigir a senha a cada operação sensível, sem qualquer sessão, cache ou janela de tempo que dispense a próxima verificação.

**Tela inicial**

- **FR-027**: O aplicativo MUST NOT exigir senha para ser aberto, nem para exibir a tela inicial.
- **FR-028**: A tela inicial MUST apresentar boas-vindas com a explicação do que a YaID faz, e uma única ação para começar, quando não houver identidade.
- **FR-029**: A tela inicial MUST apresentar o que falta e por quê, com uma ação para verificar o documento, quando houver identidade e não houver credencial.
- **FR-030**: A tela inicial MUST NOT exibir qualquer dado sensível em nenhuma de suas formas.

**Privacidade e vocabulário**

- **FR-031**: O aplicativo MUST NOT emitir qualquer evento, métrica, relatório de erro ou sinal comportamental para fora do aparelho, em nenhum momento de D1.
- **FR-032**: O aplicativo MUST NOT usar o termo "cancelar" em nenhuma mensagem exibida à pessoa, nem qualquer termo do vocabulário técnico do domínio.
- **FR-033**: Toda mensagem de erro MUST nomear o que houve e qual a próxima ação — mensagens genéricas do tipo "algo deu errado" são proibidas.

### Key Entities

- **Identidade**: O que representa a pessoa na YaID. Criada no primeiro uso, existe apenas no aparelho, nunca muda e nunca é transmitida. Uma por instalação. Sua existência é o que distingue a primeira forma da tela inicial da segunda.
- **Senha do aplicativo**: Os seis dígitos que a pessoa define no primeiro uso e digita para autorizar operações sensíveis. Definida uma vez, não alterável no escopo de D1, e nunca sai do aparelho.
- **Estado de tentativas**: O registro de quantas tentativas incorretas consecutivas ocorreram, quantos bloqueios já foram aplicados, e até quando o bloqueio corrente vale. Persiste entre execuções do aplicativo e é zerado por uma verificação bem-sucedida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa que nunca viu o aplicativo consegue instalar e ter uma identidade em **menos de um minuto**, sem digitar nada além dos seis dígitos.
- **SC-002**: O primeiro uso completo é concluído com sucesso com o aparelho em **modo avião**, sem nenhuma mensagem de erro de conexão.
- **SC-003**: Da confirmação da senha até a tela inicial, a pessoa **não vê nenhum indicador de carregamento** — a transição é imediata.
- **SC-004**: **100% das pessoas** que concluem o primeiro uso conseguem, ao serem perguntadas, afirmar corretamente que perder o aparelho significa começar de novo.
- **SC-005**: A identidade sobrevive a **100% dos ciclos** de fechar e reabrir o aplicativo e de reiniciar o aparelho.
- **SC-006**: Após qualquer número de esgotamentos de tentativas de senha, a identidade permanece intacta em **100% dos casos** — nunca há perda de identidade por erro de senha.
- **SC-007**: **Zero** requisições de rede partem do aparelho durante todo o domínio D1, verificável por inspeção de tráfego.
- **SC-008**: Ao errar a senha, **100% das mensagens** informam quantas tentativas restam; ao bloquear, **100% informam** o tempo de espera.
- **SC-009**: Uma pessoa que abre o aplicativo em qualquer estado de D1 identifica sua próxima ação em **menos de 10 segundos**, sem ajuda.
- **SC-010**: **Nenhuma** tela de D1 exibe o termo "cancelar" ou qualquer termo do vocabulário técnico do domínio.

## Assumptions

- **Recorte por domínio.** A entrada foi o baseline completo, que determina em §1 que o projeto exige múltiplas especificações separadas por domínio. Esta especificação cobre D1, o único domínio sem dependências. D2, D3 e D4 terão especificações próprias.
- **Alteração de senha fora de escopo.** Nem o baseline nem o documento de UX mencionam trocar a senha. Assume-se que a senha é definida uma vez. Se a pessoa quiser outra, o caminho é revogar e recomeçar — o que pertence a D4.
- **Senhas óbvias são recusadas.** Nem o baseline nem o UX tratam do assunto. Como a senha é a única barreira de acesso, recusar dígitos repetidos e sequências é o padrão de mercado para senhas numéricas de seis dígitos e foi adotado (FR-014).
- **Política de tentativas e bloqueio.** O UX exige tentativas restantes visíveis e bloqueio crescente, mas não fixa números. Adotou-se 5 tentativas e a progressão 1min → 5min → 15min → 1h, valores padrão para carteiras digitais: toleram erro humano genuíno e tornam a busca exaustiva de seis dígitos inviável.
- **Bloqueio ancorado no relógio do aparelho.** D1 não tem servidor para consultar. Assume-se que o bloqueio usa o relógio local e que manipulá-lo é um risco aceito neste recorte — quem manipula o relógio já tem o aparelho destravado em mãos.
- **Biometria fora de escopo.** O baseline especifica seis dígitos como o mecanismo de autorização (R3). Biometria não é mencionada e não foi assumida.
- **Tela de senha invocada, não navegada.** Conforme o mapa de telas do UX, a tela de senha é a mesma nos três fluxos que a exigem: é chamada, devolve, e não sabe para que serve. D1 a entrega com este contrato.
- **Permissões do sistema fora do primeiro uso.** Nenhuma permissão de aparelho é pedida em D1; a permissão de câmera é pedida em D2, no momento em que faz sentido.
- **Nenhuma notificação.** O produto não envia notificações ao aparelho, portanto D1 não pede permissão de notificação.
