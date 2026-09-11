# <Nome da Feature> — Ordem de Implementação

**Status:** Rascunho
**Data:** <hoje>

---

## Regra desta entrega

**Toda spec é uma fatia vertical.** Uma spec só está pronta quando o comportamento que ela
entrega é observável sem ler código — é o que a coluna *Prova de independência* cobra. Spec que
entrega só uma camada (só o modelo, só o serviço, só a rota) é spec mal cortada, com a exceção
declarada na seção de substrato abaixo.

**A numeração é a ordem das ondas, não uma fila.** Só `Depende de` impede uma spec de começar.

---

## Specs

| # | Spec | Arquivo | Escopo | Depende de | Onda | Prova de independência |
|---|------|---------|--------|-----------|------|------------------------|
| 01 | [Nome da spec 01] | `specs/01-nome.md` | <escopo> | — | 1 | [a ação que prova esta spec sozinha] |
| 02 | [Nome da spec 02] | `specs/02-nome.md` | <escopo> | — | 1 | [...] |
| 03 | [Nome da spec 03] | `specs/03-nome.md` | <escopo> | 01 | 2 | [...] |

---

## Ondas de paralelização

> Duas specs entram na mesma onda quando **nenhuma depende da outra** e os **Arquivos
> permitidos** de produção das duas **não têm interseção** — é isso que permite worktrees
> simultâneos sem conflito de merge.
>
> Cada onda é disparada de uma vez:
> `node ~/.claude/spec_harness/harness.ts run-parallel <packets da onda>`

| Onda | Specs | Rodam em paralelo | Por que não colidem |
|------|-------|-------------------|---------------------|
| 1 | 01, 02 | 2 | Arquivos de produção disjuntos, nenhuma dependência |
| 2 | 03 | 1 | Depende de 01 |

**<N> specs em <M> ondas; a onda mais larga roda <K> em paralelo.**

> Se `M == N`, nada roda em paralelo. Ou a entrega é genuinamente sequencial, ou ela foi cortada
> por camada — nesse caso volte à Fase 7.2 antes de implementar.

---

## Dependências entre Specs

> Só dependência real: **B não roda os próprios testes sem o código de produção de A.** Ordem de
> leitura e afinidade temática não são dependência — são o que transforma um grafo largo numa
> fila.

```
spec-01 (enviar e ver o lote criado) ──► spec-03 (revisar um item do lote)
spec-02 (exportar o consolidado)      [sem dependência — onda 1]
```

---

## Substrato compartilhado (se houver)

> A única spec legitimamente horizontal: o que duas ou mais fatias exigem **antes** de
> existirem. **No máximo duas por entrega** — mais que isso é sinal de corte por camada.

| Spec | Item | Por que não coube dentro de uma fatia | Quem consome |
|------|------|---------------------------------------|--------------|
| — | — | — | — |

---

## Critério de Conclusão da Feature

```bash
# Comandos reais deste repositório — copie de `.claude/sdd/perfil.md § Stack e ferramentas`
# (build, lint, type-check e testes). Não invente comando que ninguém roda aqui.
<comando de build>
<comando de lint>
<comando de type-check>
<comando de testes>
```
