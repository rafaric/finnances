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

export async function analizarResumenConGemini(pdf: RenderedPdf): Promise<GeminiResumen> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");

  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const parts = [
    {
      text: "Analizá estas páginas de un resumen de tarjeta argentino. Extraé únicamente datos visibles. No inventes ni sumes valores. Extraé fecha de cierre y fecha de vencimiento completas como YYYY-MM-DD; son obligatorias si están impresas y determinan el período contable del resumen. Extraé cada fila de consumo individual del bloque de movimientos, ignorando SALDO ANTERIOR, PAGOS, TOTALES, cargos financieros, límites y cuotas futuras. Para cada consumo devolvé fecha, comercio, monto positivo, moneda (ARS o USD) y número de cuota actual/total si aparece como 6/9. Conservá la moneda impresa: no conviertas USD a ARS. Extraé por separado el total de consumos en pesos (totalConsumos), el total de consumos en dólares (totalConsumosUSD) y el saldo actual en dólares (saldoUSD), si aparecen. El período debe tener formato YYYY-MM como respaldo. ultimosDigitos debe contener exactamente los últimos cuatro dígitos si aparecen. Extraé por separado cada línea si aparece: intereses, impuestos generales, comisiones, seguros, IVA INTERESES, IVA COMISIONES, IVA sobre impuestos y IMPUESTO AL SELLO. No mezcles IVA COMISIONES o IVA INTERESES dentro del importe base. confianza debe representar tu confianza global entre 0 y 1. Si un dato no aparece, devolvé null.",
    },
    ...pdf.pages.map((page) => ({
      inlineData: { mimeType: page.mimeType, data: page.data.toString("base64") },
    })),
  ];

  let response;
  try {
    response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema,
        temperature: 0,
      maxOutputTokens: 3000,
      },
    });
  } catch {
    throw new Error("No se pudo analizar el resumen con Gemini");
  }

  return parseGeminiResumenResponse(response.text ?? "");
}
