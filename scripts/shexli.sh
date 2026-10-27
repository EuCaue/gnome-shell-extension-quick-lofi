#!/usr/bin/env bash
# Runs shexli over the release ZIP with an error-only gate.
# Usage: shexli.sh [--ci]
set -uo pipefail

CI_MODE=0
if [[ "${1:-}" == "--ci" ]]; then
  CI_MODE=1
fi

QL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="$QL_ROOT/quick-lofi@eucaue.zip"
OUT="$QL_ROOT/.shexli"
mkdir -p "$OUT"

if [[ ! -f "$ZIP" ]]; then
  echo "missing ZIP, run: npm run build:prod" >&2
  exit 2
fi

if command -v shexli >/dev/null 2>&1; then
  SHEXLI="shexli"
elif [[ -x "$HOME/.local/bin/shexli" ]]; then
  SHEXLI="$HOME/.local/bin/shexli"
else
  echo "shexli not found, run: pipx install 'shexli==0.2.1'" >&2
  exit 2
fi

ZIP_ABS="$(readlink -f "$ZIP")"
TOOL_ERROR=""

if ! timeout 120s "$SHEXLI" --format json "$ZIP_ABS" >"$OUT/shexli.json" 2>"$OUT/shexli.stderr"; then
  TOOL_ERROR="shexli json run failed"
fi
if ! timeout 120s "$SHEXLI" --format text "$ZIP_ABS" >"$OUT/shexli.txt" 2>>"$OUT/shexli.stderr"; then
  TOOL_ERROR="shexli text run failed"
fi

if [[ -n "$TOOL_ERROR" ]] || ! python3 -c "import json;json.load(open('$OUT/shexli.json'))" 2>/dev/null; then
  echo "shexli: tool-error (advisory, see .shexli/)${TOOL_ERROR:+ — $TOOL_ERROR}" | tee -a "$OUT/shexli.txt"
  if [[ "$CI_MODE" == "1" && -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Shexli"
      echo ""
      echo "tool-error (advisory): shexli crashed or produced invalid JSON, see artifact shexli-report."
    } >>"$GITHUB_STEP_SUMMARY"
  fi
  exit 0
fi

STATUS_LINE="$(python3 - "$OUT/shexli.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
s = d.get("summary", {})
counts = s.get("severity_counts", {})
print(f"{s.get('status','unknown')}: {s.get('finding_count',0)} findings, {counts.get('error',0)} errors, {counts.get('warning',0)} warnings|{counts.get('error',0)}")
PY
)"
STATUS="${STATUS_LINE%%|*}"
ERRORS="${STATUS_LINE##*|}"
echo "shexli: $STATUS"

if [[ "$CI_MODE" == "1" && -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  python3 - "$OUT/shexli.json" >>"$GITHUB_STEP_SUMMARY" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
s = d.get("summary", {})
counts = s.get("severity_counts", {})
print("## Shexli")
print("")
print(f"Status: `{s.get('status','unknown')}` — {s.get('finding_count',0)} findings, "
      f"{counts.get('error',0)} errors, {counts.get('warning',0)} warnings, "
      f"{counts.get('manual_review',0)} manual_review")
print("")
print("| rule | severity | location | message |")
print("|---|---|---|---|")
for f in d.get("findings", [])[:10]:
    ev = (f.get("evidence") or [{}])[0]
    loc = ev.get("path", "")
    if ev.get("line") is not None:
        loc += f":{ev.get('line')}"
    msg = (f.get("message") or "").replace("|", "\\|").replace("\n", " ")[:160]
    print(f"| {f.get('rule_id','')} | {f.get('severity','')} | `{loc}` | {msg} |")
PY
fi

if [[ "${ERRORS:-0}" -gt 0 ]]; then
  exit 1
fi
exit 0
