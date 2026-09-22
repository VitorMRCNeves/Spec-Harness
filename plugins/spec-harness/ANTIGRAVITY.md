# Spec-Harness na Antigravity CLI

As quatro skills usam os mesmos templates e specs do Claude. Este guia adapta as instruções específicas do host; o restante do método continua válido.

## Skills e ferramentas

- Invoque as skills `sdd`, `spec-harness`, `spec-orchestrator` e `qa-tester`.
- O pedido do usuário substitui `$ARGUMENTS`. Prefira `AGENTS.md` como instrução do repositório.
- Ferramentas nativas: `view_file`, `grep_search`, `find_by_name`, `list_dir`, `write_to_file`, `replace_file_content`, `multi_replace_file_content` e `run_command` (`CommandLine`, `Cwd`). Nomes como `Read`, `Bash` e `AskUserQuestion` nas referências são papéis do Claude.
- Se grilling, rastreador ou outras skills citadas não estiverem instaladas, execute a entrevista diretamente. Não invente resultados de ferramentas ausentes.
- O perfil `.claude/sdd/perfil.md` e a configuração `.claude/spec_harness/harness.config.json` são compartilhados por compatibilidade de formato.

## Motor

Resolva o motor a partir do caminho desta skill: `../../engine/harness.ts`.

```bash
node /caminho/do/plugin/engine/harness.ts init-repo --agent antigravity
node /caminho/do/plugin/engine/harness.ts doctor
node /caminho/do/plugin/engine/harness.ts autorun .specs/sdd-feature/packets/SDD-01.yaml --no-merge
```

`init-repo --agent antigravity` grava `.agents/hooks.json` com a chave `spec-harness-path-scope`. O pacote do plugin (`plugin.json`, `skills/`, `hooks.json` na raiz) instala com `agy plugin install /caminho/plugins/spec-harness`. Os dois gates decidem a mesma coisa; o do workspace usa caminho absoluto e continua valendo mesmo se a versão do `agy` só registrar o hook do plugin por outro caminho.

RED e GREEN rodam com `agy -p` no worktree, `--output-format json`. A retomada usa `--conversation` com o id gravado na run. Stdout vazio, mesmo com exit 0, é falha da fase — não aprovação. Status diferente de `SUCCESS` também reprova. `--dangerously-skip-permissions` só entra se `implementer.skip_permissions` for `true`. Sem isso o shell headless pode ser negado; o doctor avisa.

## Garantias e limites

O `PreToolUse` responde `{"decision":"allow"}` ou `{"decision":"deny","reason":"..."}`. Sem run ativa a resposta é allow. O campo `path_enforcement` é `pre-tool-hook-and-audit`. A revisão pós-VERIFY é um job autocontido, sem `plugin_dirs`/`add_dirs` do Claude.

Não afrouxe a permissão da sessão para contornar o hook. Não afirme paridade com o Codex: lá não há bloqueio preventivo. Não trate stdout vazio como fase pronta.

## Instalação

```bash
agy plugin install /caminho/Spec-Harness/plugins/spec-harness
```

O manifest aceita só `name` e `description`. As skills são as quatro pastas em `skills/`. O comando do hook é `hooks/antigravity-guard.sh`, que exporta `SPEC_HARNESS_HOOK_HOST=antigravity` e chama `engine/hook-guard.sh`.
