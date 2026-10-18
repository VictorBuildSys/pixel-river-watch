import { createServerFn } from "@tanstack/react-start";
import { parseGlobalSatResponse } from "./globalsat-response";

// Same server proxy pattern as hydrology: upstream does not provide browser CORS.
export const fetchGlobalSat = createServerFn({ method: "GET" }).handler(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://siivias.runasp.net/v1/GlobalStar/ListarDados", {
      signal: controller.signal,
      headers: { accept: "application/json, application/xml, text/xml" },
    });
    if (!response.ok) throw new Error(`A GlobalSat respondeu com erro ${response.status}.`);
    return parseGlobalSatResponse(await response.text());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Tempo de resposta da GlobalSat esgotado.");
    throw error instanceof Error ? error : new Error("Falha de comunicação com a GlobalSat.");
  } finally { clearTimeout(timeout); }
});