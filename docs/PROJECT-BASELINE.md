# YaID Wallet — Baseline do Projeto

> **O que é este documento.** O que vamos construir na frente mobile da YaID e por quê: objetivo,
> fronteiras de responsabilidade, linguagem do domínio, regras de produto e o recorte de escopo.
> É o documento de partida para especificar qualquer parte do aplicativo.
>
> **O que ele não é.** Não trata de tecnologia, arquitetura de código ou aparência. Requisitos
> técnicos estão em [`ARCHITECTURE.md`](./ARCHITECTURE.md); experiência e interface em
> [`UX.md`](./UX.md); a fronteira com o servidor em
> [`MOBILE-API-CONTRACT.md`](./MOBILE-API-CONTRACT.md).
>
> **Contexto maior.** [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md) descreve a solução YaID como um
> todo — as três frentes e como conversam. Este documento é autossuficiente para a frente mobile.

---

## 1. Recorte de escopo

**Este projeto exige múltiplas especificações, separadas por domínio.**

O aplicativo cobre quatro capacidades que não compartilham regras, não falham juntas e não precisam
ser construídas ao mesmo tempo. Tratá-las como uma especificação única produziria um documento longo
demais para revisar e um plano de implementação impossível de fatiar.

### 1.1 Os quatro domínios

| # | Domínio | O que entrega | Frequência na vida da pessoa |
|---|---|---|---|
| **D1** | **Identidade e Acesso** | A pessoa passa a existir para a YaID e define como protege o aplicativo | Uma vez |
| **D2** | **Comprovação** | A pessoa converte seu documento numa credencial reutilizável | Uma vez |
| **D3** | **Autorização** | A pessoa responde a uma solicitação de verificação de uma empresa | Toda vez que uma empresa pede |
| **D4** | **Revogação** | A pessoa invalida sua credencial permanentemente | Raro, por iniciativa dela |

### 1.2 A ponte entre eles

As dependências são estritamente sequenciais, o que define a ordem de construção:

```
D1 ──> D2 ──> D3
        │
        └───> D4
```

- **D1 não depende de nada.** É construível e demonstrável isoladamente, sem servidor.
- **D2 depende de D1**, porque a credencial é emitida para uma identidade que precisa existir antes.
- **D3 depende de D2**, porque autorizar é apresentar uma credencial que precisa ter sido emitida.
- **D4 depende de D2**, porque só se revoga o que foi emitido. É independente de D3.

**O que atravessa as fronteiras:**

| Fronteira | O que passa |
|---|---|
| D1 → D2 | A identidade da pessoa |
| D2 → D3 | A credencial e suas respostas |
| D2 → D4 | A identificação da credencial |
| D3 → D3 | Nada — cada autorização é independente da anterior, e o app não guarda histórico |

**Regra de sequenciamento:** D3 é o domínio que justifica o produto, mas é o último a ser
construível. D1 e D2 não são preparação — são pré-requisitos reais.

---

## 2. O objetivo

Construir o aplicativo onde a identidade digital de uma pessoa mora, de forma que ela possa provar
duas coisas sobre si — **que é uma pessoa real** e **que tem mais de 18 anos** — a qualquer empresa
parceira, sem nunca reenviar documento e sem que a empresa receba qualquer dado pessoal.

A tese que o aplicativo precisa demonstrar funcionando: **é possível separar a comprovação do uso da
comprovação**. A pessoa prova uma vez, direto com a YaID, e reaproveita indefinidamente.

### 2.1 Por que ele precisa existir

Sem o aplicativo, a solução não fecha. As outras frentes já funcionam, mas os fluxos da pessoa são
exercitados por simulação. **O aplicativo é a única coisa capaz de autorizar uma verificação em nome
de alguém** — sem ele, não há prova de que o modelo funciona fora do papel.

### 2.2 O que precisa ser verdade ao final

- A pessoa cria sua identidade sem cadastro, sem e-mail, sem senha em servidor algum.
- A pessoa envia a foto do documento **uma única vez**, e nunca mais.
- A credencial existe **apenas no aparelho dela**.
- Nenhuma empresa recebe documento, dado pessoal ou a credencial — apenas "sim" ou "não".
- A pessoa consegue recusar uma solicitação, e recusar não tem custo nem consequência.
- A pessoa consegue invalidar sua credencial por conta própria, sem pedir permissão a ninguém.

---

## 3. Fronteiras de responsabilidade

### 3.1 O aplicativo é responsável por

- Criar a identidade da pessoa, localmente, no primeiro uso.
- Guardar a identidade e a credencial no aparelho.
- Capturar a foto do documento e entregá-la à YaID na comprovação.
- Receber uma solicitação de verificação e mostrar à pessoa **quem está pedindo e o quê**.
- Autorizar ou recusar essa solicitação conforme a decisão dela.
- Revogar a credencial quando ela pedir.

### 3.2 O aplicativo **não** é responsável por — e isto é fronteira, não omissão

| Não faz | Quem faz |
|---|---|
| Ler ou interpretar o documento | A YaID, durante a comprovação |
| Decidir se a pessoa é maior de idade | A YaID — o app apenas lê a resposta pronta |
| Consultar ou escrever no registro público | A YaID |
| Saber qual empresa pediu o quê, além do que a solicitação informa | — |
| Guardar histórico de verificações | Ninguém, deliberadamente |

> **Por que não há histórico.** Registrar onde a pessoa se verificou recriaria, dentro do aparelho,
> exatamente o perfil comportamental que a arquitetura da solução existe para impedir. A ausência de
> histórico é uma funcionalidade.

---

## 4. Linguagem do domínio

Vocabulário canônico. Estes termos são usados sem sinônimos em todos os documentos e no código.

| Termo | Significado |
|---|---|
| **Identidade** | O que representa a pessoa na YaID. Criada no primeiro uso, vive só no aparelho, nunca muda. |
| **Credencial** | O documento digital emitido pela YaID que carrega as respostas. Existe apenas no aparelho da pessoa. |
| **Resposta** | Cada um dos dois "sim/não" que a credencial carrega: *é uma pessoa real* e *tem mais de 18 anos*. Sempre as duas, nunca uma isolada. |
| **Comprovação** | O ato de enviar a foto do documento e receber a credencial. Acontece uma vez. |
| **Solicitação de verificação** | O que a pessoa recebe quando uma empresa quer uma resposta. Traz o nome da empresa, qual das duas perguntas, e um prazo. |
| **Autorizar** | A pessoa aprova uma solicitação. A empresa recebe a resposta. |
| **Recusar** | A pessoa nega uma **solicitação**. A credencial continua existindo e valendo. |
| **Revogar** | A pessoa invalida a **credencial**, para sempre. Não tem volta. |
| **Senha do aplicativo** | Os seis dígitos que a pessoa define no primeiro uso e digita para autorizar operações. |

### 4.1 Três ambiguidades resolvidas

**"Cancelar" está proibido como termo.** Ele descreveria dois atos diferentes: negar uma solicitação
e invalidar a credencial. Usamos **recusar** e **revogar**, e nunca "cancelar".

**"Pedido de verificação" não é vocabulário desta frente.** Existem duas coisas distintas: o pedido
que a **empresa** faz à YaID, e a **solicitação** que chega à pessoa. O aplicativo só conhece a
segunda. Usar o mesmo nome para as duas importaria para cá um conceito que o app não acessa.

**"Ambiente" tem dois sentidos.** Uma aplicação criada por uma empresa no painel pode ser de
homologação ou de produção — atributo de negócio dela. Isso não tem relação com o ambiente onde a
YaID roda. Quando este documento diz "ambiente", refere-se ao primeiro sentido.

---

## 5. Regras de produto

Decisões tomadas, com o motivo. Não são preferências — mudá-las muda o produto.

| # | Regra | Motivo |
|---|---|---|
| **R1** | A pessoa não tem cadastro, login, e-mail ou senha em servidor algum | Quem tem o aparelho é a pessoa. Não há nada para vazar porque não há nada guardado. |
| **R2** | **Não existe recuperação.** Perdeu o aparelho, cria nova identidade e comprova de novo | Um mecanismo de recuperação tornaria a identidade **transferível** — alguém poderia vender a própria identidade a um menor de idade, atacando as duas perguntas que a YaID responde. |
| **R3** | A senha do aplicativo é exigida **a cada operação sensível**: comprovar, autorizar e revogar | As três são raras. O custo é baixo e elimina a janela de "aparelho destravado na mão de terceiro". Abrir o aplicativo é livre — a tela inicial não mostra nada sensível. |
| **R4** | A foto do documento é capturada **pela câmera, ao vivo**. Galeria não é opção | Aceitar arquivo pronto tornaria trivial submeter o documento de outra pessoa. Como não há prova de vida no escopo, esta é a barreira disponível. |
| **R5** | A solicitação só funciona **no mesmo aparelho** onde a pessoa está navegando | Recorte atual. Fluxo entre aparelhos diferentes é extensão futura. |
| **R6** | **Zero telemetria.** Nenhum evento sai do aparelho | Uma carteira cuja tese é não rastrear ninguém não pode enviar eventos a terceiros. |
| **R7** | A credencial carrega **sempre as duas respostas**, nunca uma isolada | A pessoa comprova uma vez e responde a qualquer das duas perguntas depois, sem repetir o processo. |
| **R8** | Uma solicitação faz **uma pergunta só**, e a resposta é **binária** | Sem pontuação, sem nível de confiança, sem resposta parcial. |
| **R9** | A tela de decisão precisa deixar **inequívoco quem está pedindo e o quê** | É a única defesa da pessoa contra ser induzida a autorizar uma verificação que não é dela. Não é tela informativa — é a proteção. |
| **R10** | Recusar não tem custo, não pede justificativa e não afeta a credencial | Recusar precisa ser tão fácil quanto autorizar, ou o consentimento não é real. |
| **R11** | Falhar é **visível**. Nunca silencioso | Uma comprovação que falha sem avisar deixa a pessoa acreditando que tem uma credencial que não tem. |
| **R12** | Revogar é **irreversível** e só a pessoa pode fazer | Nem a YaID nem uma empresa conseguem revogar a credencial de alguém. |

---

## 6. O que a pessoa faz, do começo ao fim

Descrição de comportamento, sem detalhe de tela — a experiência está em [`UX.md`](./UX.md).

**D1 — Primeiro uso.** A pessoa instala e abre o aplicativo. Ele cria a identidade dela ali mesmo, no
aparelho, e pede que ela defina uma senha de seis dígitos. Nada é enviado a lugar nenhum. Ao final,
ela tem uma identidade e nenhuma credencial.

**D2 — Comprovação.** A pessoa escolhe comprovar sua identidade, digita a senha e fotografa seu
documento. O aplicativo envia a foto à YaID, que lê o documento, deriva as duas respostas e devolve a
credencial. A foto e os dados lidos são descartados pela YaID. Ao final, a credencial existe apenas
no aparelho.

**D3 — Autorização.** Navegando no site de uma empresa, a pessoa é levada a uma página de verificação
e de lá para o aplicativo. Ele mostra **qual empresa** está pedindo e **qual das duas perguntas**.
Ela decide. Se autorizar, digita a senha e o aplicativo responde à YaID, que informa a empresa. Se
recusar, o processo termina ali. A solicitação também pode expirar sozinha.

Antes de mostrar a tela de decisão, o aplicativo confere se a credencial que ela possui consegue
responder àquela pergunta. Se não conseguir — por exemplo, uma solicitação de maioridade para quem
comprovou sendo menor —, ele avisa **antes**, em vez de deixá-la autorizar algo fadado a falhar.

**D4 — Revogação.** A qualquer momento, a pessoa pode invalidar sua credencial. Digita a senha,
confirma, e a credencial deixa de valer para sempre. Ela pode comprovar de novo depois, se quiser.

---

## 7. Fora de escopo

Decisões de produto, não pendências:

- **Histórico de verificações** dentro do aplicativo (§3.2).
- **Recuperação, backup ou sincronização** entre aparelhos (R2).
- **Fluxo entre aparelhos diferentes** — previsto como extensão futura (R5).
- **Telemetria** de qualquer natureza (R6).
- **Mais de uma identidade ou credencial** por instalação.
- **Qualquer pergunta** além de "é uma pessoa real" e "tem mais de 18 anos".
- **Outros documentos** além do RG; selfie, prova de vida, comparação facial ou vídeo.
- **Notificações** enviadas ao aparelho.

---

## 8. Critérios de sucesso

O projeto está entregue quando uma pessoa consegue, num aparelho real:

1. Instalar o aplicativo e ter uma identidade em menos de um minuto, sem digitar nada além da senha.
2. Comprovar sua identidade fotografando o RG, e receber a credencial.
3. Ser levada de um site de terceiro até o aplicativo, entender **quem está pedindo e o quê**, e
   autorizar.
4. Ver a empresa receber a resposta correta.
5. Recusar uma solicitação e confirmar que a credencial continua intacta.
6. Revogar a credencial e confirmar que uma nova tentativa de verificação falha.

---

## 9. Questões em aberto

Pontos de produto sem resposta definida. Nenhum bloqueia o início da construção.

| # | Questão | Impacto |
|---|---|---|
| **Q1** | **A credencial não expira.** Quem comprovar aos 17 fica com "não tem mais de 18" permanentemente, sem caminho de correção ao completar 18 — a não ser revogar e comprovar de novo, o que precisaria ser explicado a ela. | Experiência incorreta para uma faixa de usuários |
| **Q2** | **A credencial de um aparelho perdido continua válida indefinidamente**, e a pessoa não tem como revogá-la sem o aparelho. | Risco de segurança sem mitigação atual |
| **Q3** | **Nada impede a mesma pessoa de comprovar em vários aparelhos** com o mesmo documento. Se isso for aceitável, "é uma pessoa real" significa "um documento legítimo foi conferido", não "conta única" — e isso precisa ser dito em voz alta às empresas. | Define o que o produto realmente promete |
| **Q4** | **A pessoa não sabe se a solicitação vem de uma aplicação de homologação ou de produção.** Uma empresa em teste pode pedir verificações reais sem que ela perceba. | Transparência |
| **Q5** | **Comportamento quando a comprovação é interrompida** no meio não está definido. Assume-se o caminho feliz. | A definir após validação |
