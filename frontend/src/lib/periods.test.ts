import { describe, expect, it } from "vitest";
import { currentPeriod, formatPeriod, shiftPeriod } from "./periods";

describe("period helpers", () => {
  it("uses the local calendar month for the current period", () => {
    expect(currentPeriod(new Date(2026, 7, 5, 12))).toBe("2026-08");
  });

  it("shifts periods across year boundaries", () => {
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
  });

  it("formats the period without applying the local timezone offset", () => {
    expect(formatPeriod("2026-08")).toContain("ago");
  });
});
