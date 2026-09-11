# Regras de Qualidade das Specs

Leia este arquivo antes de escrever qualquer spec. Violar uma regra é bloqueante — corrija o
design antes de continuar.

As regras abaixo são **agnósticas de stack**. O que é específico do repositório (padrão de erro,
transação, tipagem, níveis de teste obrigatórios) sai de `.claude/sdd/perfil.md` e do
`CLAUDE.md`/`AGENTS.md` — cite a regra de lá em vez de inventar uma.

---

## Regras de Conteúdo

| Regra | O que verificar |
|-------|----------------|
| **Fatia vertical, não camada** | A spec entrega um comportamento observável através de todos os artefatos que ele exige no escopo dela — não uma camada de vários comportamentos |
| **Prova de independência preenchida** | A seção `## Prova de independência` traz a ação que prova a spec sozinha. Vazia, genérica ou "rodar os testes" = corte horizontal disfarçado |
| **Testável sem outra spec** | A spec pode ser implementada e testada sem depender do código de outra spec (salvo dependência declarada em "Depende de") |
| **Um escopo por spec** | A spec toca um único escopo do `spec-harness`. Comportamento que atravessa escopos vira duas specs irmãs, não duas camadas |
| **Onda declarada** | O cabeçalho traz a onda, e ela é consistente com o grafo do `implementacao.md` |
| **Comportamento, não implementação** | A spec descreve o QUÊ, não o COMO. "Deve rejeitar com conflito quando X" — não "use a função Y para..." |
| **Prontidão para implementação sem diálogo** | Um desenvolvedor ou agente consegue implementar sem fazer nenhuma pergunta |
| **Ambiguidade zero** | Toda incerteza marcada com `⚠️ ABERTO:` e listada nas Open Questions — o `spec-harness` recusa spec com marcador pendente |
| **RFs testáveis isoladamente** | Cada RF-XX pode ser verificado por um teste específico |
| **Arquivos permitidos declarados** | A seção `## Arquivos permitidos` lista produção e testes, com um bullet por arquivo — é dela que sai o packet |
| **Selo 🟡 obrigatório** | Todos os RFs, ECs, contratos e itens de checklist nascem com `🟡` |

---

## Anti-padrões — Bloqueie Antes de Escrever

| Anti-padrão | Correção |
|-------------|----------|
| Contrato, entidade ou schema inventado sem exploração | Execute a Fase 4 e documente o shape real, com o caminho do arquivo onde ele está |
| Fixture de teste com campos diferentes do contrato real | Nomes de campos idênticos ao contrato real — é o erro mais comum e o mais caro |
| Casos de teste cobrindo apenas o caminho feliz | Cada unidade precisa de ao menos um caso de borda e um de falha |
| Erro de negócio engolido por captura silenciosa | Siga o padrão de erro do repositório (perfil § Padrões obrigatórios). Captura vazia, ou que só loga e segue, é proibida |
| Efeito colateral no meio do fluxo transacional principal | Descreva o mecanismo que o repositório usa para isso (fila, evento, job) e mantenha fora da transação de escrita |
| Operação que escreve em várias fontes sem declarar atomicidade | Declare explicitamente no contrato como a consistência é garantida |
| Escape de tipagem proposto no contrato (`any`, ignore de type checker) | Proibido — proponha o tipo real, ou registre `⚠️ ABERTO:` |
| Valor mágico onde o repositório tem constante/token/enum | Referencie o existente; a Fase 5 já levantou o que há |
| Estado derivado descrito como efeito | Descreva como valor calculado a partir da entrada, não como efeito colateral |
| Reimplementação de algo que já existe | Liste os helpers levantados na Fase 5 antes de propor código novo |
| **Spec nomeada por artefato** ("modelo de X", "serviço de Y", "store de Z") | Sintoma de corte por camada. Renomeie pelo comportamento observável; se não sair nome de comportamento, o corte está errado |
| **Spec sem prova de independência** | Não é fatia: é camada. Refaça o corte em `fase7_fatiamento.md § 7.2` — ou, se for substrato, declare como tal (máx. 2 por entrega) |
| **Terceira spec de substrato na mesma entrega** | Corte por camada travestido. Absorva o substrato dentro das fatias que o consomem |
| **Grafo de dependências em linha reta** (`01→02→03→…`) | Quase sempre dependência inventada. Para cada seta pergunte *o que quebra nos testes de B se A não existir?* — resposta vaga, seta apagada |
| **`Depende de` usado como ordem de leitura** | Dependência é só uma: B não roda os próprios testes sem o código de produção de A. Afinidade temática não é dependência — é o que serializa a entrega |
| Spec que atravessa dois escopos | Quebre em duas specs irmãs, cada uma vertical no seu escopo; a de consumo lê a seção `## Contratos` da outra, nunca os arquivos de produção dela |
| Spec sem Open Questions havendo ambiguidade | Toda dúvida vira `⚠️ ABERTO:` + linha na tabela |

---

## Critério de qualidade por seção

### Requisitos Funcionais
- Cada RF responde "como eu sei que isso está implementado?" com condição verificável
- Nenhum RF menciona biblioteca ou classe concreta — fala em comportamento observável
- RFs **Must** são o mínimo sem o qual a spec não pode ir para implementação

### Contratos
- Entrada e saída tipadas explicitamente, na notação da linguagem do repositório
- Cada erro possível documentado com o tipo/código e a condição exata que o dispara
- Efeitos colaterais documentados: o que persiste, o que publica, o que chama fora — e em que
  ordem
- Erro de infraestrutura propaga; erro de negócio é resultado previsto, não exceção escondida
- Quando a spec expõe algo para fora, o mapeamento erro → protocolo (status HTTP, código de
  saída, dead-letter) está explícito
- Quando a spec tem superfície de interação, os estados observáveis estão cobertos: vazio,
  carregando, erro, sucesso

### Edge Cases
- Todo EC tem trigger claro (o que provoca) e comportamento esperado claro (o que o sistema faz)
- EC de "dependência externa indisponível" presente sempre que houver chamada externa — as
  integrações recorrentes estão no perfil
- EC de "sem permissão" presente sempre que o alvo for protegido por controle de acesso

### Casos de Teste
- Pelo menos um teste por RF **Must** e um por EC **Must**
- Os níveis exigidos são os que `.claude/sdd/perfil.md § Testes` declara — inclusive o gatilho
  que torna o nível mais caro (integração, e2e) obrigatório
- O teste assere o resultado, não a ausência de exceção: verifique o ramo de erro
  explicitamente, com o payload
- Cada caso aponta o arquivo de teste onde vai morar, dentro dos **Arquivos permitidos**
- Nenhuma fixture contradiz os casos de borda descritos na descrição de alto nível
