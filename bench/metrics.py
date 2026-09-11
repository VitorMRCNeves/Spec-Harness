#!/usr/bin/env python3
"""Coleta e compara execuções do bench do spec-harness.

Duas fontes, porque nenhuma sozinha responde a pergunta:

- `$SPEC_HARNESS_HOME/metrics.jsonl` e as evidências dos packets dizem o que o HARNESS fez:
  quantas avaliações de gate, quais reprovaram, o que o gate de CRAP mediu.
- Os transcripts das sessões headless (`~/.claude/projects/<slug-do-worktree>/*.jsonl`) dizem o
  que a SESSÃO DO MODELO custou: turnos, tokens por tipo, tamanho do contexto e em que
  ferramentas os turnos foram gastos.

O custo de uma sessão é `contexto x turnos`, não o tamanho do que ela produziu — por isso o
relatório traz contexto médio e turnos separados, e não só o total de tokens: dois totais iguais
com turnos diferentes são problemas diferentes.

Uso:
    metrics.py coletar --home DIR --worktree DIR --desde TS --ate TS --rotulo TXT [--extra k=v ...]
    metrics.py comparar BASE.json NOVO.json
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import pathlib
import re
import sys
from collections import Counter

# ------------------------------------------------------------------ transcripts das sessões


def slug_do_worktree(worktree: str) -> str:
    """`/tmp/spec_harness/worktrees/bench-01` -> `-tmp-spec-harness-worktrees-bench-01`."""
    return re.sub(r"[^a-zA-Z0-9]", "-", os.path.abspath(worktree))


def sessoes(worktree: str, desde: float, ate: float) -> list[pathlib.Path]:
    """Transcripts do worktree escritos dentro da janela desta execução.

    A janela importa: o diretório do projeto sobrevive entre execuções, e sem o filtro por mtime
    a segunda medição somaria os turnos da primeira e mostraria uma piora que não aconteceu.
    """
    base = pathlib.Path.home() / ".claude" / "projects" / slug_do_worktree(worktree)
    if not base.is_dir():
        return []
    return sorted(p for p in base.glob("*.jsonl") if desde <= p.stat().st_mtime <= ate + 300)


def mede_sessao(caminho: pathlib.Path) -> dict:
    uso = Counter()
    ferramentas = Counter()
    contextos: list[int] = []
    turnos = 0
    instantes: list[str] = []

    for linha in caminho.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            d = json.loads(linha)
        except json.JSONDecodeError:
            continue
        msg = d.get("message") or {}
        if ts := d.get("timestamp"):
            instantes.append(ts)

        if u := msg.get("usage"):
            for chave in ("input_tokens", "cache_read_input_tokens",
                          "cache_creation_input_tokens", "output_tokens"):
                uso[chave] += u.get(chave, 0)
            contextos.append(
                u.get("input_tokens", 0)
                + u.get("cache_read_input_tokens", 0)
                + u.get("cache_creation_input_tokens", 0)
            )

        if d.get("type") == "assistant":
            turnos += 1
            conteudo = msg.get("content")
            if isinstance(conteudo, list):
                for bloco in conteudo:
                    if bloco.get("type") == "tool_use":
                        ferramentas[bloco.get("name", "?")] += 1
                    elif bloco.get("type") == "text" and bloco.get("text", "").strip():
                        ferramentas["<texto>"] += 1

    total = sum(uso.values())
    # Cota = o que a assinatura debita. cache_read fica de fora de propósito.
    cota = (uso["input_tokens"] + uso["cache_creation_input_tokens"] + uso["output_tokens"])
    return {
        "arquivo": caminho.name,
        "turnos": turnos,
        "cota": cota,
        "tokens": {**uso, "total": total},
        "contexto": {
            "primeiro": contextos[0] if contextos else 0,
            "ultimo": contextos[-1] if contextos else 0,
            "maximo": max(contextos) if contextos else 0,
            "medio": round(sum(contextos) / len(contextos)) if contextos else 0,
        },
        "ferramentas": dict(ferramentas.most_common()),
        "inicio": min(instantes) if instantes else None,
        "fim": max(instantes) if instantes else None,
    }


# ------------------------------------------------------------------ lado do harness


def gates(home: str, desde: float, ate: float) -> dict:
    caminho = pathlib.Path(home) / "metrics.jsonl"
    if not caminho.exists():
        return {"avaliacoes": 0, "reprovadas": 0, "por_fase": {}}
    por_fase: dict[str, dict] = {}
    total = reprovadas = 0
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        try:
            d = json.loads(linha)
        except json.JSONDecodeError:
            continue
        if not (desde <= d.get("ts", 0) <= ate + 300):
            continue
        fase = d.get("phase", "?")
        alvo = por_fase.setdefault(fase, {"avaliacoes": 0, "reprovadas": 0})
        alvo["avaliacoes"] += 1
        total += 1
        if not d.get("gates_ok"):
            alvo["reprovadas"] += 1
            reprovadas += 1
    return {"avaliacoes": total, "reprovadas": reprovadas, "por_fase": por_fase}


def qualidade(repo: str) -> dict:
    """Nota de qualidade da fase VERIFY, lida da evidência do packet.

    Sem isto o bench mediria só custo, e ficaria fácil 'melhorar' o harness entregando código
    pior em menos turnos. Os nomes dos campos seguem o que o harness GRAVA: o resumo na
    evidência traz `violations` / `high_risk` / `average_crap`, e o detalhe por função vive no
    relatório apontado por `crap.report`. Ler chave que o motor não produz é pior que não medir,
    porque devolve None e parece reprovação.
    """
    ev = sorted(glob.glob(os.path.join(repo, ".specs", "*", "packets", ".expanded", "*-verify.evidence.json")))
    if not ev:
        return {"disponivel": False, "motivo": "nenhuma evidência de fase VERIFY encontrada"}
    d = json.loads(pathlib.Path(ev[-1]).read_text(encoding="utf-8"))
    crap = d.get("crap") or {}

    # O veredito do gate é a ausência de violação E de erro de medição — o gate é fail-closed,
    # então medição inválida conta como reprovação, não como silêncio.
    if crap:
        violacoes = crap.get("violations") or []
        erros_crap = crap.get("errors") or []
        crap_ok = not violacoes and not erros_crap
    else:
        violacoes, erros_crap, crap_ok = [], [], None

    # Detalhe por função: só o relatório tem, e ele é o que permite ver se o pior caso piorou.
    piores = []
    rel = crap.get("report")
    if rel:
        caminho = pathlib.Path(rel if os.path.isabs(rel) else os.path.join(repo, rel))
        if caminho.exists():
            try:
                r = json.loads(caminho.read_text(encoding="utf-8"))
                piores = sorted(
                    ({"file": f.get("file"), "name": f.get("name"), "crap": f.get("crap"),
                      "comp": f.get("comp"), "cov": f.get("cov"), "branch_cov": f.get("branch_cov"),
                      "new": f.get("new")} for f in (r.get("functions") or [])),
                    key=lambda f: (f.get("crap") or 0), reverse=True,
                )[:5]
            except json.JSONDecodeError:
                piores = []

    return {
        "disponivel": True,
        "status": d.get("status"),
        "erros_da_fase": d.get("errors") or [],
        "crap_ok": crap_ok,
        "crap_violacoes": len(violacoes),
        "crap_erros_medicao": len(erros_crap),
        "crap_medio": crap.get("average_crap"),
        "crap_pior": piores[0]["crap"] if piores else None,
        "crap_funcoes": crap.get("total_functions"),
        "crap_top": piores,
        "validacoes": [
            {"id": v.get("id"), "returncode": v.get("returncode")}
            for v in (d.get("validation_results") or [])
        ],
    }


# ------------------------------------------------------------------ comandos


def cmd_coletar(a: argparse.Namespace) -> None:
    medidas = [mede_sessao(p) for p in sessoes(a.worktree, a.desde, a.ate)]
    somas = Counter()
    for m in medidas:
        for k, v in m["tokens"].items():
            somas[k] += v
    turnos = sum(m["turnos"] for m in medidas)
    ferramentas = Counter()
    for m in medidas:
        ferramentas.update(m["ferramentas"])
    ctx_medio = round(somas["total"] / turnos) if turnos else 0

    cota = somas["input_tokens"] + somas["cache_creation_input_tokens"] + somas["output_tokens"]
    registro = {
        "rotulo": a.rotulo,
        "cota": cota,
        "config": dict(kv.split("=", 1) for kv in (a.extra or [])),
        "segundos": round(a.ate - a.desde, 1),
        "sessoes": len(medidas),
        "turnos": turnos,
        "tokens": dict(somas),
        "contexto_medio_por_turno": ctx_medio,
        "ferramentas": dict(ferramentas.most_common()),
        "gates": gates(a.home, a.desde, a.ate),
        "qualidade": qualidade(a.repo) if a.repo else {"disponivel": False},
        "por_sessao": medidas,
    }
    saida = json.dumps(registro, indent=2, ensure_ascii=False)
    if a.saida:
        pathlib.Path(a.saida).write_text(saida + "\n", encoding="utf-8")
        print(f"registro gravado em {a.saida}")
    resumo(registro)


def resumo(r: dict) -> None:
    t = r["tokens"]
    print(f"\n  rótulo ............... {r['rotulo']}  {r['config'] or ''}")
    print(f"  tempo de parede ...... {r['segundos']}s")
    print(f"  sessões / turnos ..... {r['sessoes']} / {r['turnos']}")
    print(f"  COTA (o que conta) ... {r.get('cota', 0):,}   = cache_write + output + input")
    print(f"    cache_write ........ {t.get('cache_creation_input_tokens', 0):,}")
    print(f"    output ............. {t.get('output_tokens', 0):,}")
    print(f"    input fresco ....... {t.get('input_tokens', 0):,}")
    print(f"  contexto reenviado ... {t.get('cache_read_input_tokens', 0):,}   (cache_read: NÃO conta na cota)")
    print(f"  tokens somados ....... {t.get('total', 0):,}   (número enganoso — não otimize por ele)")
    print(f"  contexto médio/turno . {r['contexto_medio_por_turno']:,}")
    g = r["gates"]
    print(f"  gates ................ {g['avaliacoes']} avaliações, {g['reprovadas']} reprovadas")
    q = r["qualidade"]
    if q.get("disponivel"):
        print(f"  qualidade ............ status={q.get('status')}  crap_ok={q.get('crap_ok')}  "
              f"violações={q.get('crap_violacoes')}  pior_crap={q.get('crap_pior')}  "
              f"médio={q.get('crap_medio')}  funções={q.get('crap_funcoes')}")
    else:
        print(f"  qualidade ............ INDISPONÍVEL ({q.get('motivo', 'sem motivo registrado')})")
    print(f"  ferramentas .......... {r['ferramentas']}")


def _delta(base: float, novo: float) -> str:
    if not base:
        return f"{novo:>12,.0f}  (base 0)"
    pct = (novo - base) / base * 100
    return f"{novo:>12,.0f}  {pct:+6.1f}%"


def cmd_comparar(a: argparse.Namespace) -> None:
    b = json.loads(pathlib.Path(a.base).read_text(encoding="utf-8"))
    n = json.loads(pathlib.Path(a.novo).read_text(encoding="utf-8"))
    print(f"\nbase: {b['rotulo']} {b['config'] or ''}")
    print(f"novo: {n['rotulo']} {n['config'] or ''}\n")
    linhas = [
        ("COTA", b.get("cota", 0), n.get("cota", 0)),
        ("  cache_write", b["tokens"].get("cache_creation_input_tokens", 0), n["tokens"].get("cache_creation_input_tokens", 0)),
        ("  output", b["tokens"].get("output_tokens", 0), n["tokens"].get("output_tokens", 0)),
        ("sessões (frias)", b["sessoes"], n["sessoes"]),
        ("tempo (s)", b["segundos"], n["segundos"]),
        ("turnos", b["turnos"], n["turnos"]),
        ("contexto reenviado", b["tokens"].get("cache_read_input_tokens", 0), n["tokens"].get("cache_read_input_tokens", 0)),
        ("contexto médio/turno", b["contexto_medio_por_turno"], n["contexto_medio_por_turno"]),
        ("gates reprovados", b["gates"]["reprovadas"], n["gates"]["reprovadas"]),
    ]
    print(f"{'métrica':<24}{'base':>12}{'novo':>14}")
    for nome, vb, vn in linhas:
        print(f"{nome:<24}{vb:>12,.0f}  {_delta(vb, vn)}")

    qb, qn = b["qualidade"], n["qualidade"]
    print("\nqualidade (não pode piorar para a economia valer):")
    # Dado ausente não é reprovação, e tratar um como o outro já produziu alarme falso numa
    # execução em que os dois lados passaram 3/3. Os três estados são distintos: passou,
    # reprovou e não foi medido — e "não foi medido" invalida a comparação sem acusar o código.
    if not (qb.get("disponivel") and qn.get("disponivel")):
        faltando = [r for r, q in (("base", qb), ("novo", qn)) if not q.get("disponivel")]
        print(f"  INCONCLUSIVO: sem evidência da fase VERIFY em {', '.join(faltando)}.")
        print("  A economia não é comparável — não é sinal de que o código piorou.")
    else:
        print(f"  status      base={qb.get('status')}   novo={qn.get('status')}")
        print(f"  crap_ok     base={qb.get('crap_ok')}   novo={qn.get('crap_ok')}")
        print(f"  violações   base={qb.get('crap_violacoes')}   novo={qn.get('crap_violacoes')}")
        print(f"  pior CRAP   base={qb.get('crap_pior')}   novo={qn.get('crap_pior')}")
        print(f"  CRAP médio  base={qb.get('crap_medio')}   novo={qn.get('crap_medio')}")
        if qn.get("status") != "ready_for_review":
            print("\n  ATENÇÃO: a execução nova não chegou a ready_for_review — a economia não é comparável.")
        elif qn.get("crap_ok") is False:
            print(f"\n  ATENÇÃO: o gate de CRAP reprovou a execução nova "
                  f"({qn.get('crap_violacoes')} violação(ões), {qn.get('crap_erros_medicao')} erro(s) de medição).")
        elif (qn.get("crap_pior") or 0) > (qb.get("crap_pior") or 0):
            print(f"\n  ATENÇÃO: o pior CRAP piorou ({qb.get('crap_pior')} -> {qn.get('crap_pior')}) — "
                  f"passou no gate, mas a economia veio com código mais arriscado.")

    gb, gn = b["gates"], n["gates"]
    if gn["reprovadas"] > gb["reprovadas"]:
        print(f"\n  ATENÇÃO: gates reprovados subiram ({gb['reprovadas']} -> {gn['reprovadas']}).")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("coletar")
    c.add_argument("--home", required=True)
    c.add_argument("--worktree", required=True)
    c.add_argument("--repo", default="")
    c.add_argument("--desde", type=float, required=True)
    c.add_argument("--ate", type=float, required=True)
    c.add_argument("--rotulo", required=True)
    c.add_argument("--extra", nargs="*", default=[])
    c.add_argument("--saida", default="")
    c.set_defaults(func=cmd_coletar)

    k = sub.add_parser("comparar")
    k.add_argument("base")
    k.add_argument("novo")
    k.set_defaults(func=cmd_comparar)

    a = p.parse_args()
    a.func(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
