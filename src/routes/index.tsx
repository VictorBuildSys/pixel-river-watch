import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Droplets, RefreshCw, AlertTriangle, Activity, Radio, X, Settings2, Waves, CloudRain, Gauge, BatteryMedium } from "lucide-react";
import { fetchHistorico } from "@/lib/hydro.functions";
import {
  classifyAll, DEFAULT_CONFIG, fmtDate, fmtNum, parseReadings, STATUS_LABEL, VARIABLES, worstStatus,
  type ClassifyConfig, type Reading, type Status, type VariableKey,
} from "@/lib/hydro";

const HydroChart = lazy(() => import("@/components/HydroChart"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HidroPainel — Monitoramento Hidrológico" },
      { name: "description", content: "Painel de chuva, nível, vazão e bateria por projeto e estação, com detecção de anomalias." },
      { property: "og:title", content: "HidroPainel — Monitoramento Hidrológico" },
      { property: "og:description", content: "Acompanhe estações hidrológicas e identifique anomalias rapidamente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const HOUR = 3_600_000;
const ICONS: Record<VariableKey, typeof Droplets> = { chuva: CloudRain, nivel: Waves, vasao: Gauge, bateria: BatteryMedium };
const PERIODS = [
  { v: "all", l: "Todo o período" }, { v: "1", l: "Últimas 24 h" }, { v: "7", l: "Últimos 7 dias" },
  { v: "30", l: "Últimos 30 dias" }, { v: "365", l: "Último ano" },
];
const STATUS_CLASS: Record<Status, string> = {
  normal: "bg-status-normal/15 text-status-normal border-status-normal/40",
  low: "bg-status-low/15 text-status-low border-status-low/40",
  high: "bg-status-high/15 text-status-high border-status-high/40",
  critical: "bg-status-critical/15 text-status-critical border-status-critical/50",
  insufficient: "bg-status-neutral/15 text-status-neutral border-status-neutral/40",
  nodata: "bg-status-neutral/10 text-status-neutral border-status-neutral/30",
};
const DOT: Record<Status, string> = {
  normal: "bg-status-normal", low: "bg-status-low", high: "bg-status-high",
  critical: "bg-status-critical", insufficient: "bg-status-neutral", nodata: "bg-status-neutral",
};
const ATTENTION: Status[] = ["low", "high", "critical"];

function Badge({ s }: { s: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[s]}`} />{STATUS_LABEL[s]}
    </span>
  );
}

const selectCls = "w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Dashboard() {
  const fetchFn = useServerFn(fetchHistorico);
  const q = useQuery({
    queryKey: ["historico"],
    queryFn: async () => parseReadings(await fetchFn()),
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  });

  const [proj, setProj] = useState("all");
  const [est, setEst] = useState("all");
  const [variable, setVariable] = useState<"all" | VariableKey>("all");
  const [period, setPeriod] = useState("all");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [cfg, setCfg] = useState<ClassifyConfig>(DEFAULT_CONFIG);
  const [showCfg, setShowCfg] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const all = q.data ?? [];
  const cls = useMemo(() => classifyAll(all, cfg), [all, cfg]);
  const projects = useMemo(() => [...new Set(all.map((r) => r.idProjeto))].sort((a, b) => a - b), [all]);
  const stations = useMemo(
    () => [...new Set(all.filter((r) => proj === "all" || r.idProjeto === +proj).map((r) => r.idEstacao))].sort((a, b) => a - b),
    [all, proj],
  );
  const vars = variable === "all" ? VARIABLES : VARIABLES.filter((v) => v.key === variable);

  const filtered = useMemo(() => {
    const min = period === "all" ? -Infinity : Date.now() - +period * 24 * HOUR;
    return all.filter((r) =>
      (proj === "all" || r.idProjeto === +proj) && (est === "all" || r.idEstacao === +est) && r.ts >= min &&
      (!onlyAttention || vars.some((v) => ATTENTION.includes(cls.get(r)![v.key].status))));
  }, [all, proj, est, period, onlyAttention, vars, cls]);

  const rowStatus = useCallback((r: Reading) => worstStatus(vars.map((v) => cls.get(r)![v.key].status)), [vars, cls]);

  // latest reading per station within filter
  const latest = useMemo(() => {
    const m = new Map<string, Reading>();
    for (const r of filtered) { const k = `${r.idProjeto}-${r.idEstacao}`; if (!m.has(k)) m.set(k, r); }
    return [...m.values()].sort((a, b) => SEV(rowStatus(b)) - SEV(rowStatus(a)) || b.ts - a.ts);
  }, [filtered, rowStatus]);

  const attentionCount = latest.filter((r) => ATTENTION.includes(rowStatus(r))).length;
  const lastTs = filtered[0]?.ts;
  const stationLabel = useCallback((r: Reading) => `P${r.idProjeto} · E${r.idEstacao}`, []);
  const detailReadings = detail ? all.filter((r) => `${r.idProjeto}-${r.idEstacao}` === detail) : [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><Droplets className="h-5 w-5" /></div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">HidroPainel</h1>
              <p className="text-xs text-muted-foreground">Monitoramento hidrológico</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block font-mono">
              {q.dataUpdatedAt ? `Atualizado ${fmtDate(q.dataUpdatedAt)} · auto 60 min` : "Carregando…"}
            </span>
            <button onClick={() => setShowCfg((s) => !s)} aria-label="Critérios" className="rounded-md border border-border p-2 hover:bg-accent"><Settings2 className="h-4 w-4" /></button>
            <button onClick={() => q.refetch()} disabled={q.isFetching}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {showCfg && <ConfigPanel cfg={cfg} setCfg={setCfg} />}

        {/* Filters */}
        <section className="glass grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
          <label className="text-xs text-muted-foreground">Projeto
            <select className={selectCls} value={proj} onChange={(e) => { setProj(e.target.value); setEst("all"); }}>
              <option value="all">Todos</option>{projects.map((p) => <option key={p} value={p}>Projeto {p}</option>)}
            </select></label>
          <label className="text-xs text-muted-foreground">Estação
            <select className={selectCls} value={est} onChange={(e) => setEst(e.target.value)}>
              <option value="all">Todas</option>{stations.map((s) => <option key={s} value={s}>Estação {s}</option>)}
            </select></label>
          <label className="text-xs text-muted-foreground">Variável
            <select className={selectCls} value={variable} onChange={(e) => setVariable(e.target.value as never)}>
              <option value="all">Todas</option>{VARIABLES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select></label>
          <label className="text-xs text-muted-foreground">Período
            <select className={selectCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select></label>
          <label className="col-span-2 flex items-end gap-2 pb-2 text-sm md:col-span-1">
            <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} className="h-4 w-4 accent-primary" />
            Só registros em atenção
          </label>
        </section>

        {q.isError && (
          <div className="glass flex items-start gap-3 border-status-critical/50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-status-critical" />
            <div className="flex-1">
              <p className="font-medium">Não foi possível carregar os dados</p>
              <p className="text-sm text-muted-foreground">{(q.error as Error).message}</p>
            </div>
            <button onClick={() => q.refetch()} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">Tentar novamente</button>
          </div>
        )}

        {q.isLoading ? <Skeleton /> : q.isSuccess && all.length === 0 ? (
          <Empty text="A API não retornou nenhuma leitura." />
        ) : q.isSuccess && (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={Radio} label="Estações" value={String(latest.length)} sub={`${new Set(latest.map((r) => r.idProjeto)).size} projetos`} />
              <Kpi icon={Activity} label="Leituras no filtro" value={String(filtered.length)} sub={`de ${all.length} recebidas`} />
              <Kpi icon={AlertTriangle} label="Em atenção" value={String(attentionCount)} sub="estações com anomalia" tone={attentionCount ? "critical" : "normal"} />
              <Kpi icon={Droplets} label="Última leitura" value={lastTs ? fmtDate(lastTs).split(" ")[0] : "—"} sub={lastTs ? fmtDate(lastTs).split(" ")[1] : "sem dados"} />
            </section>

            <Legend />

            {filtered.length === 0 ? <Empty text="Nenhuma leitura corresponde aos filtros selecionados." /> : (
              <>
                {/* Station cards */}
                <section>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Valores mais recentes por estação</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {latest.map((r) => {
                      const s = rowStatus(r);
                      return (
                        <button key={`${r.idProjeto}-${r.idEstacao}`} onClick={() => setDetail(`${r.idProjeto}-${r.idEstacao}`)}
                          className={`glass p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60 ${ATTENTION.includes(s) ? STATUS_CLASS[s].split(" ").find((c) => c.startsWith("border-")) ?? "" : ""}`}>
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">Estação {r.idEstacao}</p>
                              <p className="text-xs text-muted-foreground">Projeto {r.idProjeto} · {fmtDate(r.ts)}</p>
                            </div>
                            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${DOT[s]}`} title={STATUS_LABEL[s]} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {vars.map((v) => {
                              const c = cls.get(r)![v.key];
                              const Icon = ICONS[v.key];
                              return (
                                <div key={v.key} className="rounded-md bg-secondary/60 p-2" title={`${STATUS_LABEL[c.status]} — ${c.reason}`}>
                                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3 w-3" />{v.label}<span className={`ml-auto h-1.5 w-1.5 rounded-full ${DOT[c.status]}`} /></p>
                                  <p className="font-mono text-sm">{fmtNum(r[v.key])} <span className="text-xs text-muted-foreground">{v.unit}</span></p>
                                </div>
                              );
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Charts */}
                <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {vars.map((v) => (
                    <div key={v.key} className="glass p-4">
                      <h3 className="mb-2 flex items-center gap-2 font-semibold">{(() => { const I = ICONS[v.key]; return <I className="h-4 w-4 text-primary" />; })()}{v.label} <span className="text-xs font-normal text-muted-foreground">({v.unit})</span></h3>
                      <div className="h-64">
                        <ClientOnly fallback={<div className="h-full animate-pulse rounded bg-muted" />}>
                          <Suspense fallback={<div className="h-full animate-pulse rounded bg-muted" />}>
                            <HydroChart variable={v.key} unit={v.unit} readings={filtered} cls={cls} stationLabel={stationLabel} />
                          </Suspense>
                        </ClientOnly>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">Pontos coloridos pela classificação; ponto maior com contorno = leitura mais recente.</p>
                    </div>
                  ))}
                </section>

                {/* Table */}
                <section className="glass overflow-hidden">
                  <h2 className="border-b border-border px-4 py-3 font-semibold">Histórico de medições <span className="text-sm font-normal text-muted-foreground">(mais recente primeiro)</span></h2>
                  <div className="max-h-[480px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
                        <tr><th className="px-4 py-2">Data/hora</th><th className="px-4 py-2">Projeto</th><th className="px-4 py-2">Estação</th>
                          {vars.map((v) => <th key={v.key} className="px-4 py-2 text-right">{v.label} ({v.unit})</th>)}<th className="px-4 py-2">Situação</th></tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => (
                          <tr key={i} onClick={() => setDetail(`${r.idProjeto}-${r.idEstacao}`)} className="cursor-pointer border-t border-border hover:bg-accent/50">
                            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{fmtDate(r.ts)}</td>
                            <td className="px-4 py-2">{r.idProjeto}</td><td className="px-4 py-2">{r.idEstacao}</td>
                            {vars.map((v) => {
                              const c = cls.get(r)![v.key];
                              return <td key={v.key} className="px-4 py-2 text-right font-mono" title={`${STATUS_LABEL[c.status]} — ${c.reason}`}>
                                <span className={`inline-flex items-center gap-1.5 ${ATTENTION.includes(c.status) ? (STATUS_CLASS[c.status].split(" ")[1] ?? "") : ""}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[c.status]}`} />{fmtNum(r[v.key])}</span></td>;
                            })}
                            <td className="px-4 py-2"><Badge s={rowStatus(r)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Dados: API SIIVIAS (ListarHistorico) · Nenhum dado simulado é exibido · Classificação por média e desvio-padrão históricos da estação
      </footer>

      {detail && <DetailPanel id={detail} readings={detailReadings} cls={cls} onClose={() => setDetail(null)} />}
    </div>
  );
}

const SEV = (s: Status) => ({ critical: 5, high: 4, low: 3, insufficient: 1, nodata: 1, normal: 0 })[s];

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Droplets; label: string; value: string; sub: string; tone?: Status }) {
  return (
    <div className="glass p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${tone === "critical" ? "text-status-critical" : tone === "normal" ? "text-status-normal" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(["normal", "low", "high", "critical", "insufficient"] as Status[]).map((s) => <Badge key={s} s={s} />)}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass p-10 text-center text-muted-foreground">{text}</div>;
}

function Skeleton() {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>;
}

function ConfigPanel({ cfg, setCfg }: { cfg: ClassifyConfig; setCfg: (c: ClassifyConfig) => void }) {
  const fields: { k: keyof ClassifyConfig; l: string; step: number }[] = [
    { k: "minSamples", l: "Mín. leituras no histórico", step: 1 },
    { k: "lowZ", l: "Abaixo da média (desvios)", step: 0.1 },
    { k: "highZ", l: "Acima da média (desvios)", step: 0.1 },
    { k: "criticalZ", l: "Muito acima (desvios)", step: 0.1 },
    { k: "batteryCritical", l: "Bateria crítica (V)", step: 0.1 },
    { k: "batteryWarn", l: "Bateria alerta (V)", step: 0.1 },
    { k: "batteryMax", l: "Bateria máxima (V)", step: 0.1 },
  ];
  return (
    <section className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Critérios de classificação</h2>
        <button onClick={() => setCfg(DEFAULT_CONFIG)} className="text-xs text-primary hover:underline">Restaurar padrão</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {fields.map((f) => (
          <label key={f.k} className="text-xs text-muted-foreground">{f.l}
            <input type="number" step={f.step} value={cfg[f.k]} className={selectCls}
              onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) setCfg({ ...cfg, [f.k]: n }); }} />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Cada leitura é comparada à média e ao desvio-padrão das leituras anteriores da mesma estação. Bateria usa também limites operacionais.</p>
    </section>
  );
}

function DetailPanel({ id, readings, cls, onClose }: { id: string; readings: Reading[]; cls: ReturnType<typeof classifyAll>; onClose: () => void }) {
  const [p, e] = id.split("-");
  const last = readings[0];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-6" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div><h2 className="text-xl font-semibold">Estação {e}</h2><p className="text-sm text-muted-foreground">Projeto {p} · {readings.length} leitura(s)</p></div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-2 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        {last && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Última leitura: {fmtDate(last.ts)}</p>
            {VARIABLES.map((v) => {
              const c = cls.get(last)![v.key];
              return (
                <div key={v.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between"><span className="font-medium">{v.label}</span><Badge s={c.status} /></div>
                  <p className="mt-1 font-mono text-2xl">{fmtNum(last[v.key])} <span className="text-sm text-muted-foreground">{v.unit}</span></p>
                  <p className="text-xs text-muted-foreground">Média histórica: {fmtNum(c.mean)} · Desvio: {fmtNum(c.std)} · n = {c.n}</p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
              );
            })}
          </div>
        )}
        <h3 className="mb-2 mt-6 font-semibold">Histórico</h3>
        <ul className="divide-y divide-border text-sm">
          {readings.map((r, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 py-2 font-mono text-xs">
              <span>{fmtDate(r.ts)}</span>
              <span>{VARIABLES.map((v) => `${v.label[0]} ${fmtNum(r[v.key])}`).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
