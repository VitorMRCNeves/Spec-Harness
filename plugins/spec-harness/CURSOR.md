# Spec-Harness no Cursor

As quatro skills usam os mesmos templates e specs do Claude. Este guia adapta as instruções específicas do host; o restante do método continua válido.

## Skills e ferramentas

- Invoque as skills `sdd`, `spec-harness`, `spec-orchestrator` e `qa-tester` nesta sessão.
- O pedido do usuário substitui `$ARGUMENTS`. Prefira `AGENTS.md` como instrução do repositório.
- Use as ferramentas nativas do Cursor para ler, buscar e editar arquivos e executar shell. Nomes como `Read`, `Bash`, `AskUserQuestion` e `Skill` nas referências são papéis do Claude, não ferramentas obrigatórias aqui.
- Se grilling, rastreador ou outras skills citadas não estiverem instaladas, execute a entrevista diretamente e leia o ticket por uma integração disponível. Não invente resultados de ferramentas ausentes.
- Delegue fases independentes apenas se subagentes estiverem disponíveis; caso contrário execute sequencialmente. Preserve as dependências.
- O perfil `.claude/sdd/perfil.md` e a configuração `.claude/spec_harness/harness.config.json` são compartilhados por compatibilidade de formato. O nome da pasta não exige Claude instalado.

## Motor

Resolva o motor a partir do caminho desta skill: `../../engine/harness.ts` (relativo à pasta da skill). Use o caminho absoluto, com o diretório de execução no repositório alvo.

```bash
node /caminho/do/plugin/engine/harness.ts init-repo --agent cursor
node /caminho/do/plugin/engine/harness.ts doctor
node /caminho/do/plugin/engine/harness.ts scaffold-packet .specs/sdd-feature/specs/01-exemplo.md
node /caminho/do/plugin/engine/harness.ts autorun .specs/sdd-feature/packets/SDD-01.yaml --no-merge
```

`init-repo --agent cursor` grava `.cursor/hooks.json` (`beforeReadFile`, `beforeShellExecution`, `preToolUse`, `failClosed: true`) e liga as quatro skills em `.cursor/skills/` por symlink. Não apaga hooks de outros eventos. O comando do hook tem o caminho absoluto do plugin nesta máquina: não commite `.cursor/hooks.json`; cada pessoa roda o `init-repo`. O worktree nasce da branch, então o `init-repo` também põe `.cursor/hooks.json` em `worktree.copy_paths`.

RED, GREEN e a revisão pós-VERIFY rodam com `cursor-agent -p --output-format json --trust --workspace <worktree>`. A retomada usa `--resume` com o `session_id` gravado na run. Aprovação exige exit 0 e `subtype: success` com `is_error: false`; stdout vazio ou fora do formato reprova. `--force` (shell sem aprovação) só entra com `implementer.skip_permissions: true` — o hook `failClosed` continua negando o que está fora do packet. O `cursor-agent` precisa estar logado (`cursor-agent login`).

Sem o `autorun`, a sessão do editor também pode implementar a fase dentro do worktree e rodar `verify-packet`.

## Garantias e limites

O hook de projeto bloqueia leitura e escrita fora dos globs do packet, e shell fora da allowlist, enquanto existe run ativa. O Cursor não tem evento antes da escrita: ela só é barrada no `preToolUse` (`afterFileEdit` roda depois e não bloqueia). No `preToolUse`, ferramenta sem regra no packet (subagente, MCP) é negada enquanto a run estiver ativa. Shell é checado por segmento: cada parte de `a && b`, `a; b` ou `a | b` precisa estar na allowlist (`git`, `cd`, `echo`, `pwd` passam sempre). Separadores e `<`/`>` entre aspas são texto — o trailer `Co-authored-by: Cursor <...>` que o Cursor põe nos commits não quebra a regra. Substituição de comando (`$(...)`, crase) e redirecionamento para arquivo são negados; `2>&1` e `>/dev/null` passam. Sem run ativa a guarda responde `{"permission":"allow"}` e sai 0. O campo `path_enforcement` é `pre-tool-hook-and-audit`.

A sessão precisa trabalhar com cwd, `working_directory` ou path dentro do worktree da run. Fora dele o hook não acha a execução e libera. Não afirme paridade com o Codex: lá a auditoria é pós-fase e não há hook preventivo.

Examine a evidência de cada fase antes de `merge-spec`. Em um repo vazio, prepare o perfil somente após definir stack, comandos de teste e fronteiras.

## Instalação

Não há marketplace. O registro é o `init-repo --agent cursor` no repositório. Abra o projeto de novo se as skills em `.cursor/skills/` não aparecerem.
