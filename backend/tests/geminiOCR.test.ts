import { parseGeminiOCRResponse } from "../src/services/geminiOCR";

function run() {
  const parsed = parseGeminiOCRResponse(JSON.stringify({
    monto: 1250,
    comercio: "Supermercado",
    fecha: "2026-08-03",
    categoria: "COMIDA",
    esTransferenciaAPersona: false,
  }));
  if (parsed.monto !== 1250 || parsed.categoria !== "COMIDA") {
    throw new Error("Expected valid Gemini OCR response to be parsed");
  }

  let rejected = false;
  try {
    parseGeminiOCRResponse("not-json");
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Expected malformed Gemini response to be rejected");

  console.log("✓ Gemini OCR response validation passed");
}

run();
