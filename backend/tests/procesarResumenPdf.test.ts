import { renderProtectedPdf } from "../src/services/procesarResumenPdf";

async function run() {
  const previousPassword = process.env.BANK_STATEMENT_PDF_PASSWORD;

  try {
    delete process.env.BANK_STATEMENT_PDF_PASSWORD;
    let missingPassword = false;
    try {
      await renderProtectedPdf(Buffer.from("not-a-pdf"));
    } catch (error) {
      missingPassword = error instanceof Error && error.message === "BANK_STATEMENT_PDF_PASSWORD no está configurada";
    }
    if (!missingPassword) throw new Error("missing password should be rejected");

    process.env.BANK_STATEMENT_PDF_PASSWORD = "test-password";
    let invalidPdf = false;
    try {
      await renderProtectedPdf(Buffer.from("not-a-pdf"));
    } catch (error) {
      invalidPdf = error instanceof Error && error.message === "No se pudo desbloquear el PDF. Verificá la contraseña o el archivo.";
    }
    if (!invalidPdf) throw new Error("invalid PDF should be rejected");

    console.log("✓ protected PDF renderer validates configuration and rejects invalid files");
  } finally {
    if (previousPassword === undefined) delete process.env.BANK_STATEMENT_PDF_PASSWORD;
    else process.env.BANK_STATEMENT_PDF_PASSWORD = previousPassword;
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
