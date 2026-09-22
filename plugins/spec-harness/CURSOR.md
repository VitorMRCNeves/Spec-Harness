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
node /caminho/do/plugin/engine/harness.ts verify-packet .specs/sdd-feature/packets/.expanded/SDD-01-red.yaml
```

`init-repo --agent cursor` grava `.cursor/hooks.json` (`beforeReadFile`, `beforeShellExecution`, `preToolUse`, `afterFileEdit`, `failClosed: true`) e liga as quatro skills em `.cursor/skills/` por symlink. Não apaga hooks de outros eventos. Não há `autorun` headless: não existe um equivalente estável de `claude -p` para spawnar daqui. A fase é implementada nesta sessão, dentro do worktree da run, e o motor só verifica.

## Garantias e limites

O hook de projeto bloqueia leitura e escrita fora dos globs do packet, e shell fora da allowlist, enquanto existe run ativa. Sem run ativa a guarda responde `{"permission":"allow"}` e sai 0. O campo `path_enforcement` é `pre-tool-hook-and-audit`.

A sessão precisa trabalhar com cwd ou path absoluto dentro do worktree da run. Fora dele o hook não acha a execução e libera. Não afirme paridade com o Codex: lá a auditoria é pós-fase e não há hook preventivo. Não afirme `autorun` headless neste host.

Prefira implementar no worktree aberto, rode `verify-packet` e examine a evidência antes de `merge-spec`. Em um repo vazio, prepare o perfil somente após definir stack, comandos de teste e fronteiras.

## Instalação

Não há marketplace. O registro é o `init-repo --agent cursor` no repositório. Abra o projeto de novo se as skills em `.cursor/skills/` não aparecerem.
