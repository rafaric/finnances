import { z } from "zod";

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
