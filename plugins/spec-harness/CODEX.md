# Spec-Harness no Codex

As duas skills usam os mesmos templates e specs do Claude. Este guia adapta as instruções específicas do provedor; o restante do método continua válido.

## Skills e ferramentas

- Invoque `$sdd` para planejar e `$spec-harness` para executar specs existentes.
- O pedido do usuário substitui `$ARGUMENTS`. Prefira `AGENTS.md` como instrução do repositório.
- Use as ferramentas nativas disponíveis para ler, buscar e editar arquivos, executar shell, pesquisar e esclarecer dúvidas. Nomes como `Read`, `Bash`, `AskUserQuestion` e `Skill` nas referências são papéis do Claude, não ferramentas obrigatórias no Codex.
- Se grilling, rastreador ou outras skills citadas não estiverem instaladas, execute a entrevista diretamente e leia o ticket por uma integração disponível. Não invente resultados de ferramentas ausentes.
- Delegue fases independentes apenas se ferramentas de subagentes e autorização estiverem disponíveis; caso contrário execute sequencialmente. Preserve as dependências.
- O perfil `.claude/sdd/perfil.md` e a configuração `.claude/spec_harness/harness.config.json` são compartilhados por compatibilidade de formato. O nome da pasta não exige Claude instalado.

## Motor

Resolva o motor a partir do caminho desta skill: `../../engine/harness.ts` (relativo à pasta da skill). Use seu caminho absoluto, mantendo o diretório de execução no repositório alvo. Não use `~/.claude/spec_harness` no Codex.

```bash
node /caminho/do/plugin/engine/harness.ts init-repo --agent codex
node /caminho/do/plugin/engine/harness.ts doctor
node /caminho/do/plugin/engine/harness.ts scaffold-packet .specs/sdd-feature/specs/01-exemplo.md
node /caminho/do/plugin/engine/harness.ts autorun .specs/sdd-feature/packets/SDD-01.yaml --no-merge
```

`init-repo` mantém uma configuração existente. Para migrá-la, defina `agent: "codex"`, retire o modelo Claude de `implementer.model` e `post_verify.model` (ou configure um modelo Codex explicitamente), use prompts de revisão autocontidos e remova `plugin_dirs`/`add_dirs` dos jobs. Não use `--force` para migrar uma config personalizada sem preservar suas escolhas.

Use o modelo padrão do Codex quando não houver escolha explícita. RED e GREEN rodam em sessões independentes com `codex exec --sandbox workspace-write --ephemeral`; os commits no worktree fazem o handoff. O harness mantém os gates de RED/GREEN/VERIFY e registra o tipo de enforcement na evidência. A revisão pós-VERIFY usa um prompt autocontido e exige `code-review.json`; não depende dos plugins Claude de revisão ou de quiz.

## Garantias e limites

O adaptador não instala nem executa o hook `PreToolUse` do Claude. A sandbox delimita o workspace; a allowlist do packet é auditada pelo motor **depois da fase**. Não existe bloqueio preventivo por arquivo, controle de leituras ou de alterações transitórias. Não afirme equivalência com o enforcement do Claude. O campo `path_enforcement: "post-phase-audit"` documenta essa diferença.

Não afrouxe a sandbox para contornar erros de ambiente. Corrija o ambiente ou reporte o bloqueio. Prefira `--no-merge`, examine as evidências e revise o diff antes de `merge-spec`. Em um repo vazio, prepare o perfil somente após definir stack, comandos de teste e fronteiras; não preencha essas decisões com suposições para fazer o doctor passar.

## Instalação e atualização local

O manifest está em `.codex-plugin/plugin.json`. Registre o plugin no marketplace pessoal do Codex e instale com `codex plugin add spec-harness@personal`. Para atualizar uma instalação existente, use o helper `update_plugin_cachebuster.py` da skill plugin-creator e reinstale. Abra uma nova conversa para carregar as skills atualizadas.

Referências: [skills](https://learn.chatgpt.com/docs/build-skills) e [execução não interativa](https://learn.chatgpt.com/docs/non-interactive-mode). CLI verificada no setup: Codex 0.154.0, Node 22.23.0.
