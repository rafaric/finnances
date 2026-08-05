import "dotenv/config";
import { interpretarConGemini } from "../src/services/geminiOCR";

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const result = await interpretarConGemini(
    "Compra en Supermercado Día. Total: $1.250,00. Fecha: 03/08/2026.",
  );
  if (!result) throw new Error("Gemini returned no result");
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Gemini smoke test failed");
  process.exitCode = 1;
});
