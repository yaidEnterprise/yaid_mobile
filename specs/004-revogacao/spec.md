# Feature Specification: Revogação de Credencial (D4)

**Feature Branch**: `004-revogacao`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "@docs/PROJECT-BASELINE.md — Domínio D4: a pessoa invalida sua credencial permanentemente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Revogar a credencial com sucesso (Priority: P1)

A pessoa, estando com uma credencial válida no aparelho, decide invalidá-la permanentemente. Ela navega até a opção de revogação, lê o aviso de que a operação não tem volta, digita sua senha de seis dígitos e confirma. O aplicativo comunica a revogação à YaID, apaga a credencial localmente e exibe uma tela de confirmação dedicada informando que a credencial foi invalidada.

**Why this priority**: Este é o fluxo principal do domínio. Sem ele, D4 não existe. Todas as outras histórias são ramificações ou proteções deste caminho feliz.

**Independent Test**: Pode ser testado isoladamente iniciando o aplicativo no estado "identidade criada + credencial emitida", executando o fluxo de revogação completo e verificando que (a) a tela de confirmação é exibida, (b) o aplicativo retorna ao estado "sem credencial" e (c) uma tentativa subsequente de autorização falha com mensagem apropriada.

**Acceptance Scenarios**:

1. **Given** a pessoa possui uma credencial válida no aparelho, **When** ela conclui o fluxo de revogação com senha correta e confirmação, **Then** a tela de resultado dedicada é exibida informando que a credencial foi revogada, a credencial deixa de existir localmente e qualquer tentativa futura de autorização informa que não há credencial válida.
2. **Given** a credencial foi revogada com sucesso, **When** a pessoa retorna à tela inicial, **Then** o estado do aplicativo reflete "sem credencial" e a opção de comprovar fica disponível novamente.
3. **Given** a pessoa possui uma credencial válida, **When** ela inicia o fluxo de revogação mas recua antes de confirmar, **Then** a credencial permanece intacta e o aplicativo retorna ao estado anterior sem alteração.

---

### User Story 2 — Confirmação explícita antes da revogação (Priority: P1)

Antes de revogar, a pessoa recebe uma tela de confirmação que declara explicitamente que a operação é irreversível. Os dois botões — confirmar e cancelar — têm peso visual equivalente. Ela não consegue completar a revogação sem passar por esta tela.

**Why this priority**: A irreversibilidade é uma propriedade do produto (R12). Uma revogação acidental não tem correção possível. A tela de confirmação é a única proteção disponível contra esse cenário.

**Independent Test**: Pode ser testado verificando que qualquer caminho que leva à revogação obrigatoriamente atravessa a tela de confirmação, que a tela declara a irreversibilidade em linguagem clara e não técnica, e que tocar em "Cancelar" ou fechar a tela interrompe o fluxo sem efeito colateral.

**Acceptance Scenarios**:

1. **Given** a pessoa inicia o fluxo de revogação, **When** ela avança além da entrada de senha, **Then** uma tela de confirmação é exibida declarando que a credencial será invalidada permanentemente e que a operação não pode ser desfeita.
2. **Given** a tela de confirmação está visível, **When** a pessoa toca em "Cancelar", **Then** o fluxo é encerrado, a credencial permanece intacta e nenhuma chamada é feita à YaID.
3. **Given** a tela de confirmação está visível, **When** a pessoa toca em confirmar, **Then** o aplicativo prossegue com a revogação.

---

### User Story 3 — Senha incorreta durante a revogação (Priority: P2)

A pessoa tenta revogar, mas digita a senha errada. O aplicativo recusa a operação, informa a senha está incorreta, registra a tentativa e aplica retardo progressivo após tentativas consecutivas. A credencial permanece intacta.

**Why this priority**: A senha protege uma operação irreversível. Uma falha de senha não deve produzir revogação acidental nem apagar a identidade da pessoa.

**Independent Test**: Pode ser testado inserindo senhas incorretas no fluxo de revogação e verificando que (a) a operação é bloqueada, (b) a credencial continua existindo, (c) mensagem de erro nomeia a causa e instrui a próxima ação, e (d) a identidade permanece intacta independentemente do número de tentativas.

**Acceptance Scenarios**:

1. **Given** a pessoa está no passo de senha do fluxo de revogação, **When** ela digita uma senha incorreta, **Then** a operação é recusada com mensagem que identifica a causa (senha incorreta) e indica o que fazer a seguir; a credencial não é alterada.
2. **Given** a pessoa errou a senha consecutivamente, **When** ela tenta novamente, **Then** o retardo progressivo é aplicado antes de aceitar nova tentativa; a identidade nunca é apagada por falha de senha.

---

### User Story 4 — Falha de comunicação durante a revogação (Priority: P2)

A pessoa tenta revogar mas o aparelho está sem conectividade ou a YaID retorna erro. O aplicativo informa o problema com uma mensagem que nomeia a causa e orienta a próxima ação. A credencial não é alterada.

**Why this priority**: Uma falha silenciosa deixaria a pessoa acreditando que revogou quando não revogou — o mesmo problema descrito para comprovação no baseline (R11). O princípio "falha é visível" aplica-se aqui com a mesma força.

**Independent Test**: Pode ser testado simulando falha de rede ou resposta de erro da YaID durante a revogação e verificando que (a) a tela de erro é exibida com mensagem clara, (b) a credencial permanece válida, e (c) a pessoa consegue tentar novamente.

**Acceptance Scenarios**:

1. **Given** a pessoa confirmou a revogação, **When** a comunicação com a YaID falha por qualquer razão, **Then** uma tela de erro é exibida nomeando o problema e indicando que a credencial não foi alterada; a operação pode ser repetida.
2. **Given** a comunicação falhou, **When** a pessoa decide tentar novamente, **Then** o fluxo retoma a partir do passo de confirmação.

---

### User Story 5 — Revogação quando não há credencial (Priority: P3)

A pessoa tenta acessar a opção de revogação sem possuir uma credencial. O aplicativo torna a opção indisponível ou informa que não há credencial para revogar.

**Why this priority**: Estado de proteção: garante que o fluxo de revogação só é acessível quando faz sentido semântico. Não bloqueia nenhuma história de prioridade mais alta.

**Independent Test**: Pode ser testado com o aplicativo no estado "identidade criada, sem credencial" e verificando que a opção de revogação está inacessível ou exibe mensagem contextual.

**Acceptance Scenarios**:

1. **Given** a pessoa não possui credencial, **When** ela tenta acessar a opção de revogação, **Then** o aplicativo informa que não há credencial a revogar ou torna a opção visivelmente indisponível.

---

### Edge Cases

- O que acontece se a pessoa fechar o aplicativo após digitar a senha mas antes de tocar em confirmar? A credencial deve permanecer intacta.
- O que acontece se a conexão cair entre o passo de confirmação e a resposta da YaID? A credencial só é apagada localmente após confirmação da YaID.
- O que acontece se a YaID retornar sucesso mas o apagamento local falhar? A pessoa precisa ser orientada — estado inconsistente não pode ser silencioso.
- O que acontece se a pessoa tentar revogar uma credencial que a YaID já considera revogada (por inconsistência)? O fluxo deve tratar o resultado como revogação bem-sucedida e limpar o estado local.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exigir a senha de seis dígitos antes de prosseguir com a revogação.
- **FR-002**: O sistema DEVE exibir uma tela de confirmação dedicada antes de executar a revogação, declarando explicitamente que a operação é permanente e irreversível.
- **FR-003**: A tela de confirmação DEVE apresentar as opções "Confirmar" e "Cancelar" com peso visual equivalente — nenhuma das duas pode ser ghost, oculta ou visivelmente secundária.
- **FR-004**: O sistema DEVE comunicar a revogação à YaID antes de apagar a credencial localmente.
- **FR-005**: O sistema DEVE apagar a credencial do armazenamento local somente após receber confirmação de sucesso da YaID.
- **FR-006**: Após revogação bem-sucedida, o sistema DEVE exibir uma tela de resultado dedicada — não um toast — confirmando que a credencial foi invalidada.
- **FR-007**: O sistema DEVE retornar ao estado "sem credencial" após revogação bem-sucedida, tornando a comprovação disponível novamente.
- **FR-008**: Em caso de falha de comunicação, o sistema DEVE exibir mensagem que nomeia a causa e informa que a credencial não foi alterada; a operação NÃO DEVE ser silenciosa.
- **FR-009**: A falha de senha NÃO DEVE apagar a identidade da pessoa nem a credencial.
- **FR-010**: Apenas a própria pessoa pode revogar sua credencial; nenhum outro agente (YaID, empresa) pode iniciar a revogação pelo aplicativo.
- **FR-011**: O sistema NÃO DEVE exibir a opção de revogação como ativa quando a pessoa não possui credencial.
- **FR-012**: O sistema DEVE aplicar retardo progressivo após tentativas consecutivas de senha incorreta durante a revogação.

### Key Entities *(include if feature involves data)*

- **Credencial**: O objeto emitido pela YaID que carrega as duas respostas da pessoa. Existe apenas no aparelho. A revogação apaga este objeto localmente e o invalida no registro da YaID. Após revogação, não existe mais — não há estado "revogada" local; ausência é o estado.
- **Identidade**: A representação da pessoa no YaID, criada no primeiro uso. A revogação da credencial NÃO afeta a identidade; a identidade permanece e a comprovação pode ser feita novamente.
- **Senha do aplicativo**: Os seis dígitos exigidos para confirmar a operação. Guardada localmente; não transmitida à YaID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa com credencial válida consegue completar o fluxo de revogação em menos de dois minutos a partir do momento em que decide revogar.
- **SC-002**: Após revogação bem-sucedida, 100% das tentativas de autorização subsequentes informam que não há credencial válida — zero autorizações são completadas com credencial revogada.
- **SC-003**: A tela de confirmação é exibida em 100% dos caminhos que levam à execução da revogação — não existe caminho que execute a revogação sem passar por ela.
- **SC-004**: 100% das falhas de comunicação durante a revogação produzem mensagem visível com causa identificada — zero falhas silenciosas.
- **SC-005**: Nenhuma tentativa de senha incorreta, independentemente do número de tentativas, resulta em perda de identidade ou credencial.
- **SC-006**: A opção de revogar não é acionável quando a pessoa não possui credencial — zero invocações do fluxo de revogação em estado "sem credencial".

## Assumptions

- A revogação requer conectividade com a YaID: não é possível revogar offline, pois a credencial precisa ser invalidada no registro centralizado.
- A credencial só é apagada localmente após confirmação da YaID; se a YaID não responder, a credencial permanece válida.
- Após revogar, a pessoa pode comprovar novamente e obter uma nova credencial — não há penalidade nem restrição por ter revogado antes.
- A senha usada para revogar é a mesma senha do aplicativo definida no primeiro uso (D1); não há senha específica para revogação.
- O retardo progressivo por senha incorreta persiste no estado do aplicativo; fechar e reabrir não zera o contador.
- A revogação bem-sucedida não desinstala o aplicativo nem apaga a identidade — apenas remove a credencial.
- A YaID não envia confirmação fora de banda (notificação push, e-mail) após a revogação; a única confirmação é a tela de resultado no aplicativo.
