import {
  Chart as ChartJS, LinearScale, TimeScale, PointElement, LineElement, Tooltip, Legend, CategoryScale,
  type ChartData, type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useMemo } from "react";
import { fmtDate, fmtNum, STATUS_LABEL, type Classification, type Reading, type Status, type VariableKey } from "@/lib/hydro";

ChartJS.register(LinearScale, TimeScale, CategoryScale, PointElement, LineElement, Tooltip, Legend);

const cssVar = (name: string) =>
  typeof window === "undefined" ? "#888" : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const statusColor = (s: Status) =>
  cssVar(
    s === "normal" ? "--status-normal" : s === "low" ? "--status-low" : s === "high" ? "--status-high"
      : s === "critical" ? "--status-critical" : "--status-neutral",
  );

interface Props {
  variable: VariableKey;
  unit: string;
  readings: Reading[]; // desc
  cls: Map<Reading, Record<VariableKey, Classification>>;
  stationLabel: (r: Reading) => string;
}

export default function HydroChart({ variable, unit, readings, cls, stationLabel }: Props) {
  const { data, options } = useMemo(() => {
    const groups = new Map<string, Reading[]>();
    for (const r of [...readings].sort((a, b) => a.ts - b.ts)) {
      const k = stationLabel(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const palette = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(cssVar);
    const latestTs = readings.length ? Math.max(...readings.map((r) => r.ts)) : 0;
    const datasets = [...groups.entries()].map(([label, list], i) => {
      const statuses = list.map((r) => cls.get(r)?.[variable].status ?? "nodata");
      const lastIdx = list.length - 1;
      return {
        label,
        data: list.map((r) => ({ x: r.ts, y: r[variable] })),
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length],
        pointBackgroundColor: statuses.map(statusColor),
        pointBorderColor: list.map((r, j) => (j === lastIdx || r.ts === latestTs ? cssVar("--foreground") : statusColor(statuses[j]))),
        pointBorderWidth: list.map((_, j) => (j === lastIdx ? 2.5 : 1)),
        pointRadius: list.map((_, j) => (j === lastIdx ? 7 : 4)),
        spanGaps: true,
        tension: 0.25,
        borderWidth: 2,
        _readings: list,
      };
    });
    const grid = cssVar("--border");
    const tick = cssVar("--muted-foreground");
    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false as unknown as undefined,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: {
          type: "linear",
          grid: { color: grid },
          ticks: { color: tick, maxTicksLimit: 5, callback: (v) => new Date(Number(v)).toLocaleDateString("pt-BR") },
        },
        y: { grid: { color: grid }, ticks: { color: tick }, title: { display: true, text: unit, color: tick } },
      },
      plugins: {
        legend: { display: groups.size <= 8, labels: { color: tick, boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: (items) => fmtDate(Number(items[0].parsed.x)),
            label: (item) => {
              const ds = item.dataset as unknown as { _readings: Reading[] };
              const r = ds._readings[item.dataIndex];
              const c = cls.get(r)?.[variable];
              return `${item.dataset.label}: ${fmtNum(item.parsed.y)} ${unit} · ${c ? STATUS_LABEL[c.status] : ""}`;
            },
          },
        },
      },
    };
    return { data: { datasets } as unknown as ChartData<"line">, options };
  }, [readings, cls, variable, unit, stationLabel]);

  return <Line data={data} options={options} />;
}
