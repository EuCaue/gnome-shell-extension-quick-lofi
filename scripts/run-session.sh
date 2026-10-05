#!/usr/bin/env bash
# Opens a nested GNOME Shell session for testing the extension.
# GNOME 49 replaced `--nested` with `--devkit`, which needs the mutter-devkit binary.
set -euo pipefail

if ! command -v gnome-shell >/dev/null; then
  echo "gnome-shell not found. Run: npm run doctor" >&2
  exit 1
fi

version=$(gnome-shell --version 2>&1) || {
  echo "gnome-shell --version failed: $version" >&2
  exit 1
}
major=$(echo "$version" | grep -oE '[0-9]+' | head -n1 || true)
if [[ -z "$major" ]]; then
  echo "Could not detect GNOME Shell version from: $version" >&2
  exit 1
fi

if ((major >= 49)); then
  # Arch installs libexec binaries under /usr/lib.
  devkit_found=false
  for d in ${QL_DEVKIT_PATH:-/usr/libexec/mutter-devkit /usr/lib/mutter-devkit}; do
    [[ -x "$d" ]] && devkit_found=true
  done
  command -v mutter-devkit >/dev/null && devkit_found=true
  if [[ "$devkit_found" == false ]]; then
    echo "GNOME $major needs mutter-devkit for the nested session." >&2
    echo "Fedora: sudo dnf install mutter-devkit" >&2
    echo "Other distros: install the package that ships mutter-devkit, or run: npm run doctor" >&2
    exit 1
  fi
  mode="--devkit"
else
  mode="--nested"
fi

cmd=(env MUTTER_DEBUG_DUMMY_MODE_SPECS=1600x900 dbus-run-session -- gnome-shell "$mode" --wayland)

if [[ "${QL_DRY_RUN:-}" == 1 ]]; then
  echo "${cmd[@]}"
else
  exec "${cmd[@]}"
fi
