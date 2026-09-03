import { z } from "zod";
import type { RenderedPdf } from "./procesarResumenPdf";

const GeminiOCRResultSchema = z.object({
  monto: z.number().positive().nullable(),
  comercio: z.string().min(1).nullable(),
  fecha: z.string().min(1).nullable(),
  categoria: z.string().min(1).nullable(),
  esTransferenciaAPersona: z.boolean(),
});

export type GeminiOCRResult = z.infer<typeof GeminiOCRResultSchema>;

export function parseGeminiOCRResponse(text: string): GeminiOCRResult {
  return GeminiOCRResultSchema.parse(JSON.parse(text));
}

const responseJsonSchema = {
  type: "object",
  properties: {
    monto: { type: ["number", "null"] },
    comercio: { type: ["string", "null"] },
    fecha: { type: ["string", "null"] },
    categoria: { type: ["string", "null"] },
    esTransferenciaAPersona: { type: "boolean" },
  },
  required: ["monto", "comercio", "fecha", "categoria", "esTransferenciaAPersona"],
};

export async function interpretarConGemini(textoCrudo: string): Promise<GeminiOCRResult | undefined> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return undefined;
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
    contents: `Extraé datos financieros del siguiente texto de comprobante. No inventes valores; usa null si un dato no aparece. Las fechas están en formato argentino DD/MM/YYYY; convertílas siempre a YYYY-MM-DD sin invertir día y mes. La categoría debe ser una de: COMIDA, TRANSPORTE, VIVIENDA, SERVICIOS, OCIO, DEUDAS, OTROS. Marca esTransferenciaAPersona como true solo cuando el destinatario sea claramente una persona física; no uses "Transferencia inmediata" como señal.\n\nTexto:\n${textoCrudo}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,
      temperature: 0,
      maxOutputTokens: 300,
    },
  });

  return parseGeminiOCRResponse(response.text ?? "");
}

export async function extraerTextoComprobantePdf(pdf: RenderedPdf): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
    contents: [{ role: "user", parts: [
      { text: "Transcribí literalmente todo el texto visible de este comprobante de transferencia. No resumas, no inventes datos y conservá importes, fechas, nombres, alias, CBU/CVU y referencias." },
      ...pdf.pages.map((page) => ({ inlineData: { mimeType: page.mimeType, data: page.data.toString("base64") } })),
    ] }],
    config: { temperature: 0, maxOutputTokens: 1200 },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini no pudo extraer texto del comprobante PDF");
  return text;
}
