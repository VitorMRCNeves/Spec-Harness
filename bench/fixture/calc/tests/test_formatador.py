from decimal import Decimal

from calc.formatador import formatar_brl


def test_formata_milhar():
    assert formatar_brl(Decimal("1234.5")) == "R$ 1.234,50"


def test_formata_negativo():
    assert formatar_brl(Decimal("-7.1")) == "-R$ 7,10"


def test_formata_zero():
    assert formatar_brl(Decimal("0")) == "R$ 0,00"
