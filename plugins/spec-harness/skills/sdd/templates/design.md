# <Nome da Feature> — Design de Arquitetura

**Status:** 🟡 Rascunho
**Autor:** <git config user.name>
**Data:** <hoje>
**Gatilho desta fase:** <qual gatilho de `fase6_design.md § 6.0` disparou — com a evidência>
**Escopos tocados:** <escopos do `spec-harness` que a arquitetura atravessa>
**Ticket:** <ABC-1234 — omitir esta linha se a feature não veio de um ticket>

> Este documento é opcional e só existe em entrega grande. Ele fica **acima** das specs: decide
> a forma do sistema. As specs decidem o comportamento de cada fatia. Se uma spec contradiz este
> arquivo, uma das duas está errada — resolva aqui antes de implementar.

---

## Objetivos

[2–4 frases: o que esta arquitetura precisa sustentar. Concreto, referenciando o que já existe
no repositório.]

### Critérios de sucesso

> Com número. "Rápido o suficiente" não reprova nada.

| Critério | Alvo | Como se mede |
|---|---|---|
| <latência / volume / concorrência / retenção / custo> | <número> | <comando, métrica ou observação> |

### Não-objetivos arquiteturais

- [O que esta arquitetura explicitamente NÃO vai suportar — e por quê]
- [A generalização que estamos recusando agora de propósito]

---

## Pesquisa de padrões

> Resultado da Fase 6.1. Uma linha por padrão avaliado. Veredito: **Adotar** / **Adaptar** /
> **Rejeitar** — e o motivo é sobre este repositório, não sobre o padrão em abstrato.
>
> Se não houve acesso à rede, substitua esta tabela por: "⚠️ ABERTO: pesquisa não realizada —
> sem acesso à rede. As decisões abaixo não foram validadas contra padrões de mercado."

| Eixo | Padrão | Fonte | Veredito | Motivo (nesta base) |
|---|---|---|---|---|
| Arquitetura | <nome do padrão> | <URL ou referência canônica> | Adotar | <o que ele resolve aqui> |
| Modos de interação | <nome do padrão> | <fonte> | Adaptar | <o que muda para caber na stack> |
| Interação entre componentes | <nome do padrão> | <fonte> | Rejeitar | <a restrição concreta que o inviabiliza> |
| Entrega / rollout | <nome do padrão> | <fonte> | | |
| Documentação e contratos | <nome do padrão> | <fonte> | | |
| Design de sistema | <nome do padrão> | <fonte> | | |

### Conflitos com o padrão local

> Onde o mercado diz X e o repositório faz Y. O repositório vence por padrão — só divirja
> nomeando o dano concreto que Y causa **nesta entrega**.

| Padrão de mercado | O que o repositório faz hoje | Quem vence | Dano nomeado (se o mercado vencer) |
|---|---|---|---|
| <X> | <Y, com caminho do arquivo visto na Fase 5> | Repositório / Mercado | <o problema concreto, ou "—"> |

---

## Arquitetura alvo

### Componentes

> Uma linha por componente. Responsabilidade que não cabe em uma linha é componente mal cortado.

| Componente | Responsabilidade (uma linha) | Situação | Caminho |
|---|---|---|---|
| <nome> | <o que ele e só ele faz> | Novo / Alterado / **Reusado** | `<caminho>` |

> A coluna **Reusado** vem da Fase 5. Cada item ali é uma spec que não precisa existir.

### Diagrama de componentes

```text
<desenho em texto — quem contém quem, quem depende de quem.
 Use a mesma notação que o repositório já usar (ASCII ou mermaid).>
```

---

## Modos de interação

> Uma linha por fronteira entre componentes. Fronteira sem modo de falha declarado é incidente
> agendado.

| De → Para | Modo | O que trafega | Dono do estado | Quando o outro lado falha |
|---|---|---|---|---|
| <A> → <B> | Síncrono / Assíncrono / Streaming / Batch / Evento | <payload ou contrato> | <quem é a fonte da verdade> | <timeout, retry, fallback, dead-letter> |

### Contratos de fronteira

> Só os contratos **novos** que a arquitetura cria. Os contratos que já existem estão em
> `descricao_alto_nivel.md § Contratos e Schemas`, com o shape real lido na Fase 4 — não
> duplique aqui.

```
<notação da linguagem do repositório>
```

---

## Sequências

> Um diagrama por fluxo. **Obrigatório:** o fluxo principal e uma sequência de falha para cada
> ponto de falha listado em "Modos de interação". Sequência só de caminho feliz é decoração.

### Fluxo principal — <nome>

```text
<ator>  ──(1) <ação>──►  <componente A>
                          │
                          ├─(2) <chamada>──►  <componente B>
                          │◄─(3) <resposta>──┘
                          │
                          └─(4) <resultado observável>
```

### Sequência de falha — <ponto de falha>

```text
<o que o sistema faz quando <condição>. Onde o erro para, o que o usuário vê,
 o que fica persistido e o que é revertido.>
```

---

## Estado e dados

| Estado | Onde vive | Quem escreve | Quem lê | Consistência |
|---|---|---|---|---|
| <o quê> | <mecanismo declarado no perfil> | <componente> | <componentes> | <como é garantida quando mais de uma fonte é tocada> |

### Mudança de schema (se aplicável)

```
// <caminho da migration/DDL, no mecanismo que o repositório usa>
```

> Reversível? Se não, diga o que impede a volta atrás e em que ponto a decisão fica irreversível.

---

## Decisões

> Formato ADR enxuto. **Decisão sem alternativa listada não é decisão, é hábito** — e é esta
> tabela que justifica esta fase ter existido.

| # | Decisão | Alternativas consideradas | Trade-off aceito | Consequência |
|---|---|---|---|---|
| AD-01 | <o que foi decidido> | <as opções da pesquisa que perderam> | <o que estamos abrindo mão> | <o que isso obriga daqui pra frente> |

---

## Fatiamento vertical

> Saída da Fase 6.3 e entrada da Fase 7. A linha é um **comportamento observável**, não um
> componente. Um comportamento que não atravessa mais de um componente provavelmente é
> substrato, não fatia.

| # | Comportamento observável | Componentes atravessados | Depende de | Onda | Prova de independência |
|---|---|---|---|---|---|
| 01 | <o que passa a ser possível fazer, do ponto de vista de quem consome> | <componentes> | — | 1 | <o teste/ação que prova esta fatia sozinha> |
| 02 | <...> | <...> | 01 | 2 | <...> |

### Substrato compartilhado

> O que dois ou mais comportamentos exigem **antes** de existirem. É a única spec legitimamente
> horizontal. **Mais de duas linhas aqui significa que o corte saiu por camada** — refaça o
> fatiamento pelo comportamento.

| Item | Por que não cabe dentro de um comportamento | Quem consome |
|---|---|---|
| <contrato/tipo compartilhado/migration> | <o motivo — "duas fatias precisam dele simultaneamente"> | <comportamentos 02, 03> |

### Ondas de paralelização

| Onda | Comportamentos | Rodam em paralelo? | Por quê |
|---|---|---|---|
| 1 | <substrato + fatias sem dependência> | Sim | Não compartilham arquivo de produção |
| 2 | <...> | Sim | <...> |

---

## Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | <o que pode dar errado na arquitetura, não na implementação> | Alta/Média/Baixa | Alto/Médio/Baixo | <o que reduz — e em qual spec isso acontece> |

---

## Questões abertas

> Toda incerteza arquitetural vira `⚠️ ABERTO:` aqui. Resolver uma dúvida de arquitetura neste
> arquivo é barato; resolver a mesma dúvida na spec 07 não é.

| # | Pergunta | Impacto | Dono | Prazo |
|---|---|---|---|---|
| OQ-01 | ⚠️ ABERTO: <pergunta> | Alto/Médio/Baixo | <nome> | <data> |
