# Shared helpers for doctor.sh and run-session.sh. Source, don't run.

# Colors and symbols only when attached to a terminal, so piped output (tests, logs) stays clean.
if [[ -t 1 || -t 2 ]]; then
  BOLD=$'\e[1m' DIM=$'\e[2m' RED=$'\e[31m' GREEN=$'\e[32m' YELLOW=$'\e[33m' RESET=$'\e[0m'
  SYM_OK="${GREEN}✓${RESET}" SYM_NO="${RED}✗${RESET}" SYM_OPT="${DIM}–${RESET}"
else
  BOLD='' DIM='' RED='' GREEN='' YELLOW='' RESET=''
  SYM_OK='✓' SYM_NO='✗' SYM_OPT='–'
fi

# Prints "  ✓ name [note]" or "  ✗ name [note]" with a 26-char name column.
row() {
  local sym="$1" name="$2" note="${3:-}"
  printf '  %b %-24s %b\n' "$sym" "$name" "$note"
}

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
