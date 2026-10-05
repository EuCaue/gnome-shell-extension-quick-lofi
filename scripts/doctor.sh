#!/usr/bin/env bash
# Checks the system tools needed to build and run the extension.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# ID first, then ID_LIKE, so derivatives (Mint, Manjaro, Leap) resolve to their base.
os_ids="${QL_OS_ID:-$(. "${QL_OS_RELEASE:-/etc/os-release}" 2>/dev/null && echo "${ID:-} ${ID_LIKE:-}" || true)}"

declare -A fedora=(
  [node]=nodejs [npm]=npm [glib-compile-schemas]=glib2-devel [glib-compile-resources]=glib2-devel
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus-daemon [mpv]=mpv
  [mutter-devkit]=mutter-devkit
)
declare -A debian=(
  [node]=nodejs [npm]=npm [glib-compile-schemas]=libglib2.0-dev-bin [glib-compile-resources]=libglib2.0-dev-bin
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus [mpv]=mpv
  [mutter-devkit]=mutter-dev-bin
)
declare -A arch=(
  [node]=nodejs [npm]=npm [glib-compile-schemas]=glib2 [glib-compile-resources]=glib2
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus [mpv]=mpv
  [mutter-devkit]=mutter-devkit
)
declare -A opensuse=(
  [node]=nodejs-default [npm]=npm-default [glib-compile-schemas]=glib2-tools [glib-compile-resources]=glib2-devel
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus-1-daemon [mpv]=mpv
  [mutter-devkit]=mutter
)

pm=""
for id in $os_ids; do
  case "$id" in
    fedora) pm="sudo dnf install"; declare -n pkgs=fedora ;;
    debian | ubuntu) pm="sudo apt install"; declare -n pkgs=debian ;;
    arch) pm="sudo pacman -S"; declare -n pkgs=arch ;;
    opensuse* | suse) pm="sudo zypper install"; declare -n pkgs=opensuse ;;
    *) continue ;;
  esac
  break
done

missing=()
for c in node npm glib-compile-schemas glib-compile-resources gnome-extensions gnome-shell dbus-run-session mpv; do
  command -v "$c" >/dev/null || { echo "missing: $c"; missing+=("$c"); }
done

# GNOME 49 replaced `gnome-shell --nested` with `--devkit`, used by npm run run:dev.
major=$(gnome_major)
if [[ -n "$major" ]] && ((major >= 49)) && ! has_devkit; then
  echo "missing: mutter-devkit (needed by npm run run:dev on GNOME $major)"
  missing+=(mutter-devkit)
fi

for c in jq gsettings; do
  command -v "$c" >/dev/null || echo "optional: $c (only for npm run radios)"
done

if ((${#missing[@]} == 0)); then
  echo "All required tools found"
  exit 0
fi

if [[ -n "$pm" ]]; then
  to_install=$(for c in "${missing[@]}"; do echo "${pkgs[$c]}"; done | sort -u | tr '\n' ' ')
  echo "Run: $pm ${to_install% }"
else
  echo "Install the missing tools with your package manager."
fi
exit 1
