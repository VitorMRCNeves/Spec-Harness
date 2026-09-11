---
name: sdd
description: Quebra uma entrega em specs construíveis — documentos de Spec-Driven Design, um por unidade implementável e testável. Use quando o usuário quiser especificar antes de implementar, pedir "escreve um spec", "cria um SDD", "spec-driven design", "planejar essa feature/tarefa antes de codar", ou quiser fixar contratos e casos de teste antes do código. Aceita descrição livre OU referência a um ticket (chave tipo ABC-1234 ou link do rastreador). Na primeira execução num repositório, escaneia o projeto (e pergunta o que não conseguir inferir) para gravar .claude/sdd/perfil.md. Em entrega grande, roda uma fase opcional de pesquisa de padrões de mercado e design de arquitetura que grava design.md. Produz .specs/sdd-<feature>/ com descricao_alto_nivel.md, implementacao.md (com ondas de paralelização), progresso.md e specs/NN-<nome>.md — cada spec uma fatia vertical — consumidos depois pela skill 'spec-harness', que implementa cada spec com enforcement.
argument-hint: <descrição da feature | chave/link do ticket | --setup>
allowed-tools: [Read, Glob, Grep, Bash, Agent, AskUserQuestion, Write, Skill, WebSearch, WebFetch]
---

# Spec-Driven Design (SDD) — Orquestrador

Você está quebrando uma entrega em **specs construíveis**: cada uma é a menor mudança que dá
para implementar e provar com teste, com contrato explícito e critérios de aceite verificáveis.
O resultado dá ao implementador (humano ou agente) tudo o que ele precisa para escrever os
testes **antes** do código.

O usuário invocou com: **$ARGUMENTS**

`$ARGUMENTS` pode ser uma descrição livre, uma referência a um ticket (chave `ABC-1234`, só o
número, ou um link do rastreador) ou `--setup` para refazer o perfil do repositório.

A saída é uma pasta `.specs/sdd-<feature-slug>/`, consumida depois pela skill `spec-harness`,
que implementa cada spec num worktree isolado com enforcement de path — o SDD **não** escreve
código de produção.

---

## Fluxo de execução

Execute as fases **na ordem abaixo**. Cada fase tem seu arquivo de instruções — leia o arquivo
antes de executar a fase. Os caminhos são relativos a este diretório de skill.

| Fase | Arquivo | O que faz | Pré-requisito |
|------|---------|-----------|---------------|
| 1 | `fases/fase1_setup.md` | **Só na primeira vez no repositório** (ou com `--setup`): escaneia o projeto, pergunta o que não inferir e grava `.claude/sdd/perfil.md` | — |
| 2 | `fases/fase2_ticket_grilling.md` | Busca o ticket (se houver referência) e roda uma sessão de grilling para afiar a ideia antes de qualquer pergunta estruturada | Fase 1 concluída |
| 3 | `fases/fase3_alinhamento.md` | Coleta objetivo e regras de negócio; reaproveita o que a Fase 2 já resolveu e só pergunta o que ficou em aberto | Fase 2 concluída |
| 4 | `fases/fase4_exploracao.md` | Explora o shape real de contratos, schemas e entidades envolvidos | Fase 3 concluída |
| 5 | `fases/fase5_investigacao.md` | Investiga os padrões do repositório e módulos similares | Fase 3 concluída (paralela com a Fase 4) |
| 6 | `fases/fase6_design.md` | **Opcional — só em entrega grande:** pesquisa padrões de mercado e desenha a arquitetura em `design.md`, de onde sai o fatiamento vertical | Fases 4 e 5 concluídas |
| 7 | `fases/fase7_fatiamento.md` | Lista comportamentos observáveis, corta em specs verticais, monta o grafo e as ondas de paralelização, e confirma | Fases 4 e 5 concluídas (e 6, se rodou) |
| 8 | `fases/fase8_geracao.md` | Gera a pasta `.specs/sdd-<slug>/` com todos os arquivos | Fase 7 concluída |

---

## Arquivos de referência

| Arquivo | Quando usar |
|---------|-------------|
| `.claude/sdd/perfil.md` (no repo alvo) | Perfil do repositório — leia **antes de tudo**; é o que ancora as fases numa stack real |
| `templates/perfil_repo.md` | Template do perfil (usado na Fase 1) |
| `templates/design.md` | Template para `design.md` (Fase 6, opcional) |
| `exploracao_contratos.md` | Prompt do agente de exploração (usado na Fase 4) |
| `templates/descricao_alto_nivel.md` | Template para `descricao_alto_nivel.md` (Fase 8) |
| `templates/implementacao.md` | Template para `implementacao.md` (Fase 8) |
| `templates/progresso.md` | Template para `progresso.md` (Fase 8) |
| `templates/spec.md` | Template para cada arquivo em `specs/` (Fase 8) |
| `regras/qualidade.md` | Regras e anti-padrões — leia antes de escrever qualquer spec |
| `referencias/spec_template.md` | Template RFC de referência — base estrutural |
| `referencias/sdd_guide.md` | Guia de metodologia SDD — para dúvida conceitual |
| skill de grilling (ex.: `grilling`, do plugin `mattpocock-skills`) | Entrevista o usuário em rounds até a ideia estar afiada (Fase 2) |
| skill/MCP do rastreador de issues, se houver | Busca o ticket quando `$ARGUMENTS` traz chave ou link (Fase 2) |

---

## Regras globais

1. **Não pule fases.** Cada fase alimenta a seguinte — pular produz specs com contratos
   inventados ou escopo errado.
2. **Leia `.claude/sdd/perfil.md` antes da Fase 3.** Ele é o que impede esta skill de propor
   uma arquitetura que não é a do repositório. Se não existir, rode a Fase 1 primeiro.
3. **Fases 4 e 5 podem rodar em paralelo** (ambas dependem só da Fase 3).
4. **Leia o arquivo de instruções da fase antes de executá-la** — as instruções estão nos
   arquivos acima, não neste orquestrador.
5. **Leia `regras/qualidade.md` antes de escrever qualquer spec** na Fase 8.
6. **Nunca invente contrato, DTO, entidade ou schema.** Se a Fase 4 não retornou o shape real,
   resolva os GAPS antes de continuar — ou registre `⚠️ ABERTO:` na spec, que é o que faz o
   `spec-harness` recusar a implementação.
7. **A granularidade sai do perfil, não do seu gosto.** O campo "unidade de entrega" do
   `perfil.md` define o que é uma spec neste repositório; a Fase 7 aplica isso.
8. **Spec é fatia vertical, não camada.** O corte é por comportamento observável, atravessando
   todos os artefatos que ele exige dentro de um escopo. Spec horizontal (só o modelo, só o
   serviço, só a rota) só se justifica como substrato compartilhado, e no máximo duas por
   entrega. O que faz a regra valer é a seção `## Prova de independência` da spec: ela não é
   preenchível por uma spec horizontal.
9. **Otimize o grafo para largura, não para ordem.** A Fase 7 entrega ondas de paralelização, e
   uma dependência só existe quando a spec B não roda os próprios testes sem o código de
   produção de A. Entrega em que nada roda em paralelo é sintoma, não plano — diga isso ao
   usuário em vez de seguir.
10. **A Fase 6 é opcional e não se decide sozinha.** Rode quando um dos gatilhos de
   `fases/fase6_design.md § 6.0` for verdade, e confirme com o usuário antes de gastá-la.
   Sem gatilho, a seção "Arquitetura da Feature" do `descricao_alto_nivel.md` basta — não crie
   `design.md` vazio de decisão.
11. **A Fase 2 é obrigatória em toda invocação**, com ou sem ticket — a busca do ticket é o
   único passo opcional dela. Não pule para a Fase 3 achando a descrição "clara o suficiente":
   quem decide isso é a sessão de grilling.
12. **Não duplique lógica de outra skill.** Busca de issue e entrevista são delegadas às skills
   correspondentes quando existirem; a Fase 2 só orquestra as chamadas.
13. **Depois de gerar a pasta**, avise que a implementação acontece via `spec-harness`
    (`scaffold-packet` + `autorun`), não escrevendo código direto a partir do SDD — e que as
    specs de uma mesma onda vão juntas em `run-parallel`, não uma de cada vez.
