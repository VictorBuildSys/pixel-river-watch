export interface GlobalSatNotification {
  id: string | null;
  receivedAt: string | null;
  deviceDate: string | null;
  value: string | null;
  rain: number | null;
  level: number | null;
  battery: string | null;
}

const text = (value: unknown): string | null =>
  typeof value === "string" ? value || null : typeof value === "number" && Number.isFinite(value) ? String(value) : null;

function numeric(value: unknown): number | null {
  const raw = text(value);
  if (raw === null || !raw.trim()) return null;
  const result = Number(raw.replace(",", "."));
  return Number.isFinite(result) ? result : null;
}

// Validate each calendar component: Date.parse alone silently rolls invalid dates forward.
export function notificationTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined) return null;
  if (hour > 23 || minute > 59 || second > 59 || month < 1 || month > 12 || day < 1) return null;
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (match[7]) {
    const zoned = Date.parse(value.trim().replace(/\//g, "-"));
    return Number.isFinite(zoned) ? zoned : null;
  }
  return timestamp;
}

export function formatNotificationDate(value: string | null): string {
  const timestamp = notificationTimestamp(value);
  if (timestamp === null) return value ?? "—";
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export const formatNotificationNumber = (value: number | null): string =>
  value === null ? "—" : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBattery(value: string | null): string {
  const number = numeric(value);
  return number === null ? value ?? "—" : number.toLocaleString("pt-BR", { maximumFractionDigits: 20 });
}

export function parseNotifications(data: unknown): GlobalSatNotification[] {
  if (!Array.isArray(data)) throw new Error("Resposta inválida da GlobalSat: lista de notificações esperada.");
  return data.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Resposta inválida da GlobalSat: registro inesperado.");
    const row = item as Record<string, unknown>;
    const field = (name: string) => row[name] ?? row[name.charAt(0).toLowerCase() + name.slice(1)];
    if (!["Id", "Data", "Value", "StrData", "Chuva", "Nivel", "Bateria"].some((name) => name in row || name.charAt(0).toLowerCase() + name.slice(1) in row)) {
      throw new Error("Resposta inválida da GlobalSat: campos não reconhecidos.");
    }
    return {
      id: text(field("Id")), receivedAt: text(field("Data")), deviceDate: text(field("StrData")),
      value: text(field("Value")), rain: numeric(field("Chuva")), level: numeric(field("Nivel")), battery: text(field("Bateria")),
    };
  }).sort((a, b) => (notificationTimestamp(b.receivedAt) ?? -Infinity) - (notificationTimestamp(a.receivedAt) ?? -Infinity));
}