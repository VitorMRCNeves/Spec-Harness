# Fase 8 — Geração da Pasta SDD

Crie a estrutura de pastas e arquivos em `.specs/sdd-<feature-slug>/`.

`.specs/` é o diretório que a skill `spec-harness` também usa para os Task Packets — por isso a
pasta gerada aqui já nasce no lugar certo, sem passo de migração manual depois.

---

## Estrutura obrigatória

```
.specs/
  sdd-<feature-slug>/
    descricao_alto_nivel.md
    design.md              # só se a Fase 6 rodou — não crie vazio
    implementacao.md
    progresso.md
    specs/
      01-<nome-spec>.md
      02-<nome-spec>.md
      ...
```

`design.md` **não é gerado nesta fase**: ele já foi escrito na Fase 6, se ela rodou. Aqui você
só o referencia — e confere que nenhuma spec contradiz uma decisão dele.

---

## Instruções por arquivo

### `descricao_alto_nivel.md`

Leia `templates/descricao_alto_nivel.md` e preencha com:
- Objetivo e comportamento esperado da feature completa (o QUÊ, não o COMO)
- Contratos/schemas reais da Fase 4 (DTOs, entidades, colunas de migration, resposta de API)
- Arquitetura da feature nas camadas que o perfil do repositório declara
- Dependências e reutilização de helpers/hooks/componentes existentes (da Fase 5)
- Open Questions ainda abertas
- Campo **Ticket**: preencha com a chave (`ABC-1234`) se a Fase 2 buscou um ticket; remova a
  linha do template se a feature veio só de descrição livre
- Se a Fase 6 rodou: **não duplique o `design.md`**. A seção "Arquitetura da Feature" vira uma
  linha — "ver `design.md`" — e o que fica aqui é só o que o design não cobre. Arquitetura
  descrita em dois arquivos diverge no primeiro ajuste

### `implementacao.md`

Leia `templates/implementacao.md` e preencha com:
- Tabela de specs na ordem validada na Fase 7, com a coluna **Prova de independência** — é o que
  um humano faz para aprovar a spec sem ler código
- Grafo de dependências entre specs (só dependência real: B não roda os testes dele sem o código
  de A)
- **Tabela de ondas de paralelização**, copiada da Fase 7.4. Ela é o plano de execução: as specs
  de uma onda são disparadas juntas (`run-parallel`), não uma após a outra
- Critério de conclusão da feature completa

### `progresso.md`

Leia `templates/progresso.md` e preencha com:
- Lista de todas as specs com status `🔴 Não iniciado`
- Log vazio (será preenchido durante a execução via `spec-harness`)

### `specs/NN-nome.md` (uma por spec)

Para cada spec validada na Fase 7:

1. Leia `templates/spec.md`
2. Leia `regras/qualidade.md` — aplique todas as regras antes de escrever
3. Preencha o template com o conteúdo específico da spec, na notação e nos padrões que
   `.claude/sdd/perfil.md` declara — inclusive a seção `## Arquivos permitidos`, que é o que o
   `spec-harness` lê para montar o packet, e a seção `## Prova de independência`, que é o que
   impede uma camada de se disfarçar de fatia
4. Nomeie o arquivo com prefixo numérico: `01-`, `02-`, `03-`, ...

---

## Regra de granularidade das specs

**Uma spec é uma fatia vertical dentro de um escopo:** um comportamento observável, entregue
através de todos os artefatos que ele exige naquele escopo — schema, regra de negócio,
exposição — e nada além.

O eixo do corte é o comportamento, não a camada. Camada é como a arquitetura se desenha; fatia é
como a entrega se parte. Cortar spec por camada é o erro que produz uma fila serial em que
nenhuma spec entrega valor até a última.

1. **Prova de independência obrigatória.** Cada spec declara, em uma frase, a ação que prova que
   ela funciona sozinha — sem a spec seguinte existir. Se a frase não sai, a spec é uma camada
   disfarçada: refaça o corte pelo comportamento. É esse campo que faz a regra valer, porque ele
   não é preenchível por uma spec horizontal.
2. **Testável sem o código de outra spec**, salvo dependência declarada em "Depende de". Se a
   spec só roda os testes depois que a próxima existir, o corte está errado.
3. **Um escopo por spec.** O `spec-harness` recusa packet que cruze escopo. Quando o
   comportamento atravessa dois escopos, ele vira **duas specs irmãs** — cada uma vertical
   dentro do seu escopo, a de consumo declarando `Depende de` e lendo a seção `## Contratos` da
   outra, nunca os arquivos de produção dela. Irmãs não são camadas: são a mesma fatia vista de
   dois lados.
4. **Substrato compartilhado: no máximo duas specs horizontais por entrega.** O que duas ou mais
   fatias exigem antes de existirem (tipo compartilhado, contrato, migration) pode virar spec
   própria na onda 1. Antes de criar uma, tente a alternativa mais barata: colocar o substrato
   *dentro* da primeira fatia que precisa dele. Três ou mais specs de substrato significam corte
   por camada — refaça.
5. **Não fatie pelo menor artefato possível.** Um CRUD inteiro pode ser uma spec só, se os quatro
   verbos forem o mesmo comportamento observável para quem consome. Fatiar demais recria a fila
   serial por outro caminho.
6. **A ordem numérica é a ordem das ondas, não uma fila.** Specs da mesma onda recebem números
   consecutivos e são disparadas juntas. O número não implica que a anterior precisa ter
   terminado — só o `Depende de` implica isso.

### Teste de cheiro antes de gravar os arquivos

Antes de escrever `specs/`, olhe o grafo que você acabou de montar e cheque:

| Sintoma | O que significa | Correção |
|---|---|---|
| Grafo em linha reta (`01→02→03→…`) | Corte por camada | Volte à Fase 7.2 e liste comportamentos observáveis |
| Nomes de spec que são substantivos de artefato ("modelo de X", "serviço de Y", "store de Z") | Corte por camada | Renomeie pelo comportamento; se não der, o corte está errado |
| Três ou mais specs sem comportamento observável próprio | Excesso de substrato | Absorva o substrato nas fatias que o consomem |
| Nenhuma onda com mais de uma spec | Ou é genuinamente sequencial, ou é horizontal | Reexamine cada seta: *o que quebra nos testes de B se A não existir?* |

---

## Após gerar todos os arquivos

Imprima a lista de arquivos criados e diga ao usuário:

> "A pasta SDD está em `.specs/sdd-<slug>/`. Revise os arquivos em `specs/` — cada um é uma
> unidade de implementação independente. Antes de acionar o `spec-harness`, confirme que os RFs
> estão todos com 🟡 e que não há `⚠️ ABERTO:` pendente. A implementação real acontece via Task
> Packets (`spec-harness`), não editando código a partir daqui diretamente. Quando a
> implementação começar, cada fase aprovada atualiza `progresso.md`."
