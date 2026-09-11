# Fase 6 — Pesquisa de Padrões e Design de Arquitetura (opcional)

Esta fase só existe para entrega grande. Ela roda **depois** das Fases 4 e 5 (precisa dos
contratos reais e dos padrões do repositório) e **antes** da Fase 7 (o fatiamento em specs sai
dela). O produto é um arquivo: `.specs/sdd-<slug>/design.md`.

Ela tem dois blocos que andam juntos e não se separam:

- **Pesquisa** — como o mercado resolve esta classe de problema, e o que disso vale aqui.
- **Design** — a arquitetura alvo, os modos de interação, as sequências e as decisões.

A pesquisa sem o design vira link solto; o design sem a pesquisa vira a primeira ideia que
apareceu. Os dois no mesmo arquivo é que fazem cada decisão carregar a alternativa que ela
derrotou.

---

## 6.0 — Rodar ou não rodar

Esta fase é opcional e **cara**. Rodar em toda feature transforma a skill num gerador de
documento que ninguém lê.

Rode se **qualquer** um dos gatilhos abaixo for verdade:

| Gatilho | Como você sabe |
|---|---|
| A entrega cria um subsistema novo | Fase 3 respondeu "feature nova" e não há módulo de referência análogo no repositório |
| A Fase 5 não achou precedente | Agente B voltou sem módulo similar — não há padrão local para copiar, então alguém vai inventar um |
| A entrega atravessa mais de um modo de interação | Ex.: API + job assíncrono + tela; ou request síncrono + fila + webhook |
| A Fase 7 tende a passar de ~6 specs | Estime pelos contratos da Fase 4: cada entidade/endpoint/fluxo novo é pelo menos uma spec |
| Há decisão arquitetural sem volta | Escolha de mecanismo de estado, de protocolo de integração, de modelo de concorrência — coisa que a spec 07 não desfaz |
| O usuário pediu | "projeto maior", "desenha a arquitetura antes", "quero um design doc" |

**Pule** quando a entrega é extensão de um módulo existente com precedente claro (a Fase 5
achou o exemplo a copiar) e a Fase 7 cabe em 3–4 specs. Nesse caso a seção "Arquitetura da
Feature" do `descricao_alto_nivel.md` já é o suficiente — não crie `design.md` vazio de decisão.

**Não decida sozinho em silêncio.** Apresente ao usuário o gatilho que disparou (ou a ausência
de gatilhos) e confirme com `AskUserQuestion` antes de gastar a fase:

> "Esta entrega bate em <gatilho>: <evidência concreta>. Sugiro rodar a fase de design antes de
> fatiar em specs — ela produz `design.md` com a arquitetura, as sequências e a pesquisa de
> padrões, e é dela que sai o corte em specs paralelas. Rodar?"

---

## 6.1 — Bloco de pesquisa

O objetivo **não** é colecionar links. É responder: *esta classe de problema já foi resolvida —
como, e qual dessas formas sobrevive às restrições deste repositório?*

### Enquadre antes de buscar

Escreva, em uma frase, a **classe** do problema — não o nome da feature. "Preciso de um loop de
entrevista que decide quando parar" é classe; "entrevistador generativo da ata" é nome. Busca
feita pelo nome interno da feature não acha nada.

Derive de 2 a 4 classes, uma por eixo que a entrega tem. Eixos típicos:

| Eixo | Pergunta de pesquisa |
|---|---|
| **Arquitetura** | Que decomposição em componentes é padrão para este problema? Que topologias existem e qual falha em quê? |
| **Modos de interação** | Síncrono, assíncrono, streaming, batch, event-driven — qual o padrão para esta carga e este requisito de latência? |
| **Interação entre nós/componentes** | Como os componentes trocam estado: chamada direta, fila, barramento, estado compartilhado? Quem é dono de quê? |
| **Entregas / rollout** | Como se coloca isso em produção incrementalmente: feature flag, expand-contract, dual-write, shadow traffic? |
| **Documentação e contratos** | Que forma de contrato é padrão aqui (OpenAPI, schema registry, ADR, diagrama de sequência)? |
| **Design de sistema / UX de sistema** | Estados observáveis, idempotência, retry, backpressure, observabilidade — o que a literatura cobra desta classe? |

### Busque

Use `WebSearch` (e `WebFetch` no que valer a pena ler inteiro), uma busca por eixo. Prefira, em
ordem: documentação oficial do framework/serviço envolvido > livro ou referência canônica de
padrões > engenharia de empresa que rodou isso em escala > post genérico. Um post de blog não
derruba o padrão que o repositório já usa.

Se não houver acesso à rede, **diga isso explicitamente** no `design.md` — a seção vira
"pesquisa não realizada: sem acesso à rede", e as decisões nascem marcadas como não validadas
contra o mercado. Não simule pesquisa.

### Filtre contra a realidade daqui

Cada padrão encontrado passa por três perguntas, e só entra no `design.md` com as três
respondidas:

1. **Cabe na stack?** `.claude/sdd/perfil.md` declara a stack real. Padrão que exige
   infraestrutura que o repositório não tem é alternativa rejeitada, não recomendação.
2. **Conflita com o que já existe?** A Fase 5 levantou os padrões locais. Se o mercado diz X e o
   repositório faz Y, o repositório vence por padrão — a não ser que você consiga nomear o dano
   concreto que Y causa nesta entrega. Divergência sem dano nomeado é preferência pessoal.
3. **Qual o custo de adotar?** Em specs a mais, em dependência nova, em coisa que a equipe passa
   a ter de operar.

O resultado deste bloco é a seção **Pesquisa de padrões** do `design.md`: uma linha por padrão,
com fonte, veredito (adotar / adaptar / rejeitar) e o motivo — e o motivo é sobre este
repositório, não sobre o padrão em abstrato.

---

## 6.2 — Bloco de design

Com a pesquisa filtrada, desenhe. Use `templates/design.md` e preencha **todas** as seções. O
que você não souber vira `⚠️ ABERTO:` — o `spec-harness` recusa spec com marcador pendente, e
uma dúvida arquitetural aberta aqui é mais barata que a mesma dúvida aberta na spec 05.

O que cada seção precisa entregar:

### Objetivos e critérios de sucesso
O que esta arquitetura precisa sustentar, em número quando der (volume, latência, concorrência,
janela de retenção). Critério sem número vira "rápido o suficiente" e não reprova nada.
Inclua os **não-objetivos arquiteturais** — o que a arquitetura explicitamente não vai suportar
é o que impede a próxima spec de crescer sozinha.

### Arquitetura alvo
Os componentes e a responsabilidade de cada um, em uma linha. Um componente cuja
responsabilidade não cabe em uma linha está mal cortado. Marque o que é **novo**, o que é
**alterado** e o que é **reusado** (da Fase 5, com caminho) — a coluna de reuso é a que encolhe
a Fase 7.

### Modos de interação
Para cada fronteira entre componentes: quem chama quem, síncrono ou assíncrono, o que trafega,
quem é dono do estado, e o que acontece quando o outro lado não responde. Fronteira sem modo de
falha declarado é fronteira que vai virar incidente.

### Sequências
Um diagrama por fluxo relevante, em texto (ASCII ou mermaid — o que o repositório já usar).
Obrigatório: o **fluxo principal** e, para cada ponto de falha que o bloco anterior listou, a
**sequência de falha** correspondente. Sequência só de caminho feliz é decoração.

### Estado e dados
Onde cada pedaço de estado vive, quem escreve, quem lê, e como a consistência é garantida quando
mais de uma fonte é tocada. Use os mecanismos que o perfil declara.

### Decisões
Uma tabela no formato ADR enxuto: decisão, alternativas consideradas (as da pesquisa),
trade-off aceito, consequência. **Decisão sem alternativa listada não é decisão, é hábito.**
É esta tabela que justifica a fase inteira existir.

### Fatiamento vertical
A ponte para a Fase 7, e a seção que mais importa para a velocidade da entrega. Ver 6.3.

### Riscos e questões abertas
Risco com probabilidade, impacto e o que o mitiga. Questão aberta com dono.

---

## 6.3 — Fatiamento vertical: o que esta fase entrega para a Fase 7

Desenhar a arquitetura em camadas e depois fatiar as specs **por camada** é o erro que esta
seção existe para impedir. Camada é como você desenha; spec é como você entrega. São eixos
diferentes.

Faça o corte aqui, sobre a arquitetura recém-desenhada:

1. **Liste os comportamentos observáveis** que a arquitetura passa a sustentar — não os
   componentes. "O revisor recebe um documento distinto do mesmo lote" é comportamento; "o
   serviço de reserva" é componente.
2. **Para cada comportamento, marque os componentes que ele atravessa.** Um comportamento
   costuma atravessar vários — é isso que o torna vertical.
3. **Cada comportamento é candidato a uma spec.** A spec entrega a fatia de *todos* esses
   componentes que aquele comportamento exige, e nada além.
4. **Nomeie o substrato compartilhado.** O que dois ou mais comportamentos exigem *antes* de
   existirem (o contrato, o tipo compartilhado, a migration) vira a primeira spec — e é a única
   spec legitimamente horizontal. Se mais de duas specs horizontais aparecerem aqui, o corte foi
   por camada: volte ao passo 1.
5. **Monte as ondas.** Comportamentos que não compartilham arquivo de produção e não dependem um
   do outro vão na mesma onda e rodam em paralelo. Registre isso como tabela de ondas — é o que
   a Fase 8 copia para o `implementacao.md`.

Saída obrigatória desta seção, que a Fase 7 consome direto:

| Comportamento observável | Componentes atravessados | Depende de | Onda |
|---|---|---|---|
| <o que passa a ser possível fazer> | <componentes da arquitetura alvo> | <comportamento anterior ou —> | 1 |

---

## 6.4 — Revisão com o usuário

`design.md` é o documento cujo erro sai mais caro: ele contamina todas as specs abaixo dele.

Ao terminar, **não siga direto para a Fase 7**. Apresente ao usuário, em no máximo 10 linhas:

- a arquitetura alvo em uma frase;
- as 2–3 decisões com alternativa derrotada (não todas — só as que têm trade-off real);
- a tabela de ondas, com quantas specs rodam em paralelo;
- o que ficou `⚠️ ABERTO:`.

Peça revisão explícita. Só entre na Fase 7 depois do aceite, e leve para lá a tabela de 6.3 —
a Fase 7 refina e confirma aquele corte, não recomeça do zero.
