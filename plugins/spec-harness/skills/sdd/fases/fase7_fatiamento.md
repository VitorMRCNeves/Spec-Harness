# Fase 7 — Fatiamento Vertical e Confirmação de Escopo

Esta é a fase que decide quantas specs existem, o que cada uma entrega e **quantas rodam ao
mesmo tempo**. Um corte ruim aqui não é corrigido depois: ele vira uma fila serial de specs que
só produzem valor na última.

Entra nesta fase: as regras de negócio (Fase 3), o módulo de referência (Fase 3.2, se houve), o
shape real dos contratos (Fase 4), os padrões do repositório (Fase 5) e — se a entrega foi
grande o bastante para rodar a Fase 6 — a tabela de fatiamento do `design.md`.

Sai desta fase: a lista de specs, o grafo de dependências e as ondas de paralelização, todos
confirmados com o usuário. A Fase 8 só materializa isso em arquivos.

A fase tem quatro passos, nesta ordem. **Não comece pela lista de specs** — ela é o resultado,
não o ponto de partida.

---

## 7.1 — Fechar o que ainda está em aberto

Use `AskUserQuestion` **uma vez**, só com o que Fases 3–5 não resolveram. Não repita pergunta já
respondida.

1. **Camadas envolvidas:** quais camadas do repositório a entrega atravessa, na ordem que o
   perfil (`.claude/sdd/perfil.md § Estrutura e fronteiras`) declara? É o caminho inteiro ou um
   subset?
2. **Efeito colateral:** a entrega dispara algo fora do fluxo principal (notificação,
   sincronização, job)? Use o mecanismo que o repositório já tem.
3. **Modos de falha:** o que acontece quando a validação falha, quando o recurso não existe,
   quando a dependência externa não responde, quando falta permissão?
4. **Reutilização:** a Fase 5 encontrou algo que já cobre parte da entrega? Apresente antes de
   propor código novo — cada reuso é uma spec que não precisa existir.

---

## 7.2 — Listar comportamentos observáveis (não componentes)

Este passo é o que separa uma entrega paralelizável de uma fila.

Escreva a lista do que **passa a ser possível fazer** quando a entrega estiver pronta, do ponto
de vista de quem consome — usuário, sistema chamador, job a jusante. Um comportamento se escreve
como algo que alguém faz e observa o resultado:

- ✅ "O revisor recebe um documento distinto do mesmo lote que outro revisor já pegou"
- ✅ "Um envio de 10 arquivos sobe os 10, e um que falha não derruba os outros"
- ❌ "O serviço de reserva" — isso é componente
- ❌ "O modelo de evento" — isso é artefato
- ❌ "A camada de persistência do lote" — isso é camada

**Se a Fase 6 rodou**, esta lista já existe: é a tabela `design.md § Fatiamento vertical`.
Traga-a e refine, não recomece.

**Se a Fase 6 não rodou**, derive aqui, cruzando: os contratos reais da Fase 4 (cada
entidade/endpoint novo costuma habilitar um comportamento), as regras de negócio da Fase 3
(cada regra é observável de alguma forma) e os modos de falha de 3.1 (falha tratada também é
comportamento).

---

## 7.3 — Cortar cada comportamento em spec

Aplique a regra de granularidade — a mesma que a Fase 8 cobra
(`fases/fase8_geracao.md#regra-de-granularidade-das-specs`). Em resumo, e nesta ordem:

1. **Um comportamento observável = uma spec.** A spec entrega a fatia de *todos* os artefatos
   que aquele comportamento exige — schema, regra, exposição — e nada além. Ela é vertical
   dentro do escopo dela.
2. **Prova de independência obrigatória.** Para cada spec, escreva a ação única que prova que
   ela funciona sozinha, sem a spec seguinte existir. Se você não consegue escrever essa frase,
   a spec não é uma fatia: é uma camada. Volte ao 3.2.
3. **Uma spec toca um escopo.** O `spec-harness` recusa packet que cruze escopo
   (`harness.ts` — *"um packet cobre um escopo só"*). Quando o comportamento atravessa dois
   escopos (ex.: contrato num app e consumo em outro), ele vira **duas specs irmãs**: cada uma
   vertical dentro do seu escopo, a de consumo declarando `Depende de`. Elas não são camadas de
   uma mesma fatia — são a mesma fatia vista de dois lados, e a segunda entra na onda seguinte.
4. **Substrato compartilhado é a exceção, não a regra.** O que duas ou mais specs exigem antes
   de existirem (tipo compartilhado, contrato, migration) vira uma spec própria, horizontal, na
   onda 1. **No máximo duas dessas por entrega.** Se aparecerem três, você cortou por camada:
   volte ao 3.2. Antes de criar uma, teste a alternativa mais barata — colocar o substrato
   *dentro* da primeira spec que precisa dele, e a segunda spec apenas o consome.
5. **Não fatie pelo menor artefato possível.** Um CRUD inteiro de uma entidade pode ser uma spec
   só, se os quatro verbos forem o mesmo comportamento observável para quem consome. Fatiar
   demais recria a fila serial por outro caminho.

---

## 7.4 — Montar as ondas e confirmar

### Grafo

Desenhe a dependência real entre as specs. Dependência real é uma só: **a spec B não consegue
rodar os próprios testes sem o código de produção da spec A.** Ordem de leitura, afinidade
temática e "faz mais sentido depois" não são dependência — são o que transforma um grafo largo
numa fila.

Desconfie de todo grafo que sair em linha reta (`01→02→03→04→…`). Ele é quase sempre sintoma de
corte horizontal, não de dependência genuína. Para cada seta, pergunte: *o que exatamente quebra
nos testes de B se A não existir?* Se a resposta for vaga, apague a seta.

### Ondas

Agrupe em ondas. Duas specs vão na mesma onda quando, simultaneamente:

- nenhuma depende da outra no grafo; **e**
- os **Arquivos permitidos** de produção das duas não têm interseção (é o que permite worktrees
  paralelos sem conflito de merge).

Registre a largura de cada onda — quantas specs rodam juntas. Essa é a métrica que esta fase
está otimizando.

### Confirmação

Apresente ao usuário, para ele confirmar ou ajustar pontualmente — **não como pergunta aberta de
"quais specs você imagina"**:

| # | Spec | Escopo | Comportamento que entrega | Depende de | Onda | Prova de independência |
|---|---|---|---|---|---|---|
| 01 | <nome> | <escopo> | <o que passa a ser possível> | — | 1 | <a ação que prova sozinha> |

Seguido de uma linha: *"<N> specs em <M> ondas; a onda mais larga roda <K> specs em paralelo."*

Se `M` for igual a `N`, diga isso explicitamente ao usuário e ofereça refazer o corte: uma
entrega em que nada roda em paralelo ou é genuinamente sequencial, ou foi cortada por camada.

---

## Regra

Não repita perguntas já respondidas nas fases anteriores. A tabela confirmada aqui define
diretamente os arquivos `specs/NN-nome.md`, o grafo do `implementacao.md` e as ondas — a Fase 8
materializa, não redecide.
