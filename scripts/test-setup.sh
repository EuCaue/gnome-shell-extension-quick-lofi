#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAKE="$(mktemp -d)"
trap 'rm -rf "$FAKE"' EXIT
FAILS=0
BASH_BIN="$(command -v bash)"

# Isolated PATH: fakes plus only the coreutils the scripts need, so real tools on the host don't leak in.
mkdir "$FAKE/sys"
for u in grep head sort tr; do
  ln -s "$(command -v "$u")" "$FAKE/sys/$u"
done

fake_bin() {
  printf '#!%s\n%s\n' "$BASH_BIN" "$2" >"$FAKE/$1"
  chmod +x "$FAKE/$1"
}

assert_contains() {
  if [[ "$1" != *"$2"* ]]; then
    echo "FAIL: expected '$2' in:"
    echo "$1"
    FAILS=$((FAILS + 1))
  fi
}

run_with_fakes() {
  PATH="$FAKE:$FAKE/sys" "$BASH_BIN" "$@" 2>&1
}

# --- run-session.sh ---
fake_bin dbus-run-session 'echo dbus-run-session "$@"'

fake_bin gnome-shell 'echo "GNOME Shell 48.2"'
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
assert_contains "$out" "--nested --wayland"

fake_bin gnome-shell 'echo "GNOME Shell 50.5"'
fake_bin mutter-devkit 'true'
out=$(QL_DRY_RUN=1 QL_DEVKIT_PATH="$FAKE/mutter-devkit" run_with_fakes "$ROOT/scripts/run-session.sh")
assert_contains "$out" "--devkit --wayland"

rm "$FAKE/mutter-devkit"
out=$(QL_DRY_RUN=1 QL_DEVKIT_PATH="$FAKE/missing" run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "mutter-devkit"
[[ $code -ne 0 ]] || { echo "FAIL: missing devkit should exit non-zero"; FAILS=$((FAILS + 1)); }

fake_bin gnome-shell 'echo "garbage"'
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "Could not detect GNOME Shell version"
[[ $code -ne 0 ]] || { echo "FAIL: bad version should exit non-zero"; FAILS=$((FAILS + 1)); }

rm "$FAKE/gnome-shell"
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "gnome-shell not found"
[[ $code -ne 0 ]] || { echo "FAIL: missing gnome-shell should exit non-zero"; FAILS=$((FAILS + 1)); }

if [[ $FAILS -eq 0 ]]; then echo "All setup tests passed"; else echo "$FAILS failure(s)"; exit 1; fi
