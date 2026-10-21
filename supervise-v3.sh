#!/usr/bin/env bash
set -u
ROOT=/workspace/qingtongmen/dsh
LOG=$ROOT/dsh-run-v3.log
PIDF=$ROOT/dsh-v3.pid
PATCH=$ROOT/flash-max.patch.yml
PROMPT=$ROOT/PROMPT-v3.md
SUPLOG=$ROOT/supervisor-v3.log
cd "$ROOT"
echo "$(date '+%F %T') supervisor-v3 start" >> "$SUPLOG"
while true; do
  if grep -q 'DONE-v3' "$ROOT/progress.log" 2>/dev/null; then
    echo "$(date '+%F %T') DONE-v3 seen; exit" >> "$SUPLOG"
    exit 0
  fi
  pid=$(cat "$PIDF" 2>/dev/null || true)
  alive=0
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    alive=1
  elif pgrep -f "dsh --profile headless --patch $PATCH" >/dev/null; then
    alive=1
    pgrep -f "dsh --profile headless --patch $PATCH" | head -1 > "$PIDF"
  fi
  if [[ $alive -eq 0 ]]; then
    # find newest session under qingtongmen-dsh
    sess=$(find /home/box/.dsh/sessions/--workspace-qingtongmen-dsh-- -maxdepth 2 -type d -name 'session-*' 2>/dev/null | xargs -r ls -td 2>/dev/null | head -1)
    sid=$(basename "${sess:-}")
    echo "$(date '+%F %T') dsh dead; resume ${sid:-new}" >> "$SUPLOG"
    if [[ -n "$sid" && "$sid" == session-* ]]; then
      nohup dsh --profile headless --patch "$PATCH" --session-id "$sid" "继续完成 PROMPT-v3.md 中的v3 修订；未完成不要停。完成后 progress.log 写 DONE-v3。" \
        >> "$LOG" 2>&1 &
    else
      nohup dsh --profile headless --patch "$PATCH" - < "$PROMPT" >> "$LOG" 2>&1 &
    fi
    echo $! > "$PIDF"
    echo "$(date '+%F %T') relaunched pid=$(cat $PIDF)" >> "$SUPLOG"
  fi
  sleep 90
done
