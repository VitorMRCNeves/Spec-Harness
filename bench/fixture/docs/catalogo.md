# Catálogo de módulos — calc
Referência dos módulos de `calc/`. Documento de consulta: abra a seção do módulo
que você vai tocar, não o arquivo inteiro.

## 1. `calc/formatador.py` — Formatação de valores para exibição
- **Função principal:** `formatar_brl()` — aplica separador de milhar e vírgula decimal.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 1.1 Caso 1
Quando a entrada de `formatar_brl` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `formatador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_formatador.py::test_caso_1`.

### 1.2 Caso 2
Quando a entrada de `formatar_brl` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `formatador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_formatador.py::test_caso_2`.

### 1.3 Caso 3
Quando a entrada de `formatar_brl` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `formatador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_formatador.py::test_caso_3`.

### 1.4 Caso 4
Quando a entrada de `formatar_brl` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `formatador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_formatador.py::test_caso_4`.

### 1.5 Caso 5
Quando a entrada de `formatar_brl` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `formatador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_formatador.py::test_caso_5`.

### 1.6 Caso 6
Quando a entrada de `formatar_brl` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `formatador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_formatador.py::test_caso_6`.

## 2. `calc/arredondamento.py` — Política de arredondamento financeiro
- **Função principal:** `arredondar_meio_para_cima()` — ROUND_HALF_UP em duas casas.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 2.1 Caso 1
Quando a entrada de `arredondar_meio_para_cima` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `arredondamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_arredondamento.py::test_caso_1`.

### 2.2 Caso 2
Quando a entrada de `arredondar_meio_para_cima` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `arredondamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_arredondamento.py::test_caso_2`.

### 2.3 Caso 3
Quando a entrada de `arredondar_meio_para_cima` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `arredondamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_arredondamento.py::test_caso_3`.

### 2.4 Caso 4
Quando a entrada de `arredondar_meio_para_cima` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `arredondamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_arredondamento.py::test_caso_4`.

### 2.5 Caso 5
Quando a entrada de `arredondar_meio_para_cima` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `arredondamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_arredondamento.py::test_caso_5`.

### 2.6 Caso 6
Quando a entrada de `arredondar_meio_para_cima` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `arredondamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_arredondamento.py::test_caso_6`.

## 3. `calc/cambio.py` — Conversão entre moedas
- **Função principal:** `converter()` — usa a cotação do dia, sem cache.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 3.1 Caso 1
Quando a entrada de `converter` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `cambio` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_cambio.py::test_caso_1`.

### 3.2 Caso 2
Quando a entrada de `converter` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `cambio` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_cambio.py::test_caso_2`.

### 3.3 Caso 3
Quando a entrada de `converter` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `cambio` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_cambio.py::test_caso_3`.

### 3.4 Caso 4
Quando a entrada de `converter` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `cambio` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_cambio.py::test_caso_4`.

### 3.5 Caso 5
Quando a entrada de `converter` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `cambio` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_cambio.py::test_caso_5`.

### 3.6 Caso 6
Quando a entrada de `converter` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `cambio` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_cambio.py::test_caso_6`.

## 4. `calc/juros.py` — Juros compostos e simples
- **Função principal:** `montante()` — capital sobre taxa e período.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 4.1 Caso 1
Quando a entrada de `montante` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `juros` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_juros.py::test_caso_1`.

### 4.2 Caso 2
Quando a entrada de `montante` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `juros` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_juros.py::test_caso_2`.

### 4.3 Caso 3
Quando a entrada de `montante` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `juros` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_juros.py::test_caso_3`.

### 4.4 Caso 4
Quando a entrada de `montante` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `juros` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_juros.py::test_caso_4`.

### 4.5 Caso 5
Quando a entrada de `montante` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `juros` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_juros.py::test_caso_5`.

### 4.6 Caso 6
Quando a entrada de `montante` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `juros` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_juros.py::test_caso_6`.

## 5. `calc/parcelamento.py` — Divisão de valor em parcelas
- **Função principal:** `dividir()` — distribui os centavos de resto na primeira parcela.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 5.1 Caso 1
Quando a entrada de `dividir` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `parcelamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_parcelamento.py::test_caso_1`.

### 5.2 Caso 2
Quando a entrada de `dividir` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `parcelamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_parcelamento.py::test_caso_2`.

### 5.3 Caso 3
Quando a entrada de `dividir` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `parcelamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_parcelamento.py::test_caso_3`.

### 5.4 Caso 4
Quando a entrada de `dividir` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `parcelamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_parcelamento.py::test_caso_4`.

### 5.5 Caso 5
Quando a entrada de `dividir` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `parcelamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_parcelamento.py::test_caso_5`.

### 5.6 Caso 6
Quando a entrada de `dividir` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `parcelamento` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_parcelamento.py::test_caso_6`.

## 6. `calc/imposto.py` — Retenções e alíquotas
- **Função principal:** `reter()` — aplica a faixa da tabela progressiva.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 6.1 Caso 1
Quando a entrada de `reter` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `imposto` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_imposto.py::test_caso_1`.

### 6.2 Caso 2
Quando a entrada de `reter` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `imposto` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_imposto.py::test_caso_2`.

### 6.3 Caso 3
Quando a entrada de `reter` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `imposto` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_imposto.py::test_caso_3`.

### 6.4 Caso 4
Quando a entrada de `reter` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `imposto` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_imposto.py::test_caso_4`.

### 6.5 Caso 5
Quando a entrada de `reter` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `imposto` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_imposto.py::test_caso_5`.

### 6.6 Caso 6
Quando a entrada de `reter` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `imposto` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_imposto.py::test_caso_6`.

## 7. `calc/percentual.py` — Aritmética de percentuais
- **Função principal:** `aplicar()` — evita erro de ponto flutuante somando percentuais.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 7.1 Caso 1
Quando a entrada de `aplicar` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `percentual` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_percentual.py::test_caso_1`.

### 7.2 Caso 2
Quando a entrada de `aplicar` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `percentual` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_percentual.py::test_caso_2`.

### 7.3 Caso 3
Quando a entrada de `aplicar` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `percentual` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_percentual.py::test_caso_3`.

### 7.4 Caso 4
Quando a entrada de `aplicar` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `percentual` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_percentual.py::test_caso_4`.

### 7.5 Caso 5
Quando a entrada de `aplicar` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `percentual` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_percentual.py::test_caso_5`.

### 7.6 Caso 6
Quando a entrada de `aplicar` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `percentual` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_percentual.py::test_caso_6`.

## 8. `calc/comparador.py` — Comparação tolerante de valores
- **Função principal:** `equivalentes()` — tolerância de um centavo.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 8.1 Caso 1
Quando a entrada de `equivalentes` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `comparador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_comparador.py::test_caso_1`.

### 8.2 Caso 2
Quando a entrada de `equivalentes` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `comparador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_comparador.py::test_caso_2`.

### 8.3 Caso 3
Quando a entrada de `equivalentes` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `comparador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_comparador.py::test_caso_3`.

### 8.4 Caso 4
Quando a entrada de `equivalentes` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `comparador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_comparador.py::test_caso_4`.

### 8.5 Caso 5
Quando a entrada de `equivalentes` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `comparador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_comparador.py::test_caso_5`.

### 8.6 Caso 6
Quando a entrada de `equivalentes` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `comparador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_comparador.py::test_caso_6`.

## 9. `calc/agregador.py` — Somas e médias de coleções
- **Função principal:** `somar()` — preserva a escala do maior operando.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 9.1 Caso 1
Quando a entrada de `somar` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `agregador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_agregador.py::test_caso_1`.

### 9.2 Caso 2
Quando a entrada de `somar` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `agregador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_agregador.py::test_caso_2`.

### 9.3 Caso 3
Quando a entrada de `somar` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `agregador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_agregador.py::test_caso_3`.

### 9.4 Caso 4
Quando a entrada de `somar` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `agregador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_agregador.py::test_caso_4`.

### 9.5 Caso 5
Quando a entrada de `somar` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `agregador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_agregador.py::test_caso_5`.

### 9.6 Caso 6
Quando a entrada de `somar` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `agregador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_agregador.py::test_caso_6`.

## 10. `calc/serializador.py` — Leitura e escrita de valores em texto
- **Função principal:** `dumps()` — emite ponto como separador decimal.
- **Entrada:** `Decimal`, nunca `float`. Receber `float` é erro de chamada,
  e o módulo levanta `TypeError` em vez de converter em silêncio: a conversão
  esconderia a perda de precisão que já aconteceu antes da chamada.
- **Saída:** `Decimal` com a escala declarada pela política de arredondamento.
- **Erros:** entrada fora do domínio vira `ValueError` com mensagem exibível.
  `InvalidOperation` da stdlib nunca sobe: ela vaza detalhe de implementação
  para a interface e não diz ao usuário o que corrigir.

### 10.1 Caso 1
Quando a entrada de `dumps` chega com a forma 1, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `serializador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_serializador.py::test_caso_1`.

### 10.2 Caso 2
Quando a entrada de `dumps` chega com a forma 2, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `serializador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_serializador.py::test_caso_2`.

### 10.3 Caso 3
Quando a entrada de `dumps` chega com a forma 3, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `serializador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_serializador.py::test_caso_3`.

### 10.4 Caso 4
Quando a entrada de `dumps` chega com a forma 4, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `serializador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_serializador.py::test_caso_4`.

### 10.5 Caso 5
Quando a entrada de `dumps` chega com a forma 5, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `serializador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_serializador.py::test_caso_5`.

### 10.6 Caso 6
Quando a entrada de `dumps` chega com a forma 6, o módulo normaliza antes de
calcular. A normalização é separada do cálculo de propósito: misturar as duas
faz um defeito de leitura parecer defeito de aritmética, e foi assim que o
arredondamento de `serializador` passou três releases errado sem ninguém notar.
O teste correspondente é `calc/tests/test_serializador.py::test_caso_6`.
