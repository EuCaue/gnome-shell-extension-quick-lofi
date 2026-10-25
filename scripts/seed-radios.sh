#!/usr/bin/env bash
# Adds or removes the sample radios from scripts/seed-radios.json on the installed extension.
# Seeded radios get ids starting with SEED, so --remove never touches your own radios.
set -euo pipefail

SCHEMA_DIR="${QL_SCHEMA_DIR:-$HOME/.local/share/gnome-shell/extensions/quick-lofi@eucaue/schemas}"
JSON="$(dirname "${BASH_SOURCE[0]}")/seed-radios.json"

usage() {
  echo "Usage: $0 --add | --remove | --list"
  echo "  -a, --add     add the sample radios (replaces earlier ones)"
  echo "  -r, --remove  remove the sample radios"
  echo "  -l, --list    print every radio"
  exit "${1:-0}"
}

case "${1:-}" in
  -a | --add) action=add ;;
  -r | --remove) action=remove ;;
  -l | --list) action=list ;;
  -h | --help) usage ;;
  *) usage 1 ;;
esac

for tool in gsettings python3; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done
[[ -d "$SCHEMA_DIR" ]] || { echo "extension not installed: $SCHEMA_DIR not found (run npm run install:dev)" >&2; exit 1; }

# Python reads the setting back reliably: names may hold quotes and non-ASCII text.
python3 - "$action" "$JSON" "$SCHEMA_DIR" <<'PY'
import ast, json, random, string, subprocess, sys

action, json_path, schema_dir = sys.argv[1:]
cmd = ['gsettings', '--schemadir', schema_dir]
schema, key = 'org.gnome.shell.extensions.quick-lofi', 'radios'

raw = subprocess.run(cmd + ['get', schema, key], check=True, capture_output=True, text=True).stdout.strip()
radios = [] if raw.startswith('@as') else ast.literal_eval(raw)

if action == 'list':
    print('\n'.join(radios))
    sys.exit()

radios = [r for r in radios if not r.rsplit(' - ', 1)[-1].startswith('SEED')]
if action == 'add':
    for seed in json.load(open(json_path, encoding='utf-8')):
        radio_id = 'SEED' + ''.join(random.choices(string.ascii_letters + string.digits, k=6))
        radios.append(f"{seed['radioName']} - {seed['radioUrl']} - {radio_id}")

# repr() of a list of str is valid GVariant text for an `as` value
subprocess.run(cmd + ['set', schema, key, repr(radios)], check=True)
print(f'{action}: {len(radios)} radios saved')
PY
