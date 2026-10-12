import { describe, expect, it } from "vitest";
import { classify, parseReadings } from "@/lib/hydro";

const hist = [10, 11, 9, 10, 11, 9, 10]; // mean 10, std 0.816

describe("classify", () => {
  it("normal near mean", () => expect(classify(10.5, hist, "nivel").status).toBe("normal"));
  it("blue when well below mean", () => expect(classify(8, hist, "nivel").status).toBe("low"));
  it("orange when above mean", () => expect(classify(11.6, hist, "nivel").status).toBe("high"));
  it("red when far above mean", () => expect(classify(13, hist, "nivel").status).toBe("critical"));
  it("insufficient history", () => expect(classify(50, [1, 2], "nivel").status).toBe("insufficient"));
  it("null value", () => expect(classify(null, hist, "nivel").status).toBe("nodata"));
  it("battery below 11.5V is critical regardless of history", () =>
    expect(classify(11.2, [], "bateria").status).toBe("critical"));
  it("battery below 12V is attention", () => expect(classify(11.8, [], "bateria").status).toBe("high"));
});

describe("parseReadings", () => {
  it("rejects non-array", () => expect(() => parseReadings({})).toThrow());
  it("drops malformed rows and sorts desc", () => {
    const r = parseReadings([
      { dataHora: "2024-01-01T00:00:00", idProjeto: 1, idEstacao: 2, chuva: 0, nivel: 1, bateria: 13, vasao: 0 },
      { dataHora: "bad", idProjeto: 1, idEstacao: 2 },
      { dataHora: "2025-01-01T00:00:00", idProjeto: 1, idEstacao: 2, nivel: null },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]?.dataHora).toBe("2025-01-01T00:00:00");
    expect(r[0]?.nivel).toBeNull();
  });
});
