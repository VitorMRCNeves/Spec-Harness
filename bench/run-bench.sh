#!/usr/bin/env bash
# Execução medida do spec-harness contra um repositório-fixture fixo.
#
# A variável do experimento é o HARNESS (ou a configuração dele); o workload é constante. Por isso
# o fixture é materializado do zero a cada execução, num diretório temporário próprio, com
# SPEC_HARNESS_HOME próprio: nada é herdado da execução anterior nem do trabalho real da máquina.
#
#   ./run-bench.sh --dry --rotulo teste          # valida sem gastar sessão
#   ./run-bench.sh --rotulo antes  --docs eager --allowlist off
#   ./run-bench.sh --rotulo depois --docs lazy  --allowlist on
#   ./metrics.py comparar runs/antes.json runs/depois.json
set -euo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROTULO=""; DOCS="lazy"; ALLOWLIST="on"; MANTER=0; DRY=0; SESSAO="retomada"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotulo)    ROTULO="$2"; shift 2 ;;
    --docs)      DOCS="$2"; shift 2 ;;       # eager | lazy
    --allowlist) ALLOWLIST="$2"; shift 2 ;;  # on | off
    --sessao)    SESSAO="$2"; shift 2 ;;     # retomada | fria
    --manter)    MANTER=1; shift ;;          # não apaga o sandbox no fim
    --dry)       DRY=1; shift ;;             # valida a canalização sem gastar sessão de modelo
    -h|--help)   sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$ROTULO" ]] || { echo "uso: run-bench.sh --rotulo NOME [--docs eager|lazy] [--allowlist on|off]" >&2; exit 2; }
[[ "$DOCS" == "eager" || "$DOCS" == "lazy" ]] || { echo "--docs: eager|lazy" >&2; exit 2; }
[[ "$ALLOWLIST" == "on" || "$ALLOWLIST" == "off" ]] || { echo "--allowlist: on|off" >&2; exit 2; }
[[ "$SESSAO" == "retomada" || "$SESSAO" == "fria" ]] || { echo "--sessao: retomada|fria" >&2; exit 2; }

HARNESS="${SPEC_HARNESS_TS:-$HOME/.claude/spec_harness/harness.ts}"
[[ -f "$HARNESS" ]] || { echo "motor não encontrado: $HARNESS (defina SPEC_HARNESS_TS)" >&2; exit 1; }
command -v pytest >/dev/null || { echo "pytest não está no PATH" >&2; exit 1; }
command -v ruff   >/dev/null || { echo "ruff não está no PATH" >&2; exit 1; }

SANDBOX="$(mktemp -d "/tmp/spec-harness-bench-${ROTULO}-XXXX")"
export SPEC_HARNESS_HOME="$SANDBOX/home"
REPO="$SANDBOX/repo"
mkdir -p "$SPEC_HARNESS_HOME" "$REPO"

cp -r "$BENCH_DIR/fixture/." "$REPO/"

# O CLAUDE.md do fixture existe em duas variantes; a execução escolhe uma. É este o knob que mede
# o efeito de trocar `@import` eager por ponteiro lido sob demanda.
mv "$REPO/CLAUDE.$DOCS.md" "$REPO/CLAUDE.md"
rm -f "$REPO"/CLAUDE.*.md

if [[ "$ALLOWLIST" == "off" ]]; then
  python3 - "$REPO/.claude/spec_harness/harness.config.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d.pop("docs", None)   # sem a chave o motor não injeta bloco nenhum — é o comportamento antigo
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
PY
fi

# `fria` reproduz o comportamento anterior: uma sessão headless por FASE, cada uma pagando o piso
# de contexto de novo. É a base contra a qual a retomada é medida.
if [[ "$SESSAO" == "fria" ]]; then
  python3 - "$REPO/.claude/spec_harness/harness.config.json" <<'PY2'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d["implementer"]["reuse_session"] = False
d["implementer"]["lean_context"] = False
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
PY2
fi

# O worktree da spec nasce da BRANCH: tudo que a fase precisa tem de estar commitado, inclusive o
# perfil do harness. Foi exatamente esta pegadinha que custou 67 turnos numa spec real.
git -C "$REPO" init -q -b main
git -C "$REPO" config user.email bench@local
git -C "$REPO" config user.name  bench
git -C "$REPO" add -A
git -C "$REPO" commit -qm "fixture do bench do spec-harness"

echo "=== bench '$ROTULO'  docs=$DOCS  allowlist=$ALLOWLIST ==="
echo "repo:    $REPO"
echo "home:    $SPEC_HARNESS_HOME"

cd "$REPO"
node "$HARNESS" doctor || { echo "doctor reprovou o fixture — aborta antes de gastar sessão" >&2; exit 1; }

DESDE="$(date +%s)"
if [[ $DRY -eq 1 ]]; then
  # Tudo menos o autorun: prova que o fixture expande, que os gates encontram o que precisam e que
  # a coleta roda — sem acender as duas sessões de Sonnet, que são o item caro.
  echo "--- MODO DRY: expande o packet e para antes do autorun ---"
  node "$HARNESS" expand-packet .specs/sdd-bench/packets/SDD-01.yaml
  pytest -q -p no:cacheprovider calc
  ruff check calc/
  CODIGO=0
else
  set +e
  node "$HARNESS" autorun .specs/sdd-bench/packets/SDD-01.yaml --no-merge 2>&1 | tee "$SANDBOX/autorun.log"
  CODIGO=${PIPESTATUS[0]}
  set -e
fi
ATE="$(date +%s)"

WORKTREE="$SPEC_HARNESS_HOME/worktrees/bench-01"
mkdir -p "$BENCH_DIR/runs"
SAIDA="$BENCH_DIR/runs/$ROTULO.json"
[[ $DRY -eq 1 ]] && SAIDA="$SANDBOX/dry.json"

python3 "$BENCH_DIR/metrics.py" coletar \
  --home "$SPEC_HARNESS_HOME" --worktree "$WORKTREE" --repo "$WORKTREE" \
  --desde "$DESDE" --ate "$ATE" --rotulo "$ROTULO" \
  --extra "docs=$DOCS" "allowlist=$ALLOWLIST" "autorun_exit=$CODIGO" \
  --saida "$SAIDA"

if [[ $MANTER -eq 1 ]]; then
  echo "sandbox preservado: $SANDBOX"
else
  git -C "$REPO" worktree prune 2>/dev/null || true
  rm -rf "$SANDBOX"
fi
echo "autorun saiu com $CODIGO"
exit "$CODIGO"
