import { createServerFn } from "@tanstack/react-start";

const API_URL = "https://siivias.runasp.net/v1/DashBoard/ListarHistorico";

// Proxy: the upstream API sends no CORS headers, so the browser cannot call it directly.
export const fetchHistorico = createServerFn({ method: "GET" }).handler(async () => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(API_URL, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`A API respondeu com erro ${res.status}.`);
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("A API retornou uma resposta que não é JSON válido.");
    }
    if (!Array.isArray(data)) throw new Error("Resposta inválida da API: formato inesperado.");
    return data as Record<string, unknown>[];
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Tempo de resposta da API esgotado.");
    throw e instanceof Error ? e : new Error("Falha de comunicação com a API.");
  } finally {
    clearTimeout(t);
  }
});
