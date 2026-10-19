#!/usr/bin/env bash
# Runs the extension checks on each GNOME version, one container at a time.
# Usage: shell-test.sh [major...]
set -uo pipefail
dir="$(dirname "${BASH_SOURCE[0]}")"
source "$dir/shell-session.sh"
source "$dir/shell-checks.sh"

trap session_stop EXIT
(cd "$QL_ROOT" && npm run --silent build:dev >/dev/null) || { echo "build failed" >&2; exit 1; }

declare -A summary
for v in $(versions_from_args "$@"); do
  echo "GNOME $v"
  if ! image_exists "$(image_for "$v")" && ! bash "$dir/shell-image.sh" "$v"; then
    summary[$v]='image build failed'
    continue
  fi
  rm -rf "${QL_OUT:?}/$v"
  if ! session_start "$v" "$QL_OUT/$v"; then
    summary[$v]="shell did not start (see .shell-test/$v/shell.log)"
  elif run_checks; then
    summary[$v]="pass ($(session_exec gnome-shell --version))"
  else
    summary[$v]="FAIL (see .shell-test/$v/)"
  fi
  session_stop
  # never start the next container while one is still alive
  [[ -z "$("$QL_ENGINE" ps -q --filter ancestor="$(image_for "$v")")" ]] || { echo "container leaked" >&2; exit 2; }
done

echo
rc=0
for v in $(versions_from_args "$@"); do
  printf '%-4s %s\n' "$v" "${summary[$v]}"
  [[ "${summary[$v]}" == pass* ]] || rc=1
done
exit $rc
