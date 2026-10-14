#!/usr/bin/env bash
# Opens a nested GNOME Shell session for testing the extension.
# GNOME 49 replaced `--nested` with `--devkit`, which needs the mutter-devkit binary.
set -euo pipefail
dir="$(dirname "${BASH_SOURCE[0]}")"
source "$dir/lib.sh"

# Prints the reason on one line, then doctor's checklist with the install command.
fail() {
  printf '\n  %b %s\n' "$SYM_NO" "$1" >&2
  "$BASH" "$dir/doctor.sh" >&2 || true
  exit 1
}

command -v gnome-shell >/dev/null || fail "gnome-shell not found."

version=$(gnome-shell --version 2>&1) || {
  printf '  %b gnome-shell --version failed:\n    %s\n' "$SYM_NO" "$version" >&2
  exit 1
}
major=$(gnome_major)
if [[ -z "$major" ]]; then
  printf '  %b could not detect gnome version from "%s"\n' "$SYM_NO" "$version" >&2
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
  printf '  %b starting nested session on gnome %s (%s)…\n' "$SYM_OPT" "$major" "$mode"
  exec "${cmd[@]}"
fi
