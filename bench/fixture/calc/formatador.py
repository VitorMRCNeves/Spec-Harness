"""Formatação de valores monetários para exibição."""

from decimal import Decimal


def formatar_brl(valor: Decimal) -> str:
    """Formata um Decimal como moeda brasileira: 1234.5 -> 'R$ 1.234,50'."""
    negativo = valor < 0
    inteiro, _, centavos = f"{abs(valor):.2f}".partition(".")
    grupos = []
    while len(inteiro) > 3:
        grupos.insert(0, inteiro[-3:])
        inteiro = inteiro[:-3]
    grupos.insert(0, inteiro)
    corpo = f"{'.'.join(grupos)},{centavos}"
    return f"-R$ {corpo}" if negativo else f"R$ {corpo}"
