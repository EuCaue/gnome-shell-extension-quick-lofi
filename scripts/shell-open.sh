#!/usr/bin/env bash
# Opens GNOME <major> in a window with the extension enabled. Close the window to stop.
# GNOME 49 replaced `--nested` (an X11 window) with `--devkit` (a Wayland window).
# `--no-x11` keeps the nested Shell from starting its own Xwayland in the host's /tmp/.X11-unix.
set -euo pipefail
dir="$(dirname "${BASH_SOURCE[0]}")"
source "$dir/shell-session.sh"

v="${1:?usage: shell-open.sh <gnome major>}"
trap session_stop EXIT
(cd "$QL_ROOT" && npm run --silent build:dev >/dev/null)
podman image exists "$(image_for "$v")" || bash "$dir/shell-image.sh" "$v"
work="$QL_OUT/open-$v"
rm -rf "${work:?}"

if ((v >= 49)); then
  session_prepare "$v" "$work" -v "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY:/run/host-wayland"
  session_launch_fg --env=WAYLAND_DISPLAY=/run/host-wayland --env=MUTTER_DEBUG_DUMMY_MODE_SPECS=1280x800 \
    --devkit --wayland --unsafe-mode
else
  session_prepare "$v" "$work" -v /tmp/.X11-unix:/tmp/.X11-unix -v "$XAUTHORITY:/run/host-xauthority:ro"
  session_launch_fg --env=DISPLAY="$DISPLAY" --env=XAUTHORITY=/run/host-xauthority \
    --env=MUTTER_DEBUG_DUMMY_MODE_SPECS=1280x800 \
    --nested --wayland --no-x11 --unsafe-mode
fi
