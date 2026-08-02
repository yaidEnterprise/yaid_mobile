# Feature Specification: D2 — Comprovação

**Feature Branch**: `002-comprovacao`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "@docs/PROJECT-BASELINE.md" — recorte D2 (§1.1), o segundo dos quatro domínios do YaID Wallet. D2 depende de D1 e entrega a credencial que os domínios D3 e D4 pressupõem existir.

## Escopo deste documento

O baseline (§1) determina que o projeto exige **múltiplas especificações, separadas por domínio**. Esta especificação cobre **apenas D2 — Comprovação**: o ato de a pessoa fotografar seu documento de identidade e receber a credencial que carrega as duas respostas sobre ela.

**Dentro do escopo**: o fluxo completo de comprovação — explicação e aviso de privacidade, verificação de senha, solicitação de permissão de câmera, captura ao vivo do documento, revisão da foto, envio à YaID, e as duas telas de resultado (sucesso e falha). Inclui também a terceira forma da tela inicial, que a comprovação bem-sucedida desbloqueia.

**Fora do escopo, coberto por outras especificações**: criação da identidade e política de tentativas de senha (D1), autorização de verificações de empresas (D3), e revogação da credencial (D4). D2 consome a tela de senha entregue por D1 sem redefini-la.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprovar a identidade com sucesso (Priority: P1)

Uma pessoa com identidade criada e sem credencial toca em "Verificar meu documento" na tela inicial. O aplicativo explica o que vai acontecer e o que a YaID faz com a foto. Ela digita sua senha, concede a permissão de câmera (se ainda não concedida) e fotografa o documento ao vivo. Vê a foto, confirma que está boa e envia. O aplicativo processa, a credencial chega, e ela passa a ver o documento sem dados na tela inicial — prova de que está verificada.

**Why this priority**: É o único fluxo que entrega a credencial. Sem credencial não há D3 nem D4. O produto só existe depois que este fluxo funciona.

**Independent Test**: Pode ser testado completamente com um RG físico e conexão de rede: percorrer explicação → senha → câmera → captura → revisar → enviar → resultado, e confirmar que a tela inicial mostra o documento sem dados ao final.

**Acceptance Scenarios**:

1. **Given** uma pessoa com identidade e sem credencial na tela inicial, **When** ela toca em "Verificar meu documento", **Then** o aplicativo exibe a tela de explicação com o aviso de privacidade, sem exigir senha ainda.
2. **Given** a pessoa na tela de explicação, **When** ela decide prosseguir, **Then** o aplicativo apresenta a tela de senha antes de abrir a câmera.
3. **Given** a pessoa digitou a senha correta e nunca havia concedido a permissão de câmera, **When** o fluxo avança, **Then** o aplicativo solicita a permissão de câmera antes de abrir o visor, no momento em que faz sentido — nunca no primeiro uso.
4. **Given** a câmera está aberta, **When** a pessoa enquadra o documento e captura, **Then** o aplicativo exibe a foto capturada e oferece duas ações: repetir ou enviar.
5. **Given** a pessoa confirma o envio da foto, **When** o aplicativo envia à YaID, **Then** ele exibe uma tela de envio com indicação de progresso e uma linha dizendo o que está acontecendo.
6. **Given** a YaID aceita a foto e processa o documento com sucesso, **When** a credencial é recebida, **Then** o aplicativo exibe a tela de resultado de sucesso e, ao retornar à tela inicial, a terceira forma (documento sem dados) está visível.
7. **Given** a comprovação foi concluída com sucesso, **When** a pessoa observa o documento sem dados na tela inicial, **Then** ele mostra as duas respostas da credencial e a data em que foi confirmada, sem foto, sem nome, sem número de documento.
8. **Given** o aparelho está sem conexão de rede, **When** a pessoa tenta enviar a foto, **Then** o aplicativo informa que não há conexão, nomeia o que houve e oferece tentar de novo.

---

### User Story 2 - Repetir a foto antes de enviar (Priority: P1)

Na tela de revisão, a pessoa percebe que a foto ficou desfocada, escura ou cortada. Ela toca em "Repetir" e retorna à câmera para uma nova captura. Pode repetir quantas vezes quiser antes de enviar.

**Why this priority**: A tela de revisão é a única barreira que evita o envio de uma foto inutilizável antes de consumir o tempo de processamento da YaID. Sem ela, toda foto ruim vira uma viagem de ida ao servidor e uma tela de falha.

**Independent Test**: Pode ser testado abrindo a câmera, capturando uma foto intencionalmente ruim, tocando em "Repetir" e verificando que a câmera reabre, mantendo o fluxo sem penalidade.

**Acceptance Scenarios**:

1. **Given** a pessoa vê a tela de revisão com a foto capturada, **When** ela toca em "Repetir", **Then** a câmera reabre e ela pode capturar uma nova foto.
2. **Given** a pessoa repetiu a captura várias vezes, **When** ela finalmente envia, **Then** apenas a última foto é enviada.
3. **Given** a tela de revisão, **When** a pessoa observa a foto, **Then** ela consegue avaliar se o documento está legível antes de decidir.

---

### User Story 3 - Comprovação que falha no processamento (Priority: P1)

A pessoa envia a foto, mas a YaID não consegue processar o documento — a foto está ilegível, o documento não é reconhecido ou houve falha no servidor. O aplicativo informa o que houve de forma compreensível e oferece tentar de novo, sem culpar a pessoa.

**Why this priority**: R11 do baseline é explícita: falhar é visível, nunca silencioso. Uma comprovação que falha em silêncio deixa a pessoa acreditando ter uma credencial que não tem — consequência pior do que o próprio fluxo de comprovação.

**Independent Test**: Pode ser testado simulando uma falha de servidor ou enviando uma foto propositalmente ilegível, e verificando que a tela de falha aparece com mensagem compreensível e caminho de retentativa.

**Acceptance Scenarios**:

1. **Given** a YaID retornou falha no processamento do documento, **When** o resultado chega ao aplicativo, **Then** uma tela de resultado de falha é exibida, nomeando o que houve e oferecendo tentar de novo.
2. **Given** a YaID retornou falha de infraestrutura (servidor indisponível), **When** o resultado chega ao aplicativo, **Then** a tela de falha informa que o serviço não está disponível e orienta tentar mais tarde.
3. **Given** a tela de falha, **When** a pessoa toca em "Tentar de novo", **Then** o fluxo recomeça a partir da tela de explicação, sem exigir senha de novo.
4. **Given** a comprovação falhou, **When** a pessoa retorna à tela inicial, **Then** ela continua na segunda forma — com identidade, sem verificação — nunca na terceira. A falha não cria uma credencial parcial.

---

### User Story 4 - Permissão de câmera negada (Priority: P2)

A pessoa tenta comprovar, mas nega a permissão de câmera quando o sistema operacional pergunta. O aplicativo explica por que a permissão é necessária e conduz aos ajustes do sistema para que ela possa concedê-la. Não insiste mais de uma vez com o diálogo nativo.

**Why this priority**: Depende do caminho principal, mas é o único bloqueio que a pessoa pode causar involuntariamente e do qual o aplicativo precisa oferecer saída honesta.

**Independent Test**: Pode ser testado negando a permissão de câmera quando solicitada e verificando que o aplicativo exibe a explicação correta e conduz aos ajustes, sem travar ou apresentar mensagem genérica.

**Acceptance Scenarios**:

1. **Given** a pessoa nega a permissão de câmera quando solicitada, **When** o fluxo tenta abrir o visor, **Then** o aplicativo exibe uma tela explicando por que a câmera é necessária e oferece abrir os ajustes do sistema.
2. **Given** a pessoa abriu os ajustes e concedeu a permissão, **When** retorna ao aplicativo, **Then** o visor da câmera abre normalmente.
3. **Given** a permissão de câmera foi negada definitivamente pelo sistema operacional (sem mais diálogos nativos), **When** o aplicativo tenta, **Then** ele não exibe o diálogo nativo mais de uma vez — conduz diretamente aos ajustes.

---

### Edge Cases

- **A pessoa interrompe o fluxo antes de enviar.** Fecha o aplicativo ou manda para o segundo plano em qualquer ponto antes do envio. Ao reabrir, o fluxo não está em andamento — a comprovação não é um estado persistente. Ela recomeça do início quando tocar em "Verificar meu documento".
- **A pessoa já tem uma credencial.** A tela inicial está na terceira forma e o botão de "Verificar meu documento" não existe. D2 não é acessível quando a credencial já existe — revogar primeiro é o caminho (D4).
- **A foto capturada é de um documento de outra pessoa.** O aplicativo não detecta isso — a YaID tenta processar e pode retornar falha. O aplicativo não é responsável por decidir se é o documento certo; é responsável por reportar a falha com clareza.
- **O documento fotografado é de menor de 18 anos.** Após as Stories 5.7/5.8, a YaID emite a credencial normalmente, com a resposta `ageOver18: false`. O aplicativo recebe e armazena a credencial sem distinção — é a credencial correta para aquela pessoa.
- **O relógio do aparelho está errado.** A autenticação junto à YaID falha por timestamp fora da janela de validade. O aplicativo exibe mensagem específica orientando a pessoa a ajustar a data e hora do celular — nunca um erro genérico.
- **O envio demora mais de dois segundos.** A tela de envio exibe texto descrevendo o que está acontecendo, além do indicador de progresso. A pessoa não fica olhando para um spinner mudo.
- **A conexão cai durante o envio.** O aplicativo detecta a falha de rede, informa que não há conexão e oferece tentar de novo. A foto capturada é perdida — a pessoa precisará fotografar de novo.
- **A galeria de fotos é aberta por engano.** Não é possível: o aplicativo só abre a câmera ao vivo. A opção de galeria nunca existe no fluxo (R4 do baseline).

---

## Requirements *(mandatory)*

### Functional Requirements

**Tela de explicação e aviso de privacidade**

- **FR-001**: O aplicativo MUST exibir uma tela de explicação antes de qualquer outra ação da comprovação, descrevendo o que vai acontecer e o que a YaID faz com a foto.
- **FR-002**: A tela de explicação MUST incluir o aviso de privacidade de forma proeminente: a foto é usada para conferir o documento e apagada em seguida, e a YaID não guarda o documento nem os dados da pessoa.
- **FR-003**: A tela de explicação MUST NOT exigir senha para ser exibida.
- **FR-004**: O aplicativo MUST NOT iniciar a comprovação se a pessoa não tiver identidade criada — a entrada no fluxo só existe na segunda forma da tela inicial.
- **FR-005**: O aplicativo MUST NOT iniciar a comprovação se a pessoa já tiver uma credencial — a entrada no fluxo não existe na terceira forma da tela inicial.

**Verificação de senha**

- **FR-006**: O aplicativo MUST exigir a senha de seis dígitos antes de abrir a câmera, usando a capacidade reutilizável entregue por D1.
- **FR-007**: Se a pessoa desistir da verificação de senha, o fluxo de comprovação MUST ser abandonado sem efeito, sem custo e sem penalidade.

**Permissão de câmera**

- **FR-008**: O aplicativo MUST solicitar a permissão de câmera **após** a verificação de senha bem-sucedida, nunca antes, e nunca no primeiro uso.
- **FR-009**: Se a permissão de câmera for negada, o aplicativo MUST exibir explicação do motivo da necessidade e oferecer atalho para os ajustes do sistema.
- **FR-010**: O aplicativo MUST NOT exibir o diálogo nativo de permissão de câmera mais de uma vez por sessão de uso.

**Captura do documento**

- **FR-011**: O aplicativo MUST abrir a câmera do dispositivo ao vivo, com moldura de enquadramento para o documento.
- **FR-012**: O aplicativo MUST NOT oferecer, em nenhum ponto do fluxo, a opção de selecionar uma foto da galeria ou de qualquer armazenamento local.
- **FR-013**: A câmera MUST capturar a foto por ação explícita da pessoa — um toque no obturador — e não automaticamente por detecção de documento.

**Revisão da foto**

- **FR-014**: Após a captura, o aplicativo MUST exibir a foto capturada e oferecer exatamente duas ações: repetir a captura ou enviar.
- **FR-015**: A ação "Repetir" MUST reabrir a câmera sem penalidade e sem consumir tentativas.
- **FR-016**: Não há limite de repetições de captura antes do envio.

**Envio e processamento**

- **FR-017**: Ao enviar, o aplicativo MUST exibir uma tela de espera com indicador de progresso e uma linha de texto descrevendo o que está acontecendo.
- **FR-018**: O aplicativo MUST enviar a foto à YaID com autenticação pelo identificador único da identidade da pessoa.
- **FR-019**: O aplicativo MUST NOT armazenar a foto no aparelho após o envio, seja em caso de sucesso ou falha.
- **FR-020**: O aplicativo MUST NOT oferecer opção de cancelar durante o envio — o envio é um comprometimento.

**Resultado de sucesso**

- **FR-021**: Ao receber a credencial da YaID, o aplicativo MUST armazenar a credencial no aparelho de forma segura e persistente.
- **FR-022**: Após armazenar a credencial, o aplicativo MUST exibir a tela de resultado de sucesso e, ao retornar à tela inicial, apresentá-la na terceira forma com o documento sem dados.
- **FR-023**: O documento sem dados MUST exibir as duas respostas da credencial e a data de confirmação, sem nome, foto ou número de documento.
- **FR-024**: Quando uma resposta for "Não" (por exemplo, menor de 18 anos), o aplicativo MUST exibi-la em cor neutra, nunca em vermelho — ter menos de 18 anos não é um erro.

**Resultado de falha**

- **FR-025**: Se a YaID retornar falha no processamento do documento (documento ilegível, não reconhecido ou falha de infraestrutura), o aplicativo MUST exibir tela de resultado de falha que nomeia o que houve e oferece tentar de novo.
- **FR-026**: Uma falha de comprovação MUST NEVER criar uma credencial parcial nem alterar o estado da tela inicial — ela continua na segunda forma.
- **FR-027**: A opção "Tentar de novo" na tela de falha MUST retornar ao fluxo a partir da tela de explicação, sem exigir senha novamente na mesma sessão.
- **FR-028**: Se a falha for causada por relógio do aparelho incorreto, o aplicativo MUST exibir mensagem específica orientando a ajustar a data e hora — nunca mensagem genérica.
- **FR-029**: Se a falha for de conectividade, o aplicativo MUST informar que não há conexão e oferecer tentar de novo.

**Privacidade e vocabulário**

- **FR-030**: O aplicativo MUST NOT emitir qualquer evento, métrica ou sinal comportamental para fora do aparelho durante nenhuma etapa de D2.
- **FR-031**: O aplicativo MUST usar o vocabulário da interface (§9 do UX.md), nunca termos técnicos do domínio, nas telas da comprovação.
- **FR-032**: Toda mensagem de falha MUST nomear o que houve e qual a próxima ação — mensagens genéricas do tipo "algo deu errado" são proibidas.

### Key Entities

- **Credencial**: O documento digital recebido da YaID após a comprovação. Carrega as duas respostas sobre a pessoa (é uma pessoa real; tem mais de 18 anos) e a data de confirmação. Existe apenas no aparelho da pessoa. É armazenada exatamente como recebida — qualquer modificação invalida a assinatura da YaID. Uma por instalação.
- **Foto do documento**: A imagem capturada pela câmera ao vivo. É enviada à YaID durante a comprovação e descartada pelo aplicativo após o envio. Nunca é persistida localmente.
- **Estado da comprovação**: Não há estado intermediário persistido. O fluxo de comprovação é inteiramente efêmero — ou termina com a credencial criada, ou termina com a pessoa de volta à segunda forma da tela inicial.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa que já tem identidade consegue concluir a comprovação, do toque inicial até a credencial na tela inicial, em **menos de dois minutos** em condições normais de rede e iluminação.
- **SC-002**: **100% das comprovações** bem-sucedidas resultam na terceira forma da tela inicial imediatamente ao retornar — nunca na segunda forma nem numa tela de erro.
- **SC-003**: **Zero** fotos da comprovação são encontradas no armazenamento local do aparelho após o encerramento do fluxo, em qualquer desfecho.
- **SC-004**: **100% das falhas de comprovação** exibem tela de resultado — a pessoa nunca fica numa tela de espera sem resposta nem retorna silenciosamente à tela inicial.
- **SC-005**: **100% das mensagens de falha** identificam o que houve (documento ilegível, sem conexão, relógio incorreto, servidor indisponível) e oferecem próxima ação — nenhuma é genérica.
- **SC-006**: **Zero** requisições à YaID ocorrem antes de a senha ser verificada — verificável por inspeção de tráfego.
- **SC-007**: A opção de galeria de fotos **nunca aparece** em nenhuma tela da comprovação — verificável por inspeção de interface.
- **SC-008**: Uma pessoa que comprova sendo menor de 18 anos recebe a credencial e a vê na tela inicial com a resposta "Não" em cor neutra, **sem mensagem de erro**.
- **SC-009**: O aplicativo exibe texto descritivo na tela de espera em **100% dos envios** que duram mais de dois segundos.
- **SC-010**: **Nenhuma** tela de D2 exibe termos técnicos do domínio (credencial, DID, assinatura, token, nonce, blockchain, VC).

---

## Assumptions

- **Recorte por domínio.** Esta especificação cobre apenas D2. A tela de senha reutilizável é entregue por D1 e consumida aqui sem redefinição. A terceira forma da tela inicial (com credencial) é desbloqueada por D2 e exibida como estado de chegada.
- **Formato da credencial construído para o futuro.** O contrato de API em vigor prevê uma atualização que unifica as duas respostas em uma única credencial (Stories 5.7/5.8) e migra para JWT (Epic 9). Esta especificação descreve o comportamento pós-atualização: a credencial carrega as duas respostas e é armazenada como uma unidade opaca, sem que o aplicativo precise conhecer sua forma serializada.
- **A comprovação emite sempre as duas respostas.** Conforme R7 do baseline, a credencial carrega `personhood` e `ageOver18` juntos. Não há comprovação parcial.
- **Menor de 18 não é falha.** Após a atualização do contrato (Stories 5.7/5.8), a YaID emite a credencial normalmente para menores, com `ageOver18: false`. O aplicativo não precisa tratar esse caso como erro.
- **A foto é tirada sempre ao vivo.** R4 do baseline proíbe galeria. O aplicativo abre exclusivamente a câmera traseira ao vivo — câmera frontal e galeria não são opções.
- **Não há limite de retentativas do fluxo.** A pessoa pode repetir a comprovação completa quantas vezes quiser (dentro das restrições de tentativas de senha herdadas de D1). Cada tentativa completa é independente.
- **A tela de "Tentar de novo" não reexige senha.** A senha foi verificada no início da sessão de comprovação. Uma falha de processamento não é motivo para exigir nova autenticação na mesma sessão — o app e a pessoa já pagaram esse custo.
- **Não há pré-visualização em tempo real do documento.** A câmera abre como visor ao vivo com moldura de enquadramento; o processamento de imagem (borda, qualidade) ocorre no servidor, não no aplicativo.
- **A permissão de câmera é solicitada uma vez.** Se já concedida em uso anterior, o visor abre diretamente. Se negada definitivamente, o fluxo vai direto aos ajustes sem repetir o diálogo nativo.
- **A comprovação não tem estado intermediário.** Não há rascunho, retomada ou checkpoint. O fluxo ou completa ou a pessoa começa do zero na próxima vez.
