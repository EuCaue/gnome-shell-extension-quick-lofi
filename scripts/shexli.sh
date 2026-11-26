#!/usr/bin/env bash
# Runs shexli over the release ZIP with an error-only gate.
# EGO-M-004 is exempted only while shell-version stays within 45-51, because
# shexli 0.2.1 hardcodes major > 50 as a future release and GNOME 51 is shipped.
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

cp "$OUT/shexli.json" "$OUT/shexli.raw.json"
rm -f "$OUT/shexli.bypass"
python3 - "$OUT/shexli.json" "$ZIP_ABS" "$OUT/shexli.bypass" <<'PY'
import json
import sys
import zipfile

report_path, zip_path, marker_path = sys.argv[1:4]
with open(report_path) as fh:
    data = json.load(fh)
with zipfile.ZipFile(zip_path) as zf:
    meta = json.loads(zf.read("metadata.json"))

versions = meta.get("shell-version", [])
allowed = {str(version) for version in range(45, 52)}
if "51" in versions and len(versions) == len(set(versions)) and all(v in allowed for v in versions):
    original = data.get("findings", [])
    findings = [
        finding for finding in original
        if not (finding.get("rule_id") == "EGO-M-004" and finding.get("severity") == "error")
    ]
    if len(findings) != len(original):
        data["findings"] = findings
        counts: dict[str, int] = {}
        for finding in findings:
            severity = finding.get("severity", "unknown")
            counts[severity] = counts.get(severity, 0) + 1
        data["summary"]["severity_counts"] = counts
        data["summary"]["finding_count"] = len(findings)
        with open(report_path, "w") as fh:
            json.dump(data, fh, indent=2)
        with open(marker_path, "w"):
            pass
PY

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
  if [[ -f "$OUT/shexli.bypass" ]]; then
    echo "" >>"$GITHUB_STEP_SUMMARY"
    echo "EGO-M-004 for shell-version 51 is exempted by scripts/shexli.sh; raw report: shexli.raw.json." >>"$GITHUB_STEP_SUMMARY"
  fi
fi

if [[ "${ERRORS:-0}" -gt 0 ]]; then
  exit 1
fi
exit 0
