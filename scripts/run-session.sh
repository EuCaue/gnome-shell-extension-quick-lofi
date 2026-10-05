#!/usr/bin/env bash
# Opens a nested GNOME Shell session for testing the extension.
# GNOME 49 replaced `--nested` with `--devkit`, which needs the mutter-devkit binary.
set -euo pipefail
dir="$(dirname "${BASH_SOURCE[0]}")"
source "$dir/lib.sh"

# Prints the reason, then doctor's install command for this distro.
fail() {
  echo "$1" >&2
  "$BASH" "$dir/doctor.sh" >&2 || true
  exit 1
}

command -v gnome-shell >/dev/null || fail "gnome-shell not found."

version=$(gnome-shell --version 2>&1) || {
  echo "gnome-shell --version failed: $version" >&2
  exit 1
}
major=$(gnome_major)
if [[ -z "$major" ]]; then
  echo "Could not detect GNOME Shell version from: $version" >&2
  exit 1
fi

command -v dbus-run-session >/dev/null || fail "dbus-run-session not found."

if ((major >= 49)); then
  has_devkit || fail "GNOME $major needs mutter-devkit for the nested session."
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
