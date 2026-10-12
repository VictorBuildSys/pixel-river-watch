// Domain types, parsing and statistical classification for hydrological readings.

export type VariableKey = "chuva" | "nivel" | "vasao" | "bateria";

export interface Reading {
  dataHora: string; // ISO local time from API
  ts: number; // epoch ms
  idProjeto: number;
  idEstacao: number;
  chuva: number | null;
  nivel: number | null;
  vasao: number | null;
  bateria: number | null;
}

export type Status = "normal" | "low" | "high" | "critical" | "insufficient" | "nodata";

export const VARIABLES: { key: VariableKey; label: string; unit: string }[] = [
  { key: "chuva", label: "Chuva", unit: "mm" },
  { key: "nivel", label: "Nível", unit: "m" },
  { key: "vasao", label: "Vazão", unit: "m³/s" },
  { key: "bateria", label: "Bateria", unit: "V" },
];

export const STATUS_LABEL: Record<Status, string> = {
  normal: "Normal",
  low: "Abaixo da média",
  high: "Acima da média",
  critical: "Muito acima",
  insufficient: "Histórico insuficiente",
  nodata: "Sem dado",
};

export interface ClassifyConfig {
  minSamples: number; // minimum previous readings for a representative mean
  lowZ: number; // z below -lowZ => low (blue)
  highZ: number; // z above highZ => high (orange)
  criticalZ: number; // z above criticalZ => critical (red)
  batteryCritical: number; // volts, below => critical
  batteryWarn: number; // volts, below => high (attention)
  batteryMax: number; // volts, above => high (overcharge)
}

export const DEFAULT_CONFIG: ClassifyConfig = {
  minSamples: 5,
  lowZ: 1.5,
  highZ: 1.5,
  criticalZ: 2.5,
  batteryCritical: 11.5,
  batteryWarn: 12.0,
  batteryMax: 15.0,
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Validates raw API payload; drops malformed rows. Throws if payload is not an array. */
export function parseReadings(raw: unknown): Reading[] {
  if (!Array.isArray(raw)) throw new Error("Resposta inválida da API: formato inesperado.");
  const out: Reading[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const ts = typeof o['dataHora'] === "string" ? Date.parse(o['dataHora']) : NaN;
    const p = num(o['idProjeto']);
    const e = num(o['idEstacao']);
    if (!Number.isFinite(ts) || p === null || e === null) continue;
    out.push({
      dataHora: o['dataHora'] as string,
      ts,
      idProjeto: p,
      idEstacao: e,
      chuva: num(o['chuva']),
      nivel: num(o['nivel']),
      vasao: num(o['vasao']),
      bateria: num(o['bateria']),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export interface Classification {
  status: Status;
  mean: number | null;
  std: number | null;
  n: number;
  z: number | null;
  reason: string;
}

/**
 * Classifies `value` against `history` (previous values of the same station+variable,
 * excluding the value itself).
 */
export function classify(
  value: number | null,
  history: (number | null)[],
  variable: VariableKey,
  cfg: ClassifyConfig = DEFAULT_CONFIG,
): Classification {
  const vals = history.filter((v): v is number => v !== null);
  const n = vals.length;
  const mean = n ? vals.reduce((a, b) => a + b, 0) / n : null;
  const std =
    n > 1 && mean !== null
      ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
      : null;
  const base = { mean, std, n };

  if (value === null) return { ...base, status: "nodata", z: null, reason: "Leitura nula" };

  if (variable === "bateria") {
    if (value < cfg.batteryCritical)
      return { ...base, status: "critical", z: null, reason: `Abaixo do limite crítico (${cfg.batteryCritical} V)` };
    if (value < cfg.batteryWarn)
      return { ...base, status: "high", z: null, reason: `Abaixo do limite de alerta (${cfg.batteryWarn} V)` };
    if (value > cfg.batteryMax)
      return { ...base, status: "high", z: null, reason: `Acima da tensão máxima (${cfg.batteryMax} V)` };
  }

  if (n < cfg.minSamples || mean === null)
    return { ...base, status: variable === "bateria" ? "normal" : "insufficient", z: null,
      reason: `Histórico com ${n} leitura(s); mínimo ${cfg.minSamples}` };

  if (!std || std < 1e-9) {
    if (Math.abs(value - mean) < 1e-9)
      return { ...base, status: "normal", z: 0, reason: "Igual ao histórico constante" };
    return { ...base, status: value > mean ? "high" : "low", z: null,
      reason: "Histórico sem dispersão; média pouco representativa" };
  }

  const z = (value - mean) / std;
  if (z > cfg.criticalZ) return { ...base, status: "critical", z, reason: `z = ${z.toFixed(2)}` };
  if (z > cfg.highZ) return { ...base, status: "high", z, reason: `z = ${z.toFixed(2)}` };
  if (z < -cfg.lowZ) return { ...base, status: "low", z, reason: `z = ${z.toFixed(2)}` };
  return { ...base, status: "normal", z, reason: `z = ${z.toFixed(2)}` };
}

const key = (r: Reading) => `${r.idProjeto}-${r.idEstacao}`;

/** Classifies every reading against older readings of the same station. Input sorted desc. */
export function classifyAll(
  readings: Reading[],
  cfg: ClassifyConfig = DEFAULT_CONFIG,
): Map<Reading, Record<VariableKey, Classification>> {
  const byStation = new Map<string, Reading[]>();
  for (const r of readings) {
    const k = key(r);
    if (!byStation.has(k)) byStation.set(k, []);
    byStation.get(k)!.push(r);
  }
  const result = new Map<Reading, Record<VariableKey, Classification>>();
  for (const list of byStation.values()) {
    const asc = [...list].sort((a, b) => a.ts - b.ts);
    asc.forEach((r, i) => {
      const prev = asc.slice(0, i);
      const rec = {} as Record<VariableKey, Classification>;
      for (const v of VARIABLES) rec[v.key] = classify(r[v.key], prev.map((p) => p[v.key]), v.key, cfg);
      result.set(r, rec);
    });
  }
  return result;
}

export const SEVERITY: Record<Status, number> = {
  critical: 5, high: 4, low: 3, insufficient: 1, nodata: 1, normal: 0,
};

export function worstStatus(list: Status[]): Status {
  return list.reduce<Status>((w, s) => (SEVERITY[s] > SEVERITY[w] ? s : w), "normal");
}

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtNum = (v: number | null, d = 2) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: d });
