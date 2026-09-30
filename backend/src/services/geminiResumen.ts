import { z } from "zod";
import type { RenderedPdf } from "./procesarResumenPdf";

const GeminiResumenSchema = z.object({
  consumos: z.array(z.object({
    fecha: z.string().nullable(),
    comercio: z.string().min(1).nullable(),
    monto: z.number().nonnegative(),
    cuotaActual: z.number().int().positive().nullable(),
    cuotasTotales: z.number().int().positive().nullable(),
    moneda: z.enum(["ARS", "USD"]).default("ARS"),
  })),
  entidad: z.string().min(1).nullable(),
  ultimosDigitos: z.string().regex(/^\d{4}$/).nullable(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  fechaCierre: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  montoTotal: z.number().nonnegative().nullable(),
  montoMinimo: z.number().nonnegative().nullable(),
  totalConsumos: z.number().nonnegative().nullable(),
  totalConsumosUSD: z.number().nonnegative().nullable(),
  saldoUSD: z.number().nonnegative().nullable(),
  saldoFinanciado: z.number().nonnegative().nullable(),
  intereses: z.number().nonnegative().nullable(),
  impuestos: z.number().nonnegative().nullable(),
  comisiones: z.number().nonnegative().nullable(),
  seguros: z.number().nonnegative().nullable(),
  ivaIntereses: z.number().nonnegative().nullable(),
  ivaComisiones: z.number().nonnegative().nullable(),
  ivaImpuestos: z.number().nonnegative().nullable(),
  impuestoSello: z.number().nonnegative().nullable(),
  confianza: z.number().min(0).max(1),
});

export type GeminiResumen = z.infer<typeof GeminiResumenSchema>;

const responseJsonSchema = {
  type: "object",
  properties: {
    consumos: { type: "array", items: { type: "object", properties: {
       fecha: { type: ["string", "null"] }, comercio: { type: ["string", "null"] }, monto: { type: "number" }, moneda: { type: "string", enum: ["ARS", "USD"] },
      cuotaActual: { type: ["integer", "null"] }, cuotasTotales: { type: ["integer", "null"] },
    }, required: ["fecha", "comercio", "monto", "cuotaActual", "cuotasTotales"] } },
    entidad: { type: ["string", "null"] },
    ultimosDigitos: { type: ["string", "null"] },
    periodo: { type: ["string", "null"] },
    fechaCierre: { type: ["string", "null"] },
    fechaVencimiento: { type: ["string", "null"] },
    montoTotal: { type: ["number", "null"] },
    montoMinimo: { type: ["number", "null"] },
    totalConsumos: { type: ["number", "null"] },
    totalConsumosUSD: { type: ["number", "null"] },
    saldoUSD: { type: ["number", "null"] },
    saldoFinanciado: { type: ["number", "null"] },
    intereses: { type: ["number", "null"] },
    impuestos: { type: ["number", "null"] },
    comisiones: { type: ["number", "null"] },
    seguros: { type: ["number", "null"] },
    ivaIntereses: { type: ["number", "null"] },
    ivaComisiones: { type: ["number", "null"] },
    ivaImpuestos: { type: ["number", "null"] },
    impuestoSello: { type: ["number", "null"] },
    confianza: { type: "number" },
  },
  required: [
    "consumos", "entidad", "ultimosDigitos", "periodo", "fechaCierre", "fechaVencimiento", "montoTotal", "montoMinimo",
    "totalConsumos", "totalConsumosUSD", "saldoUSD", "saldoFinanciado", "intereses", "impuestos", "comisiones",
    "seguros", "ivaIntereses", "ivaComisiones", "ivaImpuestos", "impuestoSello", "confianza",
  ],
};

export function parseGeminiResumenResponse(text: string): GeminiResumen {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/,\s*([}\]])/g, "$1");
  try {
    return GeminiResumenSchema.parse(JSON.parse(normalized));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Gemini devolvió una respuesta incompleta; intentá analizar el resumen nuevamente");
    throw error;
  }
}

const PAGE_CHUNK_SIZE = 2;

function firstDefined<T>(values: Array<T | null>): T | null {
  return values.find((value) => value != null) ?? null;
}

function moneyValue(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  return present.length ? Math.max(...present) : null;
}

function consumoFingerprint(consumo: GeminiResumen["consumos"][number]): string {
  return [consumo.fecha ?? "", consumo.comercio?.trim().toLowerCase() ?? "", consumo.monto.toFixed(2), consumo.moneda,
    consumo.cuotaActual ?? "", consumo.cuotasTotales ?? ""].join("|");
}

/** Merges page/chunk responses without summing statement totals repeated on every page. */
export function mergeGeminiResumenes(results: GeminiResumen[]): GeminiResumen {
  if (results.length === 0) throw new Error("Gemini no devolvió datos del resumen");
  const consumos = new Map<string, GeminiResumen["consumos"][number]>();
  for (const result of results) for (const consumo of result.consumos) consumos.set(consumoFingerprint(consumo), consumo);
  return {
    ...results[0],
    consumos: [...consumos.values()],
    entidad: firstDefined(results.map((result) => result.entidad)),
    ultimosDigitos: firstDefined(results.map((result) => result.ultimosDigitos)),
    periodo: firstDefined(results.map((result) => result.periodo)),
    fechaCierre: firstDefined(results.map((result) => result.fechaCierre)),
    fechaVencimiento: firstDefined(results.map((result) => result.fechaVencimiento)),
    montoTotal: moneyValue(results.map((result) => result.montoTotal)),
    montoMinimo: moneyValue(results.map((result) => result.montoMinimo)),
    totalConsumos: moneyValue(results.map((result) => result.totalConsumos)),
    totalConsumosUSD: moneyValue(results.map((result) => result.totalConsumosUSD)),
    saldoUSD: moneyValue(results.map((result) => result.saldoUSD)),
    saldoFinanciado: moneyValue(results.map((result) => result.saldoFinanciado)),
    intereses: moneyValue(results.map((result) => result.intereses)),
    impuestos: moneyValue(results.map((result) => result.impuestos)),
    comisiones: moneyValue(results.map((result) => result.comisiones)),
    seguros: moneyValue(results.map((result) => result.seguros)),
    ivaIntereses: moneyValue(results.map((result) => result.ivaIntereses)),
    ivaComisiones: moneyValue(results.map((result) => result.ivaComisiones)),
    ivaImpuestos: moneyValue(results.map((result) => result.ivaImpuestos)),
    impuestoSello: moneyValue(results.map((result) => result.impuestoSello)),
    confianza: Math.min(...results.map((result) => result.confianza)),
  };
}

function boundedCause(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/AIza[\w-]+/g, "[redacted]").replace(/\s+/g, " ").slice(0, 180);
}

export async function analizarResumenConGemini(pdf: RenderedPdf): Promise<GeminiResumen> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");

  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const instruction = "Analizá estas páginas de un resumen de tarjeta argentino. Extraé únicamente datos visibles. No inventes ni sumes valores. Extraé fecha de cierre y fecha de vencimiento completas como YYYY-MM-DD; son obligatorias si están impresas y determinan el período contable del resumen. Extraé cada fila de consumo individual del bloque de movimientos, ignorando SALDO ANTERIOR, PAGOS, TOTALES, cargos financieros, límites y cuotas futuras. Para cada consumo devolvé fecha, comercio, monto positivo, moneda (ARS o USD) y número de cuota actual/total si aparece como 6/9. Conservá la moneda impresa: no conviertas USD a ARS. Extraé por separado el total de consumos en pesos (totalConsumos), el total de consumos en dólares (totalConsumosUSD) y el saldo actual en dólares (saldoUSD), si aparecen. El período debe tener formato YYYY-MM como respaldo. ultimosDigitos debe contener exactamente los últimos cuatro dígitos si aparecen. Extraé por separado cada línea si aparece: intereses, impuestos generales, comisiones, seguros, IVA INTERESES, IVA COMISIONES, IVA sobre impuestos y IMPUESTO AL SELLO. No mezcles IVA COMISIONES o IVA INTERESES dentro del importe base. confianza debe representar tu confianza global entre 0 y 1. Si un dato no aparece, devolvé null.";
  const results: GeminiResumen[] = [];
  for (let index = 0; index < pdf.pages.length; index += PAGE_CHUNK_SIZE) {
    const pages = pdf.pages.slice(index, index + PAGE_CHUNK_SIZE);
    try {
      const response = await client.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
        contents: [{ role: "user", parts: [{ text: instruction }, ...pages.map((page) => ({ inlineData: { mimeType: page.mimeType, data: page.data.toString("base64") } }))] }],
        config: { responseMimeType: "application/json", responseJsonSchema, temperature: 0, maxOutputTokens: 3000 },
      });
      results.push(parseGeminiResumenResponse(response.text ?? ""));
    } catch (error) {
      console.error(`Resumen Gemini chunk ${index / PAGE_CHUNK_SIZE + 1} failed: ${boundedCause(error)}`);
      throw new Error("No se pudo analizar el resumen con Gemini");
    }
  }
  return mergeGeminiResumenes(results);
}
