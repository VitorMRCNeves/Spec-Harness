#!/usr/bin/env bash
# Guarda do plugin Antigravity. O cwd do hook não é confiável; o script se acha por BASH_SOURCE
# e repassa o stdin para a mesma decisão de path do Claude e do Cursor.
set -euo pipefail
root="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
export SPEC_HARNESS_HOOK_HOST=antigravity
exec "$root/engine/hook-guard.sh"
