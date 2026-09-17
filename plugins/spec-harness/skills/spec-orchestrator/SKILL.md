---
name: spec-orchestrator
description: Implementa todas as specs de uma feature SDD (.specs/sdd-<feature>/) direto, sem o motor do spec-harness — um subagente lean por spec lê a spec.md, escreve o teste (RED) e o código (GREEN) na mesma sessão, isolado por git worktree, em paralelo quando specs não dependem entre si e em sequência quando dependem. Sem packet YAML, sem evidence.json, sem gates automáticos, sem PROJECT_MAP.md inteiro por fase — o objetivo é gastar muito menos token que o autorun do spec-harness. Use quando o usuário quiser "implementar a feature inteira" priorizando custo baixo, ou disser que o spec-harness está caro/insustentável para esse caso.
allowed-tools: [Read, Glob, Grep, Bash, Edit, Agent]
---

# Spec Orchestrator (lean)

Alternativa ao `autorun` do `spec-harness` para quando o custo de token do motor (packet YAML,
`PROJECT_MAP.md` completo por fase, `evidence.json`, retries, `code-review-skill` por spec) não
compensa. Aqui não tem motor: o subagente lê a spec Markdown direto e implementa. O que se mantém
do `spec-harness` é só o essencial — TDD (teste antes do código) e isolamento por spec — nada da
maquinaria em volta.

Isolamento é **entre specs** (uma spec não vê o worktree/sessão de outra), não dentro de uma spec:
teste e código da mesma spec saem da **mesma** sessão de subagente, na ordem RED→GREEN — abrir
duas sessões por spec (uma só pra teste, outra só pro código) pagaria o contexto frio duas vezes
pelo mesmo trabalho, o oposto do que se quer aqui.

## Pré-condição

`.specs/sdd-<feature>/` já existe com `specs/NN-*.md` e `implementacao.md` (skill `sdd`). Não
precisa de perfil de `spec-harness` instalado, `doctor`, nem `harness.config.json` — esta skill
não usa nada disso.

## 1. Monte as ondas

Leia a coluna **Depende de** da tabela `## Ordem de Implementação` em `implementacao.md`. Onda 1
= specs com `—`. Onda N = specs cujas dependências já mergearam (marcadas 🟢 em `progresso.md`).
Specs da mesma onda sem dependência mútua rodam em paralelo.

## 2. Um subagente por spec da onda, disparados juntos

Antes de disparar, crie o isolamento (comandos, não subagente — não custa token):

~~~bash
git worktree add /tmp/spec-orch/<feature>-<NN> -b spec/<feature>/<NN>
~~~

Uma chamada `Agent` por spec da onda, `subagent_type: general-purpose`, todas na mesma mensagem
(paralelo de verdade). Não use `fork` — a sessão precisa ser enxuta, não herdar a conversa do
orquestrador.

Prompt autocontido por subagente (ele não vê esta conversa):

- Diretório: o worktree criado no passo acima. Trabalhe só dentro dele.
- Leia **só** a spec `specs/NN-*.md` inteira (ela é pequena de propósito). Seções que importam:
  `## Arquivos permitidos` (o que pode tocar — nada fora disso), `## Contratos` de specs das quais
  esta depende (leia só essa seção da spec dependida, nunca o código de produção dela — é o
  contrato, não a implementação), `## Casos de Teste Mínimos` (os testes a escrever e o comando de
  teste em `### Critério de aceite`).
- Se `PROJECT_MAP.md` existir na raiz do repo, leia só a Seção 0 + as seções que ela indicar pro
  escopo desta spec — nunca o arquivo inteiro (mesma regra do `spec-harness`, vale a pena manter:
  é o desperdício mais fácil de evitar).
- TDD: escreva o(s) teste(s) de `## Casos de Teste Mínimos` primeiro, rode o comando de teste,
  confirme que falha pelo motivo certo (se o teste importar um módulo que ainda não existe, a
  falha pode ser erro de coleta/import, não teste vermelho de verdade — cheque a mensagem). Só
  depois escreva o código de produção em `## Arquivos permitidos § Produção`, rode de novo até
  passar.
- Não toque nada fora de `## Arquivos permitidos`. Se a spec parecer incompleta ou ambígua
  (`⚠️ ABERTO:` pendente), pare e reporte — não invente.
- Se o comando de teste falhar por ambiente (binário ausente, `.env` faltando, import de pacote
  não instalado) em vez de por lógica, pare e reporte — o worktree novo pode não ter algo que não
  é versionado; não é algo que o subagente resolve de dentro.
- Ao final, edite a spec.md trocando 🟡 por ✅ nos RF/EC/T cobertos.
- Reporte: `status` (`done` / `blocked`), o que mudou, e o comando de teste final (pra o
  orquestrador reconferir depois, de graça, sem gastar token).

## 3. Depois que a onda inteira responder

Para cada spec `done`, o orquestrador (thread principal, sem subagente) reconfirma rodando o
comando de teste reportado dentro do próprio worktree — é só `Bash`, não custa token de LLM:

~~~bash
cd /tmp/spec-orch/<feature>-<NN> && <comando de teste reportado pelo subagente>
~~~

Se passar, merge sequencial (uma spec por vez — dois merges ao mesmo tempo na branch de trabalho
não é seguro):

~~~bash
git merge --no-edit spec/<feature>/<NN>
git worktree remove /tmp/spec-orch/<feature>-<NN> --force
git branch -D spec/<feature>/<NN>
~~~

Se a reconfirmação falhar ou o subagente reportou `blocked`: não mergeia, mantém o worktree pra
inspeção, reporta ao usuário, e pula (não dispara) qualquer spec de onda seguinte que dependa
dela.

## 4. Progresso

Depois de cada onda, atualize `.specs/sdd-<feature>/progresso.md` (🟢/❌ por spec, bloqueios
ativos) — arquivo já existe, gerado pela skill `sdd`.

## Quando usar o spec-harness em vez desta

Quando o repositório precisa do enforcement mecânico de verdade — hook que bloqueia escrita fora
do escopo em tempo real, evidência estruturada auditável, gate de cobertura, revisão automática de
código por spec — porque o custo de token do `autorun` é aceitável ali ou a spec é sensível o
bastante pra justificar. Esta skill troca esse enforcement por velocidade e custo baixo; não roda
as duas ao mesmo tempo na mesma spec.

## Quando não usar (nem esta, nem outra)

Uma spec só: chame o subagente direto ou implemente você mesmo — orquestrador é overhead sem
paralelismo pra ganhar.
