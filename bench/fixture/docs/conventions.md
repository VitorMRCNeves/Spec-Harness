# Convenções de código — calc

- Python 3.11+, type hints em toda função pública
- Strings com aspas duplas
- Docstring em português nas funções de domínio
- Valor monetário é sempre `Decimal`, nunca `float` — arredondamento binário
  em dinheiro é defeito, não detalhe
- Erro de entrada do usuário é `ValueError` com mensagem exibível; nunca deixe
  vazar `InvalidOperation` da stdlib
- Um arquivo por responsabilidade em `calc/`; os testes espelham em `calc/tests/`
