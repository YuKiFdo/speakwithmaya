#!/usr/bin/env bash
# Samples per-container CPU/RAM and host CPU steal/load every 2s into a CSV, until killed.
#   bash vps-monitor.sh loadtest-metrics.csv
# Columns: ts, container, cpu_pct, mem_mib, host_us, host_sy, host_id, host_st, load1
set -u
OUT="${1:-loadtest-metrics.csv}"
echo "ts,container,cpu_pct,mem_mib,host_us,host_sy,host_id,host_st,load1" > "$OUT"
while true; do
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  # vmstat 1 2: second line is the 1s sample (first is since-boot average)
  read -r us sy id st < <(vmstat 1 2 | tail -1 | awk '{print $13, $14, $15, $17}')
  load1=$(cut -d' ' -f1 /proc/loadavg)
  docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' |
    while IFS=, read -r name cpu mem; do
      cpu=${cpu%\%}
      used=${mem%% /*}
      case "$used" in
        *GiB) mib=$(awk -v v="${used%GiB}" 'BEGIN{printf "%.1f", v*1024}') ;;
        *MiB) mib=${used%MiB} ;;
        *KiB) mib=$(awk -v v="${used%KiB}" 'BEGIN{printf "%.2f", v/1024}') ;;
        *) mib=$used ;;
      esac
      echo "$ts,$name,$cpu,$mib,$us,$sy,$id,$st,$load1" >> "$OUT"
    done
  sleep 1
done
