# Spec 01 — Normalizar valor monetário digitado

## Contexto

O sistema exibe valores com `calc/formatador.py::formatar_brl`, mas não tem o
caminho de volta: quando o usuário **digita** um valor, alguém precisa
transformar a string em `Decimal`. Hoje cada chamador faz isso à mão, com
`float()`, e o arredondamento binário já produziu diferença de centavo em
fechamento.

Esta spec cria `calc/valor.py::normalizar_valor`, o único ponto de entrada de
valor digitado.

## Contratos

`normalizar_valor(bruto: str) -> Decimal`

Aceita o que um usuário brasileiro digita e devolve `Decimal` com **duas casas
decimais exatas**. Entrada inválida levanta `ValueError` com mensagem exibível.

## Requisitos funcionais

| ID | Requisito |
|----|-----------|
| RF-01 | Aceita vírgula como separador decimal: `"1234,5"` → `Decimal("1234.50")` |
| RF-02 | Aceita ponto como separador de milhar junto com a vírgula decimal: `"1.234,50"` → `Decimal("1234.50")` |
| RF-03 | Aceita o prefixo `R$` e espaços em volta: `" R$ 1.234,50 "` → `Decimal("1234.50")` |
| RF-04 | Aceita negativo com o sinal antes do valor ou antes do `R$`: `"-R$ 7,10"` e `"R$ -7,10"` → `Decimal("-7.10")` |
| RF-05 | Sempre devolve escala 2, arredondando meio para cima: `"1,005"` → `Decimal("1.01")` |

## Casos de erro

| ID | Caso | Resultado |
|----|------|-----------|
| EC-01 | String vazia ou só espaços | `ValueError("Informe um valor.")` |
| EC-02 | Texto que não é número (`"abc"`, `"R$"`, `"1,2,3"`) | `ValueError("Valor inválido.")` |
| EC-03 | Nenhuma exceção da stdlib vaza — `InvalidOperation` vira `ValueError` | — |

## Testes (fase RED)

| ID | Teste |
|----|-------|
| T-01 | vírgula decimal (RF-01) |
| T-02 | milhar com ponto (RF-02) |
| T-03 | prefixo `R$`, espaços e negativo nas duas posições (RF-03, RF-04) |
| T-04 | arredondamento meio para cima e escala 2 (RF-05) |
| T-05 | vazio e texto inválido levantam `ValueError` (EC-01, EC-02, EC-03) |

## Arquivos permitidos

- Teste: `calc/tests/test_valor.py`
- Produção: `calc/valor.py`
