# Checks run against a started session. Source after shell-session.sh.
IND='Main.panel.statusArea["quick-lofi@eucaue"]'
FAILED=0

check() {
  local name="$1"; shift
  local reason
  if reason=$("$@" 2>&1); then
    echo "  ✓ $name"
  else
    echo "  ✗ $name: ${reason:-failed}"
    FAILED=1
  fi
}

expect_eval() {
  local got
  got=$(shell_eval "$1") || return 1
  [[ "$got" == "$2" ]] || { echo "expected $2, got $got"; return 1; }
}

# Retries for up to 10 s, then runs once more so the failure reason is printed.
wait_true() {
  for ((i = 0; i < 10; i++)); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  "$@"
}

ext_state() {
  local info errs
  info=$(session_exec gnome-extensions info "$QL_UUID")
  grep -qE 'State: (ENABLED|ACTIVE)' <<<"$info" || { grep State <<<"$info"; return 1; }
  errs=$(session_exec gdbus call --session --timeout 5 --dest org.gnome.Shell.Extensions \
    --object-path /org/gnome/Shell/Extensions --method org.gnome.Shell.Extensions.GetExtensionErrors "$QL_UUID")
  [[ "$errs" == "(@as [],)" ]] || { echo "$errs"; return 1; }
}

mpv_running() { session_exec pgrep -x mpv >/dev/null || { echo "mpv not running"; return 1; }; }
mpv_stopped() { ! session_exec pgrep -x mpv >/dev/null || { echo "mpv still running"; return 1; }; }

setting_is() {
  local got; got=$(ext_gsettings get "$1")
  [[ "$got" == "$2" ]] || { echo "$1 is $got, expected $2"; return 1; }
}

# Not a check: a missing picture only warns, and the reason goes to screenshot.log.
screenshot() {
  session_exec gdbus call --session --timeout 20 --dest org.gnome.Shell.Screenshot --object-path /org/gnome/Shell/Screenshot \
    --method org.gnome.Shell.Screenshot.Screenshot false false "$WORK/$1" >>"$WORK/screenshot.log" 2>&1
  [[ -s "$WORK/$1" ]] || echo "  ! $1 is empty, see screenshot.log"
}

radio_names="$IND"'._popupSection._getMenuItems().map(i => i.label?.text).filter(Boolean).join("|")'

# Same path as a real click: the radio item's handler with a mouse button (1 = play/pause, 3 = stop).
click_radio() {
  shell_eval "(() => { const i = $IND; const it = i._popupSection._getMenuItems()[$1]; i._togglePlayingStatus(it, i._radios[$1].id, $2); return true; })()" >/dev/null
}

find_slider='(a => { const f = x => x.has_style_class_name?.("volume-slider") ? x : x.get_children().map(f).find(Boolean); return f(a); })('"$IND"'.menu.box)'

indicator_count='[Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox].flatMap(b => b.get_children()).filter(c => c.get_first_child()?._extension?.uuid === "quick-lofi@eucaue").length'

prefs_window='global.get_window_actors().some(a => a.meta_window.get_wm_class() === "org.gnome.Shell.Extensions")'

js_errors() {
  local hits
  hits=$(grep -hE 'JS ERROR|Exception in callback|Gjs-CRITICAL|JS WARNING.*quick-lofi|Unhandled promise rejection|quick-lofi@eucaue.*(Error|error)' "$WORK/shell.log" "$WORK/bus.log" || true)
  [[ -z "$hits" ]] || { head -5 <<<"$hits"; return 1; }
}

run_checks() {
  FAILED=0
  check 'extension enabled, no errors' ext_state
  check 'indicator in panel' expect_eval "!!$IND" true
  check 'menu opens' expect_eval "($IND.menu.open(), $IND.menu.isOpen)" true
  check 'menu has room for the radios' wait_true expect_eval "$IND.menu.box.get_height() > 100" true
  check 'radios listed' expect_eval "$radio_names" '"Tone A|Tone B"'
  check 'play radio' click_radio 0 1
  check 'mpv running' wait_true mpv_running
  check 'current radio saved' wait_true setting_is current-radio-playing "'ta'"
  # Rebuilding the menu (as a radio list change does) must not leave handlers on the old widgets.
  check 'menu rebuilt' expect_eval "($IND._createMenu(), true)" true
  check 'volume slider moves' expect_eval "($find_slider.value = 0.3, true)" true
  check 'volume saved' wait_true setting_is volume 30
  screenshot menu.png
  check 'switch radio' click_radio 1 1
  check 'switched radio saved' wait_true setting_is current-radio-playing "'tb'"
  check 'stop radio' click_radio 1 3
  check 'mpv stopped' wait_true mpv_stopped
  # The fade on stop lowers mpv's volume only; the stored setting must survive it.
  check 'volume kept after fade' setting_is volume 30
  check 'play before disable' click_radio 0 1
  check 'mpv running again' wait_true mpv_running
  check 'disable' session_exec gnome-extensions disable "$QL_UUID"
  check 'no mpv after disable' wait_true mpv_stopped
  check 'indicator removed' expect_eval "!$IND" true
  check 're-enable' session_exec gnome-extensions enable "$QL_UUID"
  check 'one indicator after re-enable' wait_true expect_eval "$indicator_count" 1
  check 'prefs open' session_exec gnome-extensions prefs "$QL_UUID"
  check 'prefs window shown' wait_true expect_eval "$prefs_window" true
  sleep 2
  screenshot prefs.png
  check 'no JS errors in logs' js_errors
  if [[ $FAILED == 0 ]]; then echo pass >"$WORK/result"; else echo fail >"$WORK/result"; fi
  return $FAILED
}
