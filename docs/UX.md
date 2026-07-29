# UX — YaID Wallet

> **O que é este documento.** Como o aplicativo se apresenta e se comporta para a pessoa: princípios
> de experiência, sistema visual, mapa de telas, fluxos de navegação, estados, voz e acessibilidade.
>
> **Documentos irmãos.** [`PROJECT-BASELINE.md`](./PROJECT-BASELINE.md) define **o quê** construímos e
> as regras de produto. [`ARCHITECTURE.md`](./ARCHITECTURE.md) define **como** construímos.
> [`MOBILE-API-CONTRACT.md`](./MOBILE-API-CONTRACT.md) é a fronteira com o servidor.
>
> **Herança de marca.** A identidade visual vem da especificação de UX do `yaid_dashboard`. Este
> documento herda paleta, tipografia, raio e cores semânticas, e diverge apenas onde o contexto móvel
> exige — cada divergência está declarada em §3.4.

---

## 1. A pessoa e o momento

Quem usa este aplicativo **não escolheu a YaID**. Chegou até aqui por um link de uma empresa em que
confia, provavelmente no meio de uma compra ou de um cadastro. Não sabe o que é identidade
auto-soberana e não precisa saber.

Três características definem todo o desenho:

**O uso é raro e curto.** A pessoa cria a identidade uma vez, comprova uma vez, e depois abre o
aplicativo só quando uma empresa pede algo. Não há engajamento a construir, não há hábito a formar.
Otimizar para retorno frequente seria desenhar para um comportamento que não existe.

**Não há nada para mostrar.** O aplicativo não guarda nome, foto, CPF nem histórico. Uma carteira
digital convencional exibe sua identidade; esta não tem o que exibir. **A ausência é o produto** — e
precisa parecer intencional, não uma tela inacabada.

**Um momento carrega todo o risco.** A tela de decisão é a única defesa da pessoa contra autorizar
uma verificação que não é dela. Todo o resto do aplicativo pode ser agradável; essa tela precisa ser
**inequívoca**.

---

## 2. Princípios de experiência

Os cinco primeiros são herdados do dashboard e valem igualmente aqui. Os três últimos são específicos
do aplicativo.

1. **Abstração total.** Nenhum termo técnico aparece na interface. A pessoa nunca lê "credencial
   verificável", "chave", "assinatura", "token" ou "blockchain".
2. **Confiança visível.** Privacidade não é ausência — é mensagem ativa. O aplicativo diz o que não
   guarda, nos momentos em que a dúvida existe.
3. **Um passo de cada vez.** Cada tela tem uma decisão principal. Ações secundárias não competem.
4. **Estados que ensinam.** Vazio, erro e falha orientam a próxima ação; nunca apenas informam.
5. **Calma, não urgência.** Sem contagem regressiva, sem pressão artificial.
6. **A costura é invisível.** A chegada pelo link é visualmente contínua com a página que a pessoa
   acabou de ver no navegador. Ela deve sentir que atravessou uma porta, não que trocou de produto.
7. **Recusar é tão fácil quanto autorizar.** Se recusar for mais difícil, o consentimento não é real.
   Os dois caminhos têm o mesmo peso de toque e a mesma clareza.
8. **A tela de decisão não se move.** Nada anima, nada desliza, nada aparece depois. Detalhado em §7.

---

## 3. Sistema visual

### 3.1 Cor

Herdada integralmente do dashboard.

| Papel | Token | Hex |
|---|---|---|
| Primária | blue-600 | `#2563EB` |
| Primária pressionada | blue-700 | `#1d4ed8` |
| Azul profundo (chegada, marca) | blue-900 | `#1e3a8a` |
| Fundo | white | `#ffffff` |
| Fundo secundário | gray-50 | `#f9fafb` |
| Borda | gray-200 | `#e5e7eb` |
| Texto principal | gray-900 | `#111827` |
| Texto secundário | gray-500 | `#6b7280` |
| Texto desabilitado | gray-400 | `#9ca3af` |

**Cores semânticas** — as mesmas do dashboard, para que uma empresa e seu usuário vejam o mesmo
significado na mesma cor:

| Significado | Fundo | Texto |
|---|---|---|
| Aprovado, verificado | green-100 `#dcfce7` | green-700 `#15803d` |
| Recusado, falha | red-100 `#fee2e2` | red-700 `#b91c1c` |
| Atenção, expirado | amber-100 `#fef3c7` | amber-700 `#b45309` |
| Neutro, inativo | gray-100 `#f3f4f6` | gray-600 `#4b5563` |
| Informação | blue-100 `#dbeafe` | blue-700 `#1d4ed8` |

**Regra:** cor nunca comunica sozinha. Todo estado tem texto que diz a mesma coisa.

**Sem tema escuro no MVP**, acompanhando o dashboard. O aplicativo declara tema claro fixo em vez de
herdar o do sistema e renderizar errado.

### 3.2 Tipografia

**Inter**, herdada. Sem segunda família.

| Nível | Tamanho / linha | Peso | Uso |
|---|---|---|---|
| Display | 32 / 38 | 600 | A frase única das telas de resultado |
| Título | 24 / 30 | 600 | Título de tela |
| Subtítulo | 18 / 26 | 500 | Nome da empresa na decisão |
| Corpo | 16 / 24 | 400 | Padrão de leitura |
| Rótulo | 14 / 20 | 500 | Rótulos e botões |
| Legenda | 13 / 18 | 400 | Datas e apoio |

> **Divergência do dashboard:** lá o corpo é 14px. Aqui é **16px**, mínimo confortável para leitura em
> celular. Herdar 14 produziria texto pequeno demais no contexto real de uso.

### 3.3 Forma e espaço

- **Base de 4px.** Espaçamentos: 8, 12, 16, 24, 32, 48.
- **Margem lateral da tela: 24px.**
- **Raio:** 8px em botões e campos, 12px em cards. Moderado — sério sem ser rígido.
- **Alvos de toque: 48px mínimo.** Botão primário: **56px, largura total**.
- **Uma coluna sempre.** Sem grade, sem cards lado a lado.
- **A ação principal fica na faixa inferior**, ao alcance do polegar. O conteúdo respira acima.

### 3.4 Divergências declaradas do dashboard

| Item | Dashboard | Aqui | Motivo |
|---|---|---|---|
| Corpo de texto | 14px | **16px** | Legibilidade em celular |
| Densidade | Compacta (tabelas) | **Confortável** | Não há dados operacionais; há decisões |
| Navegação | Sidebar fixa | **Pilha, sem menu** | Quatro fluxos curtos, sem navegação livre |
| Toasts | Sonner, canto | **Sem toasts** | Ver §8.3 |
| Ícones | Lucide, uso livre | **Uso mínimo** | Ver §3.5 |

### 3.5 Marca e ícones

**Logotipo:** `yaid_icon.svg`, o ícone oficial. Monocromático, portanto recolorível — azul `#2563EB`
sobre fundo claro, branco sobre azul profundo. 48px na chegada e no primeiro uso; 28px como marca
discreta na tela inicial.

> **Nota de implementação:** o arquivo tem `DOCTYPE` de SVG 1.0 e vem de vetorização automática. O
> parser de SVG do React Native costuma rejeitá-lo — limpar e converter para componente antes de usar.
> A localização do arquivo fica a critério da implementação.

**Ícones são raros e funcionais.** Este aplicativo tem quase nenhuma navegação e quase nenhum
conteúdo; ícones decorativos preencheriam espaço em vez de comunicar. Usamos ícone apenas onde ele
carrega significado que o texto não carrega sozinho: o resultado de uma verificação, o aviso de
privacidade, o obturador da câmera.

**Nunca:** ilustração de pessoa, mascote, cadeado como decoração, escudo genérico. Um produto cuja
tese é não acrescentar nada não deve acrescentar desenho.

---

## 4. O elemento de assinatura — o documento sem dados

A tela inicial mostra a verificação da pessoa como um documento que **não contém informação alguma
sobre ela**:

```
┌─────────────────────────────────────┐
│  Sua verificação YaID               │
│                                     │
│  Pessoa real                   Sim  │
│  Maior de 18 anos              Sim  │
│                                     │
│  Confirmada em 12 de março de 2026  │
└─────────────────────────────────────┘
```

Sem foto, sem nome, sem número. O espaço onde estaria o retrato simplesmente não existe.

Isso é uma escolha, não uma limitação de tela: **um card que simulasse uma carteirinha mentiria sobre
o produto**. A YaID não sabe quem a pessoa é — sabe apenas que conferiu um documento uma vez. O card
mostra exatamente isso e nada mais.

Card branco, borda `gray-200`, raio 12px, respostas em peso 600. Quando uma resposta é "Não", ela usa
texto neutro `gray-600` — não vermelho. Ter menos de 18 anos não é erro.

---

## 5. Mapa de telas e navegação

**Sem barra de abas, sem menu lateral, sem gaveta.** O aplicativo é uma tela inicial e quatro fluxos
lineares curtos. Navegação é pilha: entra, resolve, volta.

```
Início  ──── sem identidade ───▶  Boas-vindas ─▶ Criar senha ─▶ Início
        ──── sem verificação ──▶  Fotografar documento ─▶ Conferir ─▶ Enviando ─▶ Resultado
        ──── verificada ───────▶  [o documento sem dados] + Invalidar
        ──── invalidar ────────▶  Confirmar ─▶ Senha ─▶ Resultado

Link da empresa ──▶ Chegada ─▶ Decisão ─▶ Senha ─▶ Enviando ─▶ Resultado
```

A tela de senha é **a mesma** nos três fluxos que a exigem. Ela é chamada, devolve, e não sabe para
que serve.

### 5.1 A tela inicial tem três formas

| Situação | O que mostra | Ação |
|---|---|---|
| Sem identidade | Boas-vindas: o que é a YaID em duas frases | "Começar" |
| Com identidade, sem verificação | O que falta e por quê | "Verificar meu documento" |
| Verificada | O documento sem dados (§4) | "Invalidar minha verificação", discreta |

Na terceira forma, a tela é quase vazia — e deve parecer resolvida, não incompleta. Nada a fazer é o
estado correto: a pessoa só volta aqui quando uma empresa pedir algo.

---

## 6. Fluxos

### 6.1 Primeiro uso — identidade e senha

A pessoa abre o aplicativo pela primeira vez.

1. **Boas-vindas.** Logo, e duas frases sobre o que a YaID faz. Sem carrossel, sem tour, sem tela de
   permissões antecipada.
2. **Criar senha.** Seis dígitos, com teclado numérico e confirmação. Explicar em uma linha para que
   serve: *"Você vai usar esses seis dígitos para autorizar verificações."*
3. **Pronto.** A identidade já foi criada em segundo plano, sem tela de espera — leva
   milissegundos e anunciar isso criaria importância onde não há.

A pessoa termina com identidade e sem verificação, na segunda forma da tela inicial.

> **Não há tela de "anote suas palavras de recuperação"** porque não há recuperação (regra R2 do
> baseline). A tela inicial precisa dizer isso com clareza, uma vez: *"Sua verificação fica só neste
> aparelho. Se você trocar de celular, vai precisar fotografar o documento de novo."*

### 6.2 Comprovação — fotografar o documento

1. **Explicação.** O que vai acontecer e o que a YaID faz com a foto. Aqui entra o aviso de
   privacidade, com peso: *"Sua foto é usada para conferir o documento e apagada em seguida. A YaID
   não guarda o documento nem seus dados."*
2. **Senha.**
3. **Permissão de câmera**, pedida agora — no momento em que faz sentido, não no primeiro uso.
4. **Captura.** Câmera ao vivo com moldura do documento. Sem opção de galeria (regra R4).
5. **Conferir.** A pessoa vê a foto e decide entre repetir e enviar. Passo curto que evita
   reenvio por foto ruim.
6. **Enviando.** Pode levar alguns segundos. Indicador simples e uma linha dizendo o que está
   acontecendo.
7. **Resultado.** Sucesso leva à tela inicial verificada. Falha explica o que houve e oferece tentar
   de novo.

### 6.3 Autorização — o fluxo que justifica o produto

A pessoa toca no botão da página de verificação e o aplicativo abre.

**Chegada.** Contínua com a página que ela acabou de ver: mesmo azul, mesmo logotipo, mesmo tom.
Enquanto o aplicativo consulta a solicitação, esta é a única tela que pode ter transição — e ela dura
o tempo da consulta.

**Decisão.** A tela mais importante do aplicativo. Detalhada em §7.

**Senha**, se a pessoa autorizar.

**Enviando.** Segundos. Sem contagem, sem barra de progresso falsa.

**Resultado.** Um dos quatro estados terminais de §8.2.

**Se a pessoa recusar**, o aplicativo confirma que recusou e encerra. Sem "tem certeza?", sem pedir
motivo. Recusar é uma resposta legítima, não um erro a ser evitado.

### 6.4 Invalidar a verificação

Ação discreta na tela inicial verificada — presente, mas não convidativa.

1. **Confirmar**, com a consequência dita sem rodeio: *"Sua verificação deixa de valer em todas as
   empresas. Para usar a YaID de novo, você vai precisar fotografar seu documento outra vez. Isso não
   pode ser desfeito."*
2. **Senha.**
3. **Resultado.** A tela inicial volta à segunda forma — com identidade, sem verificação.

---

## 7. A tela de decisão

Esta tela é superfície de segurança. As regras abaixo não são estéticas.

### 7.1 O que ela mostra

```
        [ logotipo YaID, 48px ]

        Nome da Empresa
        quer confirmar

        Que você tem
        mais de 18 anos

        A empresa recebe apenas sim ou não.
        Nenhum dado seu é enviado.

        ┌───────────────────────────┐
        │        Autorizar          │
        └───────────────────────────┘
        ┌───────────────────────────┐
        │         Recusar           │
        └───────────────────────────┘
```

**O nome da empresa é o elemento de maior peso da tela**, acima da pergunta. Quem está pedindo importa
mais do que o que está sendo pedido — porque o ataque possível é a pessoa autorizar para a empresa
errada.

**A pergunta é dita em linguagem natural**, nunca com o rótulo técnico do sistema.

**A garantia de privacidade fica na tela**, não escondida. É o que permite decidir com tranquilidade.

### 7.2 Regras de comportamento

- **Nada anima.** A tela aparece pronta. Nenhum elemento desliza, cresce ou surge depois.
- **Os botões ficam inertes por ~400 ms** após a tela aparecer. Impede que um toque destinado à tela
  anterior caia em "Autorizar".
- **"Autorizar" e "Recusar" têm o mesmo tamanho e a mesma área de toque.** "Autorizar" é primário em
  cor; "Recusar" é secundário em peso visual, jamais em facilidade.
- **Sem contagem regressiva.** Nada é consumido enquanto a pessoa pensa, e a pressa não a ajuda a
  decidir melhor.
- **Nenhum toque fora dos dois botões produz efeito.** Sem gesto de voltar que autorize por engano.

### 7.3 Quando a verificação não pode dar certo

Se a solicitação pergunta maioridade e a verificação da pessoa diz que não, o aplicativo **não mostra
a tela de decisão**. Mostra, antes, o que aconteceu:

> *"A Nome da Empresa quer confirmar que você tem mais de 18 anos. Sua verificação YaID indica que
> não. Você pode recusar este pedido."*

Autorizar aqui falharia e **queimaria a solicitação** — a pessoa teria que recomeçar pela empresa sem
entender por quê. Avisar antes é honestidade e economia.

---

## 8. Comportamento e estados

### 8.1 Situações e resposta

| Situação | Comportamento |
|---|---|
| Link chega sem identidade criada | Mostra quem está pedindo e explica que é preciso concluir o primeiro uso antes. Orienta a voltar ao site da empresa depois. |
| Link chega sem verificação | Igual, apontando para a comprovação. |
| Link já usado ou expirado | Estado terminal claro, orientando a pedir um novo link à empresa. |
| Aplicativo volta do segundo plano na decisão | Reconsulta a solicitação antes de permitir autorizar. Pode ter expirado. |
| Sem internet | Diz que não há conexão e oferece tentar de novo. Nunca falha em silêncio. |
| Permissão de câmera negada | Explica por que é necessária e leva aos ajustes do sistema. Sem insistir mais de uma vez. |
| Relógio do aparelho errado | Erro específico: *"A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo."* |
| Senha errada | Informa quantas tentativas restam. Após esgotar, bloqueia por tempo crescente. |

> **A senha esgotada nunca apaga a identidade.** Apagar transformaria o teclado de qualquer pessoa
> numa arma: bastaria errar a senha algumas vezes para destruir a verificação de outra. Bloqueio por
> tempo, sempre.

### 8.2 Estados terminais

Cada um com uma frase de resultado, um significado e uma saída.

| Estado | Cor | Mensagem | Saída |
|---|---|---|---|
| Verificado | green | "Pronto. A empresa recebeu sua resposta." | Voltar ao início |
| Recusado | gray | "Você recusou. Nada foi enviado." | Voltar ao início |
| Expirado | amber | "Este pedido expirou. Peça um novo à empresa." | Voltar ao início |
| Falhou | red | "Não foi possível concluir. Comece de novo pelo site da empresa." | Voltar ao início |

**A falha é genérica por decisão do servidor** — ele não informa qual regra falhou, para não vazar
informação. A mensagem não tenta adivinhar, e a saída é sempre recomeçar pela empresa.

### 8.3 Carregamento, erro e vazio

- **Sem toasts.** No dashboard eles funcionam porque há muitas ações pequenas. Aqui há poucas ações
  grandes, e cada uma merece a tela inteira. Uma notificação que some em quatro segundos é o formato
  errado para "sua verificação foi invalidada".
- **Sem spinner que trava a tela.** Enquanto algo carrega, a tela diz o que está acontecendo.
- **Toda espera acima de dois segundos tem texto**, não só indicador.
- **Erro sempre traz o que houve e o que fazer.** Nunca "algo deu errado".

---

## 9. Voz e conteúdo

**Português do Brasil, segunda pessoa, frases curtas, sem jargão.**

O vocabulário do domínio governa o código e os documentos; **a interface fala a língua da pessoa**.
São coisas diferentes, e o mapeamento é este:

| No código e nos documentos | Na tela |
|---|---|
| Identidade | sua identidade YaID |
| Credencial | sua verificação |
| Comprovação | verificar meu documento |
| Solicitação de verificação | pedido de *Nome da Empresa* |
| Resposta `personhood` | você é uma pessoa real |
| Resposta `ageOver18` | você tem mais de 18 anos |
| Autorizar | Autorizar |
| Recusar | Recusar |
| Revogar | Invalidar minha verificação |

**Nunca aparecem na interface:** DID, chave, assinatura, token, sessão, nonce, blockchain,
credencial verificável, apresentação, criptografia.

**Um botão diz o que acontece.** "Autorizar" produz "Você autorizou". A palavra não muda no meio do
caminho.

**Erros não pedem desculpa e não culpam ninguém.** Dizem o que houve e o que fazer.

---

## 10. Movimento

Quase nenhum, e cada exceção justificada.

| Onde | O quê | Por quê |
|---|---|---|
| Transições entre telas | Padrão da plataforma, sem customização | Familiaridade |
| Chegada pelo link | Transição enquanto consulta a solicitação | É a única espera antes de uma decisão |
| Confirmação de verificação | Uma aparição breve do resultado | O único momento que merece celebração |
| **Tela de decisão** | **Nada** | §7.2 |

**`prefers-reduced-motion` respeitado.** Com ele ativo, resta apenas o corte entre telas.

---

## 11. Acessibilidade

**Alvo: WCAG 2.1 AA**, mesmo nível do dashboard.

| Requisito | Como |
|---|---|
| Contraste 4.5:1 | `#2563EB` sobre branco = 4.9:1 · `gray-500` sobre branco = 7.4:1 |
| Alvo de toque ≥ 44px | Mínimo 48px; botão primário 56px |
| Estado nunca só por cor | Todo estado tem texto que diz a mesma coisa |
| Escala de fonte do sistema | Respeitada; layouts toleram texto ampliado sem cortar |
| Leitor de tela | Toda tela tem título anunciado; botões têm rótulo próprio |
| Foco visível | Contorno de 2px na cor primária em navegação por teclado externo |
| Mudança de estado anunciada | Resultados terminais são anunciados ao leitor de tela |
| Idioma | `pt-BR` declarado |

**A tela de decisão tem exigência extra:** nome da empresa e pergunta são anunciados **antes** dos
botões, na ordem de leitura. Quem usa leitor de tela precisa saber o que está autorizando antes de
encontrar o botão.

---

## 12. Anti-padrões

- **Contagem regressiva** em qualquer tela — herdado do dashboard e reforçado aqui.
- **Tela de decisão que anima** ou cujos botões ficam disponíveis imediatamente.
- **"Recusar" menor, mais claro ou mais escondido** que "Autorizar".
- **Card de credencial que simula carteirinha** com foto, nome ou número.
- **Ilustração, mascote, escudo ou cadeado decorativo.**
- **Tour de boas-vindas** ou carrossel no primeiro uso.
- **Pedir permissão de câmera** antes de existir motivo.
- **Toast** para resultado de operação sensível.
- **Termo técnico** em qualquer texto visível.
- **Tela de histórico** de verificações.
- **Apagar a identidade** por senha errada.
- **Badge, contador ou notificação** que traga a pessoa de volta sem motivo real.
