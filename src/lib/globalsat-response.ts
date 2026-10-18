import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parseNotifications } from "./globalsat";

export function parseGlobalSatResponse(body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("A GlobalSat retornou uma resposta vazia.");
  if (!trimmed.startsWith("<")) {
    let json: unknown;
    try { json = JSON.parse(trimmed); }
    catch { throw new Error("A GlobalSat retornou uma resposta inválida."); }
    return parseNotifications(json);
  }
  if (XMLValidator.validate(trimmed) !== true) throw new Error("A GlobalSat retornou XML inválido.");
  const parsed = new XMLParser({ parseTagValue: false, trimValues: false, ignoreAttributes: true, removeNSPrefix: true }).parse(trimmed);
  const root = parsed.ArrayOfDadosItemOut;
  if (root === undefined) throw new Error("Resposta inválida da GlobalSat: formato XML inesperado.");
  const rows = root?.DadosItemOut;
  return parseNotifications(rows === undefined ? [] : Array.isArray(rows) ? rows : [rows]);
}