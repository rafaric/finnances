import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_PAGES = 20;

export interface RenderedPdfPage {
  pageNumber: number;
  mimeType: "image/png";
  data: Buffer;
}

export interface RenderedPdf {
  pages: RenderedPdfPage[];
}

function pdfError(message: string): Error {
  return new Error(message);
}

export async function renderProtectedPdf(input: Buffer): Promise<RenderedPdf> {
  const password = process.env.BANK_STATEMENT_PDF_PASSWORD;
  if (input.length === 0) throw pdfError("El archivo PDF está vacío");

  const directory = await mkdtemp(join(tmpdir(), "finnances-statement-"));
  const sourcePath = join(directory, "original.pdf");
  const passwordPath = join(directory, "password.txt");
  const decryptedPath = join(directory, "decrypted.pdf");
  const outputPrefix = join(directory, "page");

  try {
    await writeFile(sourcePath, input);
    try {
      const encryption = await execFileAsync("qpdf", ["--show-encryption", sourcePath]);
      if (/not encrypted/i.test(encryption.stdout)) {
        await copyFile(sourcePath, decryptedPath);
      } else {
        if (!password) throw pdfError("BANK_STATEMENT_PDF_PASSWORD no está configurada");
        await writeFile(passwordPath, password, { mode: 0o600 });
        await execFileAsync("qpdf", [`--password-file=${passwordPath}`, "--decrypt", sourcePath, decryptedPath]);
      }
    } catch {
      if (!password) throw pdfError("BANK_STATEMENT_PDF_PASSWORD no está configurada");
      throw pdfError("No se pudo desbloquear el PDF. Verificá la contraseña o el archivo.");
    }

    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-f",
        "1",
        "-l",
        String(MAX_PAGES),
        decryptedPath,
        outputPrefix,
      ]);
    } catch {
      throw pdfError("No se pudo convertir el PDF a imágenes.");
    }

    const filenames = (await readdir(directory))
      .filter((filename) => /^page-\d+\.png$/.test(filename))
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]));

    if (filenames.length === 0) throw pdfError("El PDF no contiene páginas renderizables");

    return {
      pages: await Promise.all(filenames.map(async (filename) => ({
        pageNumber: Number(filename.match(/\d+/)?.[0]),
        mimeType: "image/png" as const,
        data: await readFile(join(directory, filename)),
      }))),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
