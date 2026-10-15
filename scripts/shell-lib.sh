# Shared helpers for the containerized GNOME Shell tests. Source, don't run.
QL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QL_OUT="$QL_ROOT/.shell-test"
QL_UUID='quick-lofi@eucaue'
QL_VERSIONS=(45 46 47 48 49 50 51)
QL_PODMAN_LIMITS=(--memory=3g --cpus=2)

fedora_for() {
  case "$1" in
    45) echo 39 ;; 46) echo 40 ;; 47) echo 41 ;; 48) echo 42 ;;
    49) echo 43 ;; 50) echo 44 ;; 51) echo 45 ;;
    *) return 1 ;;
  esac
}

image_for() { echo "localhost/quick-lofi-shell:$1"; }

# Versions from the args, or all of them.
versions_from_args() {
  if (($#)); then printf '%s\n' "$@"; else printf '%s\n' "${QL_VERSIONS[@]}"; fi
}
