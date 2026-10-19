#!/usr/bin/env bash
# Builds one image per GNOME Shell version, in sequence to keep RAM low.
# Usage: shell-image.sh [major...]   |   shell-image.sh --clean
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/shell-lib.sh"

if [[ "${1:-}" == --clean ]]; then
  "$QL_ENGINE" images --format '{{.Repository}}:{{.Tag}}' | grep '^localhost/quick-lofi-shell:' | xargs -r "$QL_ENGINE" rmi -f
  exit 0
fi

for v in $(versions_from_args "$@"); do
  fedora=$(fedora_for "$v") || { echo "unknown GNOME version: $v" >&2; exit 1; }
  echo "building GNOME $v (Fedora $fedora)…"
  # docker's BuildKit rejects build-time memory and CPU limits
  limits=()
  [[ "$QL_ENGINE" == podman ]] && limits=(--memory=3g --cpu-quota=200000)
  nice -n 10 "$QL_ENGINE" build "${limits[@]}" \
    --build-arg "FEDORA=$fedora" -t "$(image_for "$v")" -f "$QL_ROOT/tests/shell/Containerfile" "$QL_ROOT/tests/shell"
  "$QL_ENGINE" run --rm "$(image_for "$v")" gnome-shell --version
done
