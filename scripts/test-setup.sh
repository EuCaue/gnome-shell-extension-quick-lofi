#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAKE="$(mktemp -d)"
trap 'rm -rf "$FAKE"' EXIT
FAILS=0
BASH_BIN="$(command -v bash)"
REQUIRED=(node npm glib-compile-schemas glib-compile-resources gnome-extensions gnome-shell dbus-run-session mpv)

# Isolated PATH: fakes plus only the coreutils the scripts need, so real tools on the host don't leak in.
mkdir "$FAKE/sys"
for u in dirname grep head sort tr; do
  ln -s "$(command -v "$u")" "$FAKE/sys/$u"
done

fake_bin() {
  printf '#!%s\n%s\n' "$BASH_BIN" "$2" >"$FAKE/$1"
  chmod +x "$FAKE/$1"
}

fake_os_release() {
  printf '%s\n' "$@" >"$FAKE/os-release"
}

assert_contains() {
  if [[ "$1" != *"$2"* ]]; then
    echo "FAIL: expected '$2' in:"
    echo "$1"
    FAILS=$((FAILS + 1))
  fi
}

assert_not_contains() {
  if [[ "$1" == *"$2"* ]]; then
    echo "FAIL: did not expect '$2' in:"
    echo "$1"
    FAILS=$((FAILS + 1))
  fi
}

assert_code() {
  [[ $1 -eq $2 ]] || { echo "FAIL: $3 (exit $1, expected $2)"; FAILS=$((FAILS + 1)); }
}

# Never touches the host's /usr/libexec or /usr/lib unless a test says so.
run_with_fakes() {
  PATH="$FAKE:$FAKE/sys" QL_OSTREE_BOOTED="${QL_OSTREE_BOOTED:-$FAKE/no-ostree}" QL_DEVKIT_PATH="${QL_DEVKIT_PATH:-$FAKE/no-devkit}" "$BASH_BIN" "$@" 2>&1
}

# --- run-session.sh ---
fake_bin dbus-run-session 'echo dbus-run-session "$@"'

fake_bin gnome-shell 'echo "GNOME Shell 48.2"'
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
assert_contains "$out" "--nested --wayland"

fake_bin gnome-shell 'echo "GNOME Shell 50.5"'
fake_bin devkit-at-path 'true'
out=$(QL_DRY_RUN=1 QL_DEVKIT_PATH="$FAKE/devkit-at-path" run_with_fakes "$ROOT/scripts/run-session.sh")
assert_contains "$out" "--devkit --wayland"
rm "$FAKE/devkit-at-path"

fake_bin mutter-devkit 'true'
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
assert_contains "$out" "--devkit --wayland"
rm "$FAKE/mutter-devkit"

out=$(QL_DRY_RUN=1 QL_OS_ID=fedora run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "GNOME 50 needs mutter-devkit"
assert_contains "$out" "sudo dnf install"
assert_contains "$out" "mutter-devkit"
assert_code $code 1 "missing devkit should exit 1"

fake_bin gnome-shell 'echo "GNOME Shell 48.2"'
rm "$FAKE/dbus-run-session"
out=$(QL_DRY_RUN=1 QL_OS_ID=debian run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "dbus-run-session not found"
assert_contains "$out" "sudo apt install"
assert_code $code 1 "missing dbus-run-session should exit 1"
fake_bin dbus-run-session 'echo dbus-run-session "$@"'

fake_bin gnome-shell 'echo "garbage"'
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "could not detect gnome version"
assert_code $code 1 "bad version should exit 1"

fake_bin gnome-shell 'echo "broken lib" >&2; exit 1'
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "gnome-shell --version failed"
assert_code $code 1 "failing --version should exit 1"

rm "$FAKE/gnome-shell"
out=$(QL_DRY_RUN=1 run_with_fakes "$ROOT/scripts/run-session.sh")
code=$?
assert_contains "$out" "gnome-shell not found"
assert_code $code 1 "missing gnome-shell should exit 1"

# --- doctor.sh ---
for c in "${REQUIRED[@]}" jq gsettings; do
  fake_bin "$c" 'true'
done
fake_bin gnome-shell 'echo "GNOME Shell 48.2"'

out=$(QL_OS_ID=fedora run_with_fakes "$ROOT/scripts/doctor.sh")
code=$?
assert_contains "$out" "everything ready"
assert_code $code 0 "doctor should pass when all present on GNOME 48"

rm "$FAKE/glib-compile-resources"
out=$(QL_OS_ID=fedora run_with_fakes "$ROOT/scripts/doctor.sh")
code=$?
assert_contains "$out" "✗ glib-compile-resources"
assert_contains "$out" "sudo dnf install glib2-devel"
assert_code $code 1 "doctor should fail when tool missing"

out=$(QL_OS_ID=ubuntu run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo apt install libglib2.0-dev-bin"

out=$(QL_OS_ID=arch run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo pacman -S glib2"

out=$(QL_OS_ID=opensuse-tumbleweed run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo zypper install glib2-devel"

out=$(QL_OS_ID=somethingelse run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "install them with your package manager"

# Derivatives resolve through ID_LIKE.
fake_os_release 'ID=linuxmint' 'ID_LIKE="ubuntu debian"'
out=$(QL_OS_RELEASE="$FAKE/os-release" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo apt install"

fake_os_release 'ID=manjaro' 'ID_LIKE=arch'
out=$(QL_OS_RELEASE="$FAKE/os-release" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo pacman -S"

fake_os_release 'ID="opensuse-leap"' 'ID_LIKE="suse opensuse"'
out=$(QL_OS_RELEASE="$FAKE/os-release" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo zypper install"

# Falls back to the next os-release file when the first is missing.
out=$(QL_OS_RELEASE="$FAKE/no-os-release $FAKE/os-release" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "sudo zypper install"

# Atomic Fedora (Silverblue, Kinoite) can't use dnf on the host.
touch "$FAKE/ostree-booted"
out=$(QL_OS_ID=fedora QL_OSTREE_BOOTED="$FAKE/ostree-booted" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "rpm-ostree install glib2-devel"

# SLES says ID_LIKE=suse, but openSUSE package names don't apply there.
out=$(QL_OS_ID="sles suse" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "install them with your package manager"

out=$(QL_OS_RELEASE="$FAKE/no-os-release" run_with_fakes "$ROOT/scripts/doctor.sh")
assert_contains "$out" "✗ glib-compile-resources"
assert_contains "$out" "install them with your package manager"
fake_bin glib-compile-resources 'true'

# mutter-devkit is required from GNOME 49.
fake_bin gnome-shell 'echo "GNOME Shell 50.5"'
for os in fedora:mutter-devkit debian:mutter-dev-bin arch:mutter-devkit opensuse-tumbleweed:mutter; do
  out=$(QL_OS_ID="${os%%:*}" run_with_fakes "$ROOT/scripts/doctor.sh")
  code=$?
  assert_contains "$out" "✗ mutter-devkit"
  pm="${os%%:*}"
  case "$pm" in
  fedora) want="sudo dnf install ${os#*:}" ;;
  debian) want="sudo apt install ${os#*:}" ;;
  arch) want="sudo pacman -S ${os#*:}" ;;
  *) want="sudo zypper install ${os#*:}" ;;
  esac
  assert_contains "$out" "$want"
  assert_code $code 1 "doctor should fail without devkit on GNOME 50 (${os%%:*})"
done

fake_bin mutter-devkit 'true'
out=$(QL_OS_ID=fedora run_with_fakes "$ROOT/scripts/doctor.sh")
code=$?
assert_not_contains "$out" "missing"
assert_code $code 0 "doctor should pass with devkit on GNOME 50"
rm "$FAKE/mutter-devkit"

rm "$FAKE/jq"
fake_bin gnome-shell 'echo "GNOME Shell 48.2"'
out=$(QL_OS_ID=fedora run_with_fakes "$ROOT/scripts/doctor.sh")
code=$?
assert_contains "$out" "– jq"
assert_code $code 0 "optional missing should not fail"

if [[ $FAILS -eq 0 ]]; then echo "All setup tests passed"; else echo "$FAILS failure(s)"; exit 1; fi
