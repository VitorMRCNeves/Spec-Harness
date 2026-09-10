# Bench do spec-harness

Mede o que uma mudança no harness faz com **custo**, **tempo** e **qualidade** — as três juntas,
porque as três se compram umas às outras. É fácil baixar o custo entregando código pior, e é fácil
melhorar a qualidade gastando o dobro de sessão; o bench só reconhece melhoria quando o custo cai
**e** os gates continuam passando.

## O que ele responde

> "Trocar o `@import` eager do `CLAUDE.md` por ponteiro sob demanda economizou quanto da minha
> sessão do Sonnet, e o código saiu igual de bom?"

## Desenho

O **workload é constante** e o **harness é a variável**. O workload é um repositório-fixture
(`fixture/`): um pacote Python de ~10 arquivos, sem banco, sem container, sem rede, com uma spec
pequena (`normalizar_valor`: string digitada em pt-BR → `Decimal` com escala 2) e o packet dela
já escrito. Uma execução materializa o fixture do zero num `mktemp -d`, com
`SPEC_HARNESS_HOME` próprio, roda `autorun` e mede.

Nada é herdado entre execuções: cada uma tem repositório novo, git novo e home do harness novo.
Sem isso a segunda medição somaria os turnos da primeira.

### Os dois knobs

| Flag | Valores | O que isola |
|------|---------|-------------|
| `--docs` | `eager` \| `lazy` | `CLAUDE.md` importando `docs/` com `@` (31 KB reenviados em todo turno) vs. índice de ponteiros lido sob demanda |
| `--allowlist` | `on` \| `off` | o bloco `docs.por_fase` do perfil, que diz a cada fase quais docs importam |

`fixture/docs/catalogo.md` tem 31 KB **de propósito**: ele modela o `docs/screens.md` de um repo
real (66 KB), que é o item mais caro quando a documentação é eager. Sem um doc grande no fixture,
o knob `--docs` não teria o que medir.

## Uso

```bash
cd bench

# linha de base: como o harness era
./run-bench.sh --rotulo antes  --docs eager --allowlist off

# depois das mudanças
./run-bench.sh --rotulo depois --docs lazy  --allowlist on

./metrics.py comparar runs/antes.json runs/depois.json
```

Requisitos na máquina: `node`, `pytest`, `ruff`, `radon`, `pytest-cov`, e o CLI `claude` no PATH.
O motor usado é `~/.claude/spec_harness/harness.ts`, ou o que estiver em `SPEC_HARNESS_TS`.

`--manter` preserva o sandbox (repo, worktrees, `autorun.log`) para inspeção.

**Uma execução por vez.** Duas sessões headless disputando o mesmo runner produzem falha que não é
do harness, e a medição vai junto.

## O que é medido

Duas fontes, porque nenhuma sozinha responde a pergunta:

- **`$SPEC_HARNESS_HOME/metrics.jsonl` + evidência da fase VERIFY** — o que o *harness* fez:
  quantas avaliações de gate, quantas reprovaram, o que o gate de CRAP mediu.
- **Transcripts das sessões headless** (`~/.claude/projects/<slug-do-worktree>/*.jsonl`) — o que a
  *sessão do modelo* custou: turnos, tokens por tipo, tamanho do contexto e em que ferramentas os
  turnos foram gastos.

| Campo | Por que está aqui |
|-------|-------------------|
| `turnos` | o multiplicador real do custo — `custo ≈ contexto × turnos` |
| `contexto_medio_por_turno` | o piso que toda mudança de `CLAUDE.md` move |
| `tokens.cache_read_input_tokens` | ~97% do total; é aqui que a economia aparece |
| `tokens.output_tokens` | tipicamente <0,5% do total — se a economia saiu daqui, você cortou trabalho, não desperdício |
| `ferramentas` | separa turno de **trabalho** (`Edit`/`Write`) de turno de **orientação** (`Read`/`Grep`/`Glob`) e de **arqueologia de ambiente** (`Bash` com `find`) |
| `gates.reprovadas` | cada reprovação refaz a fase inteira do zero — é o gasto mais caro que existe |
| `qualidade.crap_ok`, `crap_pior`, `status` | o freio: economia com qualidade pior não é economia |

## Como ler o resultado

`metrics.py comparar` imprime delta percentual por métrica e, no fim, o bloco de qualidade. Se a
execução nova não terminou em `ready_for_review`, ou se o gate de CRAP reprovou, ele avisa que a
comparação **não vale** — números de uma execução que não entregou não são comparáveis com os de
uma que entregou.

Uma melhoria legítima é: `tokens total` e `contexto_medio_por_turno` caem, `qualidade` fica igual
ou melhor, e `ferramentas` mostra a queda vindo de `Read`/`Bash`, não de `Edit`/`Write`.

## Variância

A sessão do implementador é um modelo, não uma função pura: duas execuções idênticas não dão o
mesmo número. Diferenças abaixo de ~15% em tokens não são conclusivas com uma execução de cada
lado — rode três de cada rótulo (`antes-1`, `antes-2`, …) antes de concluir de mudança pequena.
O `post_verify` fica desligado no fixture justamente por isso: é outra sessão de modelo, com
variância própria, e mediria a revisão em vez do implementador.
