import { describe, expect, it } from "vitest";
import { sortActiveRecurrentes } from "./sortRecurrentes";
import type { GastoRecurrenteResponseDTO } from "../../api/types";

function rule(id: string, day: number): GastoRecurrenteResponseDTO {
  return { id, nombre: id, tipoMonto: "FIJO", montoFijo: 100, cuenta: {} as GastoRecurrenteResponseDTO["cuenta"], categoria: {} as GastoRecurrenteResponseDTO["categoria"], frecuencia: "MENSUAL", diaDelMes: day, activo: true };
}

describe("sortActiveRecurrentes", () => {
  it("sorts by nearest upcoming due date and uses id as a stable tie-breaker", () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    expect(sortActiveRecurrentes([rule("later", 20), rule("today", 8), rule("next", 10)], now).map((item) => item.id)).toEqual(["today", "next", "later"]);
  });

  it("places rules without a due day after dated rules", () => {
    const missing = { ...rule("missing", 1), diaDelMes: undefined };
    expect(sortActiveRecurrentes([missing, rule("dated", 20)], new Date("2026-09-08T12:00:00.000Z")).map((item) => item.id)).toEqual(["dated", "missing"]);
  });
});
