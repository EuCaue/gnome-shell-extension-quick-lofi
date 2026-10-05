# Shared helpers for doctor.sh and run-session.sh. Source, don't run.

# Prints the GNOME Shell major version, or nothing if it can't be read.
gnome_major() {
  gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true
}

# mutter-devkit lives in libexec, which is /usr/lib on Arch.
has_devkit() {
  local d
  for d in ${QL_DEVKIT_PATH:-/usr/libexec/mutter-devkit /usr/lib/mutter-devkit}; do
    [[ -x "$d" ]] && return 0
  done
  command -v mutter-devkit >/dev/null
}
