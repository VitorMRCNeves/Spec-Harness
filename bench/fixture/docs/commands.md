# Comandos — calc

```bash
# suíte inteira
pytest -q

# um arquivo
pytest -q calc/tests/test_formatador.py

# lint
ruff check calc/
```

Não há banco, container nem serviço externo: a suíte roda em processo.
