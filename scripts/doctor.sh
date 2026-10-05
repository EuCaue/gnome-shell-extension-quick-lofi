#!/usr/bin/env bash
# Checks the system tools needed to build and run the extension.
set -euo pipefail

os_id="${QL_OS_ID:-$(. /etc/os-release 2>/dev/null && echo "${ID:-}")}"

declare -A fedora=(
  [node]=nodejs [npm]=npm [glib-compile-schemas]=glib2-devel [glib-compile-resources]=glib2-devel
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus-daemon [mpv]=mpv
)
declare -A debian=(
  [node]=nodejs [npm]=npm [glib-compile-schemas]=libglib2.0-dev-bin [glib-compile-resources]=libglib2.0-dev-bin
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus [mpv]=mpv
)
declare -A arch=(
  [node]=nodejs [npm]=npm [glib-compile-schemas]=glib2 [glib-compile-resources]=glib2
  [gnome-extensions]=gnome-shell [gnome-shell]=gnome-shell [dbus-run-session]=dbus [mpv]=mpv
)

pm=""
case "$os_id" in
  fedora) pm="sudo dnf install"; declare -n pkgs=fedora ;;
  debian | ubuntu) pm="sudo apt install"; declare -n pkgs=debian ;;
  arch) pm="sudo pacman -S"; declare -n pkgs=arch ;;
esac

missing=()
for c in node npm glib-compile-schemas glib-compile-resources gnome-extensions gnome-shell dbus-run-session mpv; do
  command -v "$c" >/dev/null || { echo "missing: $c"; missing+=("$c"); }
done
for c in jq gsettings; do
  command -v "$c" >/dev/null || echo "optional: $c (only for npm run radios)"
done

if ((${#missing[@]} == 0)); then
  echo "All required tools found"
  exit 0
fi

if [[ -n "$pm" ]]; then
  to_install=$(for c in "${missing[@]}"; do echo "${pkgs[$c]}"; done | sort -u | tr '\n' ' ')
  echo "Run: $pm $to_install"
else
  echo "Install the missing tools with your package manager."
fi
exit 1
