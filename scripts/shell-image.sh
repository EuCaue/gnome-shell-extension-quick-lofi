#!/usr/bin/env bash
# Builds one image per GNOME Shell version, in sequence to keep RAM low.
# Usage: shell-image.sh [major...]   |   shell-image.sh --clean
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/shell-lib.sh"

if [[ "${1:-}" == --clean ]]; then
  podman images --format '{{.Repository}}:{{.Tag}}' | grep '^localhost/quick-lofi-shell:' | xargs -r podman rmi -f
  exit 0
fi

for v in $(versions_from_args "$@"); do
  fedora=$(fedora_for "$v") || { echo "unknown GNOME version: $v" >&2; exit 1; }
  echo "building GNOME $v (Fedora $fedora)…"
  nice -n 10 podman build --memory=3g --cpu-quota=200000 \
    --build-arg "FEDORA=$fedora" -t "$(image_for "$v")" -f "$QL_ROOT/tests/shell/Containerfile" "$QL_ROOT/tests/shell"
  podman run --rm "$(image_for "$v")" gnome-shell --version
done
