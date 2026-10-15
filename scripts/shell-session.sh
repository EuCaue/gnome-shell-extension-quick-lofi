# Starts a GNOME Shell in a container and drives it over D-Bus. Source, don't run.
source "$(dirname "${BASH_SOURCE[0]}")/shell-lib.sh"

CID='' WORK=''
CAPS='SYS_ADMIN,SYS_NICE,SYS_PTRACE,SETPCAP,NET_RAW,NET_BIND_SERVICE,IPC_LOCK'

session_env() {
  printf '%s\n' \
    "HOME=$WORK/home" \
    "XDG_RUNTIME_DIR=$WORK/runtime" \
    "XDG_CONFIG_HOME=$WORK/config" \
    "XDG_CACHE_HOME=$WORK/cache" \
    "XDG_DATA_HOME=$WORK/data" \
    "DBUS_SESSION_BUS_ADDRESS=unix:path=$WORK/runtime/bus" \
    "NO_AT_BRIDGE=1" "GTK_A11Y=none"
}

# Runs a command in the container as the host user, with the session env.
# Leading --env=NAME=VALUE args are passed to podman.
session_exec() {
  local args=()
  while read -r e; do args+=("--env=$e"); done < <(session_env)
  while [[ "${1:-}" == --env=* ]]; do args+=("$1"); shift; done
  podman exec --user="$(id -u)" "${args[@]}" "$CID" "$@"
}

# Retries a command once per second, up to $1 seconds.
wait_for() {
  local secs="$1"; shift
  for ((i = 0; i < secs; i++)); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}

# Prints the result of evaluating JS in the Shell, as Eval returns it (JSON text).
shell_eval() {
  local out
  out=$(session_exec gdbus call --session --timeout 5 --dest org.gnome.Shell --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Eval "$1") || return 1
  [[ "$out" == "(true, "* ]] || { echo "$out" >&2; return 1; }
  out=${out#"(true, '"}
  echo "${out%"')"}"
}

ext_gsettings() {
  session_exec gsettings --schemadir "$WORK/data/gnome-shell/extensions/$QL_UUID/schemas" "$1" \
    org.gnome.shell.extensions.quick-lofi "${@:2}"
}

# Creates the container, the session bus and the extension setup. Extra args go to `podman create`.
session_prepare() {
  local major="$1"
  WORK="$2"
  shift 2
  mkdir -p -m 0700 "$WORK"/{runtime,config,cache,data,home}

  CID=$(podman create --log-driver=none --tty --cap-add="$CAPS" --security-opt=label=disable \
    --user=0 --userns=keep-id "${QL_PODMAN_LIMITS[@]}" -v "$WORK:$WORK" \
    -v "$QL_ROOT/$QL_UUID.zip:/tmp/ext.zip:ro" "$@" "$(image_for "$major")") || return 1
  podman start "$CID" >/dev/null || return 1
  wait_for 60 podman exec "$CID" gdbus wait --system --timeout=1 org.freedesktop.login1 \
    || { echo "logind did not start" >&2; return 1; }

  session_exec sh -c "dbus-daemon --session --nofork --nopidfile --address=unix:path=$WORK/runtime/bus >$WORK/bus.log 2>&1 &"
  wait_for 20 session_exec gdbus call --session --timeout 5 --dest org.freedesktop.DBus --object-path / \
    --method org.freedesktop.DBus.Peer.Ping || { echo "session bus did not start" >&2; return 1; }

  # Installed before the Shell starts: a running Wayland Shell doesn't pick up new extensions.
  session_exec gnome-extensions install --force /tmp/ext.zip || return 1
  session_exec gsettings set org.gnome.shell disable-extension-version-validation true
  session_exec gsettings set org.gnome.shell enabled-extensions "['$QL_UUID']"
  ext_gsettings set radios \
    "['Tone A - av://lavfi:sine=frequency=440 - ta', 'Tone B - av://lavfi:sine=frequency=660 - tb']"
  ext_gsettings set mpv-arguments "['--ao=null']"
  ext_gsettings set enable-debug true
}

# Starts gnome-shell in the background and waits for its startup to finish.
# Leading --env=NAME=VALUE args go to the Shell process only; the rest are Shell args.
session_launch() {
  local envs=()
  while [[ "${1:-}" == --env=* ]]; do envs+=("$1"); shift; done
  session_exec "${envs[@]}" sh -c "exec gnome-shell $* >$WORK/shell.log 2>&1" 2>/dev/null &
  wait_for 60 session_exec gdbus wait --session --timeout=1 org.gnome.Shell.Screenshot \
    || { echo "gnome-shell did not start, see $WORK/shell.log" >&2; return 1; }
  for ((i = 0; i < 60; i++)); do
    [[ "$(shell_eval 'Main.layoutManager._startingUp')" == false ]] && return 0
    sleep 1
  done
  echo "gnome-shell stuck in startup" >&2
  return 1
}

# Same as session_launch, but in the foreground: returns when the Shell exits.
session_launch_fg() {
  local envs=()
  while [[ "${1:-}" == --env=* ]]; do envs+=("$1"); shift; done
  session_exec "${envs[@]}" sh -c "exec gnome-shell $* 2>&1 | tee $WORK/shell.log"
}

session_start() {
  session_prepare "$1" "$2" || return 1
  session_launch --wayland --headless --unsafe-mode --virtual-monitor 1280x800
}

session_stop() {
  [[ -n "$CID" ]] && podman rm -f -t 2 "$CID" >/dev/null 2>&1
  CID=''
}
