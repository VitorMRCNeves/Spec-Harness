# CLAUDE.md — calc (variante LAZY do bench)

## Regras invioláveis

- Sempre responda em português (pt-BR)
- Valor monetário é sempre `Decimal`, nunca `float` — arredondamento binário em
  dinheiro é defeito, não detalhe
- Erro de entrada do usuário é `ValueError` com mensagem exibível; nunca deixe
  vazar `InvalidOperation` da stdlib
- Type hints em toda função pública; docstring em português nas de domínio
- Não commite, não crie branch

## Documentação — leia sob demanda

Nenhum destes é carregado automaticamente. Abra o que a tarefa exigir, e só ele.

| Arquivo | Leia quando |
|---------|-------------|
| [`docs/conventions.md`](docs/conventions.md) (0,5 KB) | escrever qualquer código |
| [`docs/commands.md`](docs/commands.md) (0,2 KB) | rodar teste ou lint |
| [`docs/catalogo.md`](docs/catalogo.md) (**31 KB**) | mexer num módulo de `calc/` — vá direto à seção dele, com grep/sed, não leia o arquivo inteiro |
