#!/usr/bin/env bash
# Guarda do hook PreToolUse do SDD Spec Harness.
#
# O hook-check em si custa ~370ms (node + type stripping do harness.ts) e só tem o que fazer
# quando existe uma execução de spec ativa. Sem esta guarda, toda tool call de toda sessão do
# repositório pagaria esse tempo para descobrir que não há nada a checar.
#
# Repassa o payload do hook (stdin) intacto para o harness quando há execução ativa.
set -euo pipefail
shopt -s nullglob

harness_home="${SPEC_HARNESS_HOME:-/tmp/spec_harness}"
export SPEC_HARNESS_HOOK_HOST="${SPEC_HARNESS_HOOK_HOST:-claude}"
host="$SPEC_HARNESS_HOOK_HOST"
ativos=("$harness_home"/active/*.json)
if (( ${#ativos[@]} == 0 )); then
  if [[ "$host" == "cursor" ]]; then
    printf '%s\n' '{"permission":"allow"}'
  elif [[ "$host" == "antigravity" ]]; then
    printf '%s\n' '{"decision":"allow"}'
  fi
  exit 0
fi

exec node "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/harness.ts" hook-check
