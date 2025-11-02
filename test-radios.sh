#!/usr/bin/env bash
SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/quick-lofi@eucaue/schemas"
SCHEMA="org.gnome.shell.extensions.quick-lofi"
RADIO_KEY="radios"
ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
RADIOS_JSON="./radios-test.json"
TEST_ID_PREFIX="TEST"

BOLD="\e[1m"
UNDERLINE="\e[4m"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

check_installed() {
  requireds=("jq" "gsettings")
  for program in "${requireds[@]}"; do
    if ! command -v "$program" &>/dev/null; then
      echo -e "${RED}${BOLD}$program is required.${NC} Please install it."
      exit 1
    fi
  done
}

generate_nanoid() {
  local nanoid=""
  for _ in $(seq 1 10); do
    # Generate a random byte and map it to a character from the alphabet
    local index=$(head -c 1 /dev/urandom | od -An -tu1 | awk '{print $1 % 64}')
    nanoid="${nanoid}${ALPHABET:$index:1}"
  done
  echo "$nanoid"
}

function add_radio() {
  if [ ! -f "$RADIOS_JSON" ]; then
    echo "$RADIOS_JSON not found!"
    exit 1
  fi

  jq -c '.[]' $RADIOS_JSON | while read -r i; do
    mapfile -t radio < <(echo "$i" | jq -r '[.radioName, .radioUrl] | @tsv' | tr '\t' '\n')
    radio_item="${radio[0]} - ${radio[1]} - $TEST_ID_PREFIX$(generate_nanoid)"
    echo "RADIO ITEM TEST: $radio_item"
    current=$(gsettings --schemadir "$SCHEMA_DIR" get "$SCHEMA" "$RADIO_KEY" | sed "s/^\[//;s/\]$//;s/^ *//;s/ *$//")
    gsettings --schemadir "$SCHEMA_DIR" set "$SCHEMA" "$RADIO_KEY" "[$current, '$radio_item']"
  done
}

function remove_radio() {
  radios_raw=$(gsettings --schemadir "$SCHEMA_DIR" get "$SCHEMA" "$RADIO_KEY" | sed "s/^\[//; s/\]$//; s/, '/\n/g; s/'//g")
  radios_list=$(echo "$radios_raw" | grep -v " - TEST")
  echo "RADIOS: $radios_list"
  new_radios="[$(printf "%s\n" "$radios_list" | sed "s/^/'/; s/$/'/" | paste -sd, -)]"
  gsettings --schemadir "$SCHEMA_DIR" set "$SCHEMA" "$RADIO_KEY" "$new_radios"
}

function usage() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo " -a, --add     Add test radios"
  echo " -r, --remove  Remove test radios"
  echo " -h, --help    Show this help message"
  echo
  echo "Examples:"
  echo " $0 -a"
  echo " $0 --help"
  exit 0
}

check_installed

if [ $# -eq 0 ]; then
  usage
fi

while getopts "ar-:h" opt; do
  case $opt in
  a) add_radio ;;
  r) remove_radio ;;
  h) usage ;;
  -)
    case "${OPTARG}" in
    add) add_radio ;;
    remove) remove_radio ;;
    help) usage ;;
    *) echo "Unknown option --${OPTARG}" ;;
    esac
    ;;
  *) usage ;;
  esac
done
