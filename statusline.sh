#!/usr/bin/env bash
# Claude Code status line: model, effort, context bar, percentage, token usage.
# Wired up via statusLine.command in .agents/settings.json.

input=$(cat)
cw=${input#*\"context_window\"}
cw=${cw%%\"rate_limits\"*}

get() { echo "$2" | grep -oE "\"$1\":[^,}]*" | head -1 | sed -e 's/.*: *//' -e 's/^"//' -e 's/"$//'; }

model=$(get display_name "$input")
effort=$(echo "$input" | grep -oE '"effort":\{[^}]*\}' | grep -oE '"level":"[^"]*"' | sed -e 's/.*:"//' -e 's/"$//')
pct=$(get used_percentage "$cw")
tok=$(get total_input_tokens "$cw")
max=$(get context_window_size "$cw")

fh=$(echo "$input" | grep -oE '"five_hour":\{[^}]*\}')
fh_pct=$(get used_percentage "$fh")
fh_at=$(get resets_at "$fh")
fh_time=$(date -r "$fh_at" +%H:%M 2>/dev/null || date -d "@$fh_at" +%H:%M 2>/dev/null)

case "$pct" in ''|null) pct=0 ;; esac
case "$tok" in ''|null) tok=0 ;; esac
case "$max" in ''|null|0) max=$(LC_ALL=C awk -v t="$tok" -v p="$pct" 'BEGIN{print (p>0)? t*100/p : 0}') ;; esac

LC_ALL=C awk -v m="$model" -v e="$effort" -v p="$pct" -v t="$tok" -v x="$max" \
  -v fp="$fh_pct" -v ft="$fh_time" '
function h(v,  s,u) {
  if (v >= 1000000) { v = v / 1000000; u = "m" }
  else if (v >= 1000) { v = v / 1000; u = "k" }
  else { return sprintf("%d", v) }
  s = sprintf("%.1f", v); sub(/\.0$/, "", s); return s u
}
BEGIN {
  reset = "\033[0m"; blue = "\033[34m"; dim = "\033[90m"; sep = dim " │ " reset
  c = (p < 50) ? "\033[32m" : (p < 75) ? "\033[33m" : "\033[31m"

  n = 10; f = int(p / 10); if (f > n) f = n; if (f < 0) f = 0
  for (i = 0; i < f; i++) b = b "▓"
  for (i = f; i < n; i++) b = b "░"

  line = m
  if (e != "") line = line sep dim e reset
  line = line sep c b reset
  line = line sep c sprintf("%.0f%%", p) reset
  line = line sep blue h(t) "/" h(x) " tokens" reset
  if (fp != "") {
    fc = (fp < 50) ? "\033[32m" : (fp < 75) ? "\033[33m" : "\033[31m"
    line = line sep fc sprintf("5h %.0f%%", fp) reset
    if (ft != "") line = line dim " (resets " ft ")" reset
  }
  print line
}
'
