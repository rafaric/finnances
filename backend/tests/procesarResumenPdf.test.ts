import { renderProtectedPdf } from "../src/services/procesarResumenPdf";

async function run() {
  const previousPassword = process.env.BANK_STATEMENT_PDF_PASSWORD;

  try {
    delete process.env.BANK_STATEMENT_PDF_PASSWORD;
    let invalidPdfWithoutPassword = false;
    try {
      await renderProtectedPdf(Buffer.from("not-a-pdf"));
    } catch (error) {
      invalidPdfWithoutPassword = error instanceof Error;
    }
    if (!invalidPdfWithoutPassword) throw new Error("invalid PDF should be rejected without password");

    process.env.BANK_STATEMENT_PDF_PASSWORD = "test-password";
    let invalidPdf = false;
    try {
      await renderProtectedPdf(Buffer.from("not-a-pdf"));
    } catch (error) {
      invalidPdf = error instanceof Error;
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
