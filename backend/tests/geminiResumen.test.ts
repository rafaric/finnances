import { parseGeminiResumenResponse } from "../src/services/geminiResumen";

const valid = JSON.stringify({
  consumos: [{ fecha: "2026-07-02", comercio: "Óptica", monto: 100, cuotaActual: 1, cuotasTotales: 3 }],
  entidad: "Banco Test",
  ultimosDigitos: "1234",
  periodo: "2026-08",
  montoTotal: 1000,
  montoMinimo: 100,
  totalConsumos: 900,
  saldoFinanciado: 0,
  intereses: null,
  impuestos: 10,
  comisiones: null,
  seguros: null,
  ivaIntereses: null,
  ivaComisiones: null,
  ivaImpuestos: null,
  impuestoSello: null,
  confianza: 0.95,
});

const parsed = parseGeminiResumenResponse(valid);
if (parsed.periodo !== "2026-08" || parsed.ultimosDigitos !== "1234") throw new Error("valid summary was not parsed");
const parsedWithTrailingComma = parseGeminiResumenResponse(`${valid.slice(0, -1)},}`);
if (parsedWithTrailingComma.consumos.length !== 1) throw new Error("trailing comma response was not parsed");

let rejected = false;
try {
  parseGeminiResumenResponse(valid.replace("2026-08", "agosto"));
} catch {
  rejected = true;
}
if (!rejected) throw new Error("invalid period should be rejected");

console.log("✓ Gemini summary response validation passed");
