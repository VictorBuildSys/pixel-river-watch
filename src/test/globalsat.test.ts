import { describe, expect, it } from "vitest";
import { formatBattery, formatNotificationDate, formatNotificationNumber, parseNotifications } from "@/lib/globalsat";
import { parseGlobalSatResponse } from "@/lib/globalsat-response";

const record = { Id: 61, Data: "2026-10-06T13:52:10", Value: "0x00D7B6ECDD1BEF0A00", StrData: "2030/8/29 27:47:00", Chuva: 0.87, Nivel: 70.2, Bateria: 1 };

describe("GlobalSat data rules", () => {
  it("formats reception date with seconds in Brazilian format", () => expect(formatNotificationDate(record.Data)).toBe("06/10/2026 13:52:10"));
  it("preserves device date when its hour is invalid", () => expect(formatNotificationDate(record.StrData)).toBe("2030/8/29 27:47:00"));
  it("rejects calendar rollover rather than changing device content", () => expect(formatNotificationDate("2026/2/30 12:00:00")).toBe("2026/2/30 12:00:00"));
  it("formats a valid device date", () => expect(formatNotificationDate("2026/8/29 17:47:00")).toBe("29/08/2026 17:47:00"));
  it("uses two decimals for rain", () => expect(formatNotificationNumber(0.87)).toBe("0,87"));
  it("uses two decimals for level", () => expect(formatNotificationNumber(70.2)).toBe("70,20"));
  it("does not add an assumed unit or percentage to battery", () => expect(formatBattery("2.6")).toBe("2,6"));
  it("preserves hexadecimal value", () => expect(parseNotifications([record])[0]?.value).toBe("0x00D7B6ECDD1BEF0A00"));
  it("orders by reception date, not ID or device date", () => {
    const result = parseNotifications([{ ...record, Id: 99, Data: "2026-10-05T13:52:10" }, record]);
    expect(result.map((r) => r.id)).toEqual(["61", "99"]);
  });
  it("handles null and zero values distinctly", () => {
    const [row] = parseNotifications([{ ...record, Chuva: null, Nivel: 0, Bateria: null }]);
    expect(row?.rain).toBeNull(); expect(row?.level).toBe(0); expect(row?.battery).toBeNull();
    expect(formatNotificationNumber(null)).toBe("—"); expect(formatBattery(null)).toBe("—");
  });
});

describe("GlobalSat API formats", () => {
  it("parses XML without corrupting original device date or hexadecimal", () => {
    const xml = `<ArrayOfDadosItemOut><DadosItemOut>${Object.entries(record).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</DadosItemOut></ArrayOfDadosItemOut>`;
    const [row] = parseGlobalSatResponse(xml);
    expect(row?.deviceDate).toBe(record.StrData); expect(row?.value).toBe(record.Value); expect(row?.rain).toBe(0.87);
  });
  it("accepts camelCase JSON", () => expect(parseGlobalSatResponse('[{"id":61,"chuva":0.87}]')[0]?.rain).toBe(0.87));
  it("returns no notifications for an empty XML list", () => expect(parseGlobalSatResponse("<ArrayOfDadosItemOut />")).toEqual([]));
  it("returns no notifications for an empty JSON list", () => expect(parseGlobalSatResponse("[]")).toEqual([]));
  it("rejects malformed responses", () => {
    for (const body of ["", "not json", "{}", "<html></html>", "<ArrayOfDadosItemOut>"]) expect(() => parseGlobalSatResponse(body)).toThrow();
  });
});