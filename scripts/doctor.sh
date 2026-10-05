#!/usr/bin/env bash
# Checks the system tools needed to build and run the extension.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# ID first, then ID_LIKE, so derivatives (Mint, Manjaro, Leap) resolve to their base.
# /usr/lib/os-release is the fallback some containers ship instead of /etc.
os_release=""
for f in ${QL_OS_RELEASE:-/etc/os-release /usr/lib/os-release}; do
  [[ -r "$f" ]] && { os_release="$f"; break; }
done
os_ids="${QL_OS_ID:-$([[ -n "$os_release" ]] && . "$os_release" 2>/dev/null && echo "${ID:-} ${ID_LIKE:-}" || true)}"

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
    fedora)
      # Atomic variants (Silverblue, Kinoite) layer packages with rpm-ostree.
      if [[ -e "${QL_OSTREE_BOOTED:-/run/ostree-booted}" ]]; then pm="rpm-ostree install"; else pm="sudo dnf install"; fi
      declare -n pkgs=fedora
      ;;
    debian | ubuntu) pm="sudo apt install"; declare -n pkgs=debian ;;
    arch) pm="sudo pacman -S"; declare -n pkgs=arch ;;
    opensuse*) pm="sudo zypper install"; declare -n pkgs=opensuse ;;
    *) continue ;;
  esac
  break
done

missing=()
row_missing() {
  row "$SYM_NO" "$1" "${RED}not found${RESET}"
  missing+=("$1")
}

for c in node npm glib-compile-schemas glib-compile-resources gnome-extensions dbus-run-session mpv; do
  command -v "$c" >/dev/null && row "$SYM_OK" "$c" || row_missing "$c"
done

# GNOME 49 replaced `gnome-shell --nested` with `--devkit`, used by npm run run:dev.
major=$(gnome_major)
if command -v gnome-shell >/dev/null; then
  if [[ -n "$major" ]]; then
    row "$SYM_OK" gnome-shell "${DIM}gnome $major${RESET}"
  else
    row "$SYM_NO" gnome-shell "${RED}could not read version${RESET}"
    missing+=(gnome-shell)
  fi
else
  row_missing gnome-shell
fi
if [[ -n "$major" ]] && ((major >= 49)); then
  if has_devkit; then
    row "$SYM_OK" mutter-devkit
  else
    row "$SYM_NO" mutter-devkit "${RED}required on gnome ≥ 49${RESET}"
    missing+=(mutter-devkit)
  fi
fi

for c in jq gsettings; do
  command -v "$c" >/dev/null || row "$SYM_OPT" "$c" "${DIM}optional — only for bun run radios${RESET}"
done

if ((${#missing[@]} == 0)); then
  printf '\n  %b everything ready — run it with %b\n' "$SYM_OK" "${BOLD}bun run run:dev${RESET}"
  exit 0
fi

printf '\n  %b %d missing — install with:\n' "$SYM_NO" "${#missing[@]}"
if [[ -n "$pm" ]]; then
  to_install=$(for c in "${missing[@]}"; do echo "${pkgs[$c]}"; done | sort -u)
  printf '    %s\n' "${pm} ${to_install// / }"
else
  printf '    install them with your package manager.\n'
fi
exit 1
