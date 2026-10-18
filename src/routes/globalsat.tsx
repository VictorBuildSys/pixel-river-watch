import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw, Satellite } from "lucide-react";
import { AppNavigation } from "@/components/AppNavigation";
import { Button } from "@/components/ui/button";
import { fetchGlobalSat } from "@/lib/globalsat.functions";
import { formatBattery, formatNotificationDate, formatNotificationNumber, type GlobalSatNotification } from "@/lib/globalsat";

export const Route = createFileRoute("/globalsat")({
  head: () => ({ meta: [
    { title: "GlobalSat — Notificações | Siivias" },
    { name: "description", content: "Notificações GlobalSat da Siivias com datas de recebimento e dispositivo, valor recebido, chuva, nível e bateria." },
    { property: "og:title", content: "GlobalSat — Notificações | Siivias" },
    { property: "og:description", content: "Acompanhe as notificações reais dos dispositivos GlobalSat na Siivias." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: GlobalSatPage,
});

function GlobalSatPage() {
  const fetchNotifications = useServerFn(fetchGlobalSat);
  const query = useQuery({ queryKey: ["globalsat"], queryFn: () => fetchNotifications(), retry: 1 });
  const rows = query.data ?? [];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><Satellite className="h-5 w-5" /></div>
            <div><p className="text-lg font-semibold leading-tight">Siivias</p><p className="text-xs text-muted-foreground">Monitoramento hidrológico</p></div>
          </div>
          <AppNavigation />
          <Button onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Atualizar notificações">
            <RefreshCw className={query.isFetching ? "motion-safe:animate-spin" : ""} /><span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-2xl font-semibold">GlobalSat</h1><p className="mt-1 text-sm text-muted-foreground">Notificações recebidas</p></div>
          {query.data && <p className="text-xs text-muted-foreground">{rows.length} notificações</p>}
        </div>
        {query.isError && <div role="alert" className="flex flex-wrap items-start gap-3 rounded-md border border-status-critical/50 bg-card p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-status-critical" />
          <div className="min-w-0 flex-1"><p className="font-medium">Não foi possível carregar as notificações</p><p className="mt-1 text-sm text-muted-foreground">{query.error.message}</p></div>
          <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>}
        {query.isPending ? <div role="status" aria-label="Carregando notificações" className="space-y-3">
          <p className="text-sm text-muted-foreground">Carregando notificações…</p>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 rounded-md bg-muted motion-safe:animate-pulse" />)}
        </div> : query.data && rows.length === 0 ? <div role="status" className="border-y border-border py-16 text-center text-muted-foreground"><Satellite className="mx-auto mb-3 h-8 w-8" />Nenhuma notificação disponível.</div> : rows.length > 0 && <>
          <div className="hidden overflow-x-auto rounded-md border border-border bg-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Notificações GlobalSat, da mais recente para a mais antiga</caption>
              <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr>
                {["ID", "Data de recebimento", "Data do dispositivo", "Valor recebido", "Chuva", "Nível", "Bateria"].map((label, i) => <th key={label} scope="col" className={`px-4 py-3 whitespace-nowrap ${i > 3 ? "text-right" : ""}`}>{label}</th>)}
              </tr></thead>
              <tbody>{rows.map((row, index) => <tr key={`${row.id}-${index}`} className="border-t border-border hover:bg-accent/50">
                <td className="px-4 py-3 font-mono">{row.id ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatNotificationDate(row.receivedAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatNotificationDate(row.deviceDate)}</td>
                <td className="px-4 py-3 font-mono text-xs break-all">{row.value ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{formatNotificationNumber(row.rain)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatNotificationNumber(row.level)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatBattery(row.battery)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">{rows.map((row, index) => <NotificationCard key={`${row.id}-${index}`} row={row} />)}</div>
        </>}
      </main>
      <footer className="mt-8 border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">Dados: SIIVIAS · GlobalSat</footer>
    </div>
  );
}

function NotificationCard({ row }: { row: GlobalSatNotification }) {
  return <article className="rounded-md border border-border bg-card p-4">
    <h2 className="mb-3 font-semibold">Notificação #{row.id ?? "—"}</h2>
    <dl className="space-y-3 text-sm">
      {[["Data de recebimento", formatNotificationDate(row.receivedAt)], ["Data do dispositivo", formatNotificationDate(row.deviceDate)], ["Valor recebido", row.value ?? "—"]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono text-xs">{value}</dd></div>)}
      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[["Chuva", formatNotificationNumber(row.rain)], ["Nível", formatNotificationNumber(row.level)], ["Bateria", formatBattery(row.battery)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono">{value}</dd></div>)}
      </div>
    </dl>
  </article>;
}