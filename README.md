# Spec-Harness

Plugin do Claude Code que **executa** specs Markdown (as que a skill `sdd` produz) com
enforcement mecânico: cada spec vira um git worktree isolado, é implementada em
**RED → GREEN → VERIFY** por sessões headless, e só chega em `ready_for_review` se passar por
gates determinísticos — path scoping, comando de teste, lint, CRAP e revisão automática.

O ponto não é gerar código: é que quem orquestra **não precisa ler o diff** para saber que a
mudança está dentro do escopo declarado, que o teste existiu antes do código e que o lint passou.

---

## Instalação

```
/plugin marketplace add VitorMRCNeves/Spec-Harness
/plugin install spec-harness
```

Isso traz três coisas: a skill `spec-harness`, o motor (`engine/harness.ts`) e o hook
`PreToolUse` que aplica o path scoping. Nada disso precisa ser configurado por repositório.

### Modo dev (sem passar pelo marketplace)

```bash
git clone https://github.com/VitorMRCNeves/Spec-Harness ~/repositorios/Spec-Harness
ln -s ~/repositorios/Spec-Harness/plugins/spec-harness/engine ~/.claude/spec_harness
ln -s ~/repositorios/Spec-Harness/plugins/spec-harness/skills/spec-harness ~/.claude/skills/spec-harness
```

Nesse modo o hook do plugin não existe, então cada repositório precisa registrá-lo — é o que
`init-repo` faz sozinho quando detecta que não está rodando como plugin.

> **Não use os dois ao mesmo tempo.** Com o plugin instalado *e* os symlinks em `~/.claude`, a
> skill aparece duplicada e o hook roda duas vezes por tool call. Ao instalar o plugin, apague os
> symlinks.

### Requisitos

| O quê | Por quê |
|---|---|
| Node ≥ 22.18 | O motor é TypeScript rodado por *type stripping* nativo — sem build, sem `tsx` |
| `git` com suporte a worktree | Cada spec roda num worktree próprio |
| CLI `claude` no PATH | As fases RED/GREEN e a revisão pós-VERIFY são sessões headless `claude -p` |
| `radon` + `pytest-cov` | **Só** para a etapa de CRAP; sem eles ela se desliga sozinha |

A única dependência de runtime do motor (`yaml`) vai versionada em
`plugins/spec-harness/engine/node_modules/` para o plugin funcionar sem `npm install`.

---

## Uso

Num repositório que ainda não tem perfil:

```bash
node ~/.claude/spec_harness/harness.ts init-repo   # detecta o perfil e escreve a config
node ~/.claude/spec_harness/harness.ts doctor      # o que ainda falta, campo a campo
```

Depois, uma spec por vez:

```bash
node ~/.claude/spec_harness/harness.ts scaffold-packet .specs/sdd-<feature>/specs/NN-<spec>.md
node ~/.claude/spec_harness/harness.ts autorun     .specs/sdd-<feature>/packets/SDD-NN.yaml --no-merge
# revisão semântica, e só então:
node ~/.claude/spec_harness/harness.ts merge-spec  .specs/sdd-<feature>/packets/SDD-NN.yaml
```

O `autorun` encadeia as três fases numa invocação. Cada fase é uma sessão headless dentro do
worktree; o handoff entre elas é o **commit da fase anterior**, não um resumo gerado por modelo.
Quem orquestra vê uma linha por tentativa.

### Comandos

| Comando | Para quê |
|---|---|
| `init-repo [--force] [--hook]` | Detecta o perfil do repo, escreve a config e (fora do modo plugin) registra o hook |
| `doctor [--json]` | Diagnóstico da config: **ERRO** impede a spec de rodar, **AVISO** degrada |
| `scaffold-packet <spec.md>` | Gera o packet unificado lendo a spec (IDs RF/EC/T, arquivos permitidos, escopo) |
| `autorun <SDD-NN.yaml>` | RED → GREEN → VERIFY numa invocação, com retry por fase |
| `merge-spec <SDD-NN.yaml>` | Mergeia a branch da spec depois de `--no-merge` |
| `expand-packet`, `open-packet`, `verify-packet`, `run-spec`, `run-parallel` | Modo manual, para depurar uma fase isolada |
| `post-verify <verify.yaml>` | Reexecuta a revisão automática de uma spec já verificada |
| `discard-spec-worktree <path>` | Descarta worktree e (opcionalmente) a branch da spec |

---

## Como está organizado

```
.claude-plugin/marketplace.json         ← o repo é o próprio marketplace
plugins/spec-harness/
  .claude-plugin/plugin.json
  hooks/hooks.json                      ← PreToolUse → engine/hook-guard.sh
  skills/spec-harness/                  ← SKILL.md + references/ (task-packets, verify)
  engine/
    harness.ts                          ← o motor inteiro, sem nada de stack hardcoded
    hook-guard.sh                       ← guarda barata do hook (ver ressalvas)
    templates/harness.config.template.json
    tools/crap_calculator.py
```

**O perfil é do repositório, não do plugin.** `init-repo` escreve
`.claude/spec_harness/harness.config.json` no repo alvo, e é lá que ficam escopos, extensões,
validadores, comando de teste, CRAP e revisão automática. Versione esse arquivo com o repo.

### O que o `init-repo` detecta sozinho

Linguagem (`pytest.ini`/`pyproject`/`package.json`/`go.mod`), comando de teste — inclusive
`--no-cov` quando o `addopts` já força cobertura —, linter presente, **escopos** (subdiretórios do
contêiner de domínios: `app/plataformas`, `src/modules`, `packages`, `apps`…), `.env` para copiar
ao worktree, e se `radon`/`pytest-cov` existem para ligar o CRAP. O que ele não infere vira
`_pendencias` no próprio JSON, e o `doctor` trata cada pendência como ERRO — configuração
incompleta não passa despercebida.

---

## As fases

| Fase | Escreve | Gate |
|---|---|---|
| **RED** | só `test_paths` | O teste tem de falhar **pelo motivo certo**: em Python, exit 1 com `failed`, nunca o exit 2 de erro de coleta |
| **GREEN** | só `impl_paths` | Teste passa, lint limpo, nenhum arquivo de teste tocado |
| **VERIFY** | nada | Reexecuta tudo, mede CRAP e dispara a revisão automática |

A fase VERIFY **não abre sessão de modelo**: ela não escreve nada, e seus validadores são
rodados pelo próprio motor — uma sessão ali só gastaria tokens para observar um resultado já
produzido.

### CRAP (determinístico)

Depois do commit do VERIFY, o motor roda a suíte do **escopo** com relatório JSON de cobertura e
pontua `complexidade² × (1 − cobertura)³ + complexidade` **apenas nas funções de produção que a
spec alterou**. O resumo vai para a evidência e o top-N entra no prompt do code review.

CRAP é **sinal, não alvo**: um teste sem `assert` derruba o número igual a um teste bom. Por isso
nenhuma sessão de modelo recebe "reduza o CRAP" como tarefa.

### Revisão automática pós-VERIFY

Roda uma vez por spec (marcador `.post-verify.json`): um agente de code review — que recebe a
spec, o diff e o top-N de CRAP — e, se o plugin `cognitive-loop` estiver disponível, o
explicador da mudança. Gate `warn` por padrão.

---

## Ressalvas

Leia antes de adotar. Nenhuma delas é bug; são escolhas com custo.

**1. O hook roda em toda tool call — por isso existe a guarda.**
`PreToolUse` com matcher `*` é invocado em cada chamada de ferramenta, de qualquer sessão.
Invocar o motor direto custa ~370 ms (node + type stripping) por chamada. `hook-guard.sh` sai em
~3 ms quando não há spec ativa (`/tmp/spec_harness/active/` vazio) e só então delega. Se você
mexer no hook, mantenha a guarda.

**2. Path scoping é enforcement, não sandbox.**
O hook bloqueia `Read`/`Write`/`Edit`/`Bash` fora de `capabilities.*.paths` enquanto uma fase está
aberta, e o `verify-packet` recusa qualquer arquivo alterado fora do escopo. Mas ele depende de o
Claude Code chamar o hook: um processo que você dispare por fora (um script, um editor) não é
interceptado. O gate de diff no VERIFY é a rede de baixo.

**3. As fases custam tokens de verdade.**
RED e GREEN são sessões headless (padrão: sonnet), com até 2 tentativas cada, e a revisão
pós-VERIFY são mais duas sessões. Uma spec = até 6 sessões. Uma sessão que termina com **zero
arquivo alterado** quase nunca é problema de spec: costuma ser limite de gasto da conta, spawn
falhando ou path bloqueado pelo hook — o `autorun` imprime a cauda do log nesse caso.

**4. `.specs/` costuma estar no `.gitignore`.**
Se estiver, o worktree da spec nasce **sem** a spec Markdown. O motor copia os artefatos
(`syncSpecArtifacts`) antes de calcular o baseline por causa disso. Se você mudar a estrutura de
diretórios das specs, revise essa parte.

**5. A detecção do `init-repo` é chute informado.**
Escopos e comando de teste são os dois campos que mais merecem revisão humana. Num repo de
módulo único, a heurística gera um escopo só e marca pendência de propósito: "uma spec toca um
escopo" só significa alguma coisa se os escopos refletirem fronteiras reais.

**6. CRAP depende de Python.**
`crap_calculator.py` usa `radon` + relatório JSON do `coverage.py`. Em repo de outra stack a
etapa fica desligada (aviso, não erro) e o resto do harness funciona igual.

**7. O job `cognitive_loop` depende de um plugin externo.**
Se `cognitive-loop` não estiver na máquina, `init-repo` remove o job. `code-review` funciona em
qualquer repo.

**8. Estado local em `/tmp`.**
Worktrees, runs, logs e métricas vivem em `/tmp/spec_harness/` (ou `$SPEC_HARNESS_HOME`). Reboot
apaga tudo — inclusive worktrees de specs em andamento. As branches `spec/<feature>/<NN>`
sobrevivem, porque estão no repo.

**9. `format` e `typecheck` vêm desligados.**
Numa base com dívida acumulada, ligá-los como gate por fase reprova specs por problema alheio. O
template deixa `null` e documenta; ligue quando a base sustentar.

**10. `verify-packet` avulso não substitui revisão.**
`ready_for_review` quer dizer "os gates mecânicos passaram", não "está aprovado". Os campos de
`manual_review` (contract, forbidden.behaviors, review.focus) existem para a leitura humana, e o
PR do repositório continua com os gates dele.

---

## Desenvolvimento

```bash
cd plugins/spec-harness/engine
npm install          # typescript e @types (não versionados; só o yaml vai no repo)
npm run typecheck
```

O motor não tem nada de stack hardcoded: escopos, extensões, validadores, comando de teste e
etapas opcionais vêm do `harness.config.json` do repositório alvo. Se você precisar tocar o
`harness.ts` para suportar uma stack, provavelmente o lugar certo era a config ou o template.

## Licença

MIT — ver [LICENSE](LICENSE).
