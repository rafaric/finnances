import { createHash } from "node:crypto";
import { EstadoInsight, PrismaClient } from "@prisma/client";
import { calcularResumenMensual, type ResumenMensualData } from "./resumenMensual";

const timers = new Map<string, NodeJS.Timeout>();

export interface AnalisisInsightDTO {
  periodo: string;
  contenido?: string;
  estado: EstadoInsight;
  generadoEn?: string;
  invalidadoEn: string;
}

function hashResumen(resumen: ResumenMensualData): string {
  return createHash("sha256").update(JSON.stringify(resumen)).digest("hex");
}

function deterministicFallback(resumen: ResumenMensualData): string {
  if (!resumen.gastosPorCategoria.length) return "Todavía no hay suficientes movimientos confirmados para describir este período.";
  const leading = resumen.gastosPorCategoria[0];
  return `${leading.categoria.nombre} representa ${leading.porcentaje.toFixed(0)}% de los gastos confirmados del período. Esta lectura describe los datos disponibles y no constituye una recomendación.`;
}

function toDTO(insight: {
  periodo: string;
  contenido: string;
  estado: EstadoInsight;
  generadoEn: Date | null;
  invalidadoEn: Date;
}): AnalisisInsightDTO {
  return {
    periodo: insight.periodo,
    contenido: insight.contenido || undefined,
    estado: insight.estado,
    generadoEn: insight.generadoEn?.toISOString(),
    invalidadoEn: insight.invalidadoEn.toISOString(),
  };
}

async function generateWithGemini(resumen: ResumenMensualData): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return deterministicFallback(resumen);
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
    contents: `Redactá una única observación financiera descriptiva y prudente en español rioplatense, de máximo 240 caracteres. Usá solamente los datos JSON provistos. No recomiendes acciones, no juzgues hábitos, no inventes comparaciones y no menciones que sos una IA. Si no hay datos suficientes, indicá exactamente eso. JSON: ${JSON.stringify({ periodo: resumen.periodo, ingresos: resumen.ingresos, gastos: resumen.gastos, ahorro: resumen.ahorro, margen: resumen.margen, gastosPorCategoria: resumen.gastosPorCategoria.slice(0, 5), gastosProyectados: resumen.gastosProyectados })}`,
    config: { temperature: 0, maxOutputTokens: 120 },
  });
  const content = response.text?.trim();
  if (!content) throw new Error("Gemini no devolvió una observación");
  return content.replace(/^['"]|['"]$/g, "");
}

export async function getAnalisisInsight(prisma: PrismaClient, periodo: string): Promise<AnalisisInsightDTO> {
  const resumen = await calcularResumenMensual(prisma, periodo);
  const hash = hashResumen(resumen);
  const current = await prisma.analisisInsight.findUnique({ where: { periodo } });
  if (current?.estado === EstadoInsight.DISPONIBLE && current.huellaDatos === hash) return toDTO(current);
  if (!current) {
    const created = await prisma.analisisInsight.create({ data: { periodo, contenido: "", estado: EstadoInsight.INVALIDADO, huellaDatos: hash } });
    return toDTO(created);
  }
  return toDTO(current);
}

export async function refreshAnalisisInsight(prisma: PrismaClient, periodo: string): Promise<AnalisisInsightDTO> {
  const resumen = await calcularResumenMensual(prisma, periodo);
  const hash = hashResumen(resumen);
  const current = await prisma.analisisInsight.upsert({
    where: { periodo },
    create: { periodo, contenido: "", estado: EstadoInsight.GENERANDO, huellaDatos: hash },
    update: { estado: EstadoInsight.GENERANDO, huellaDatos: hash, error: null },
  });
  try {
    const contenido = await generateWithGemini(resumen);
    return toDTO(await prisma.analisisInsight.update({ where: { id: current.id }, data: { contenido, estado: EstadoInsight.DISPONIBLE, generadoEn: new Date(), huellaDatos: hash, error: null } }));
  } catch (error) {
    const failed = await prisma.analisisInsight.update({ where: { id: current.id }, data: { estado: EstadoInsight.ERROR, error: error instanceof Error ? error.message : "No se pudo generar el análisis." } });
    return toDTO(failed);
  }
}

export async function invalidarAnalisisInsight(prisma: PrismaClient, periodo: string): Promise<void> {
  await prisma.analisisInsight.upsert({
    where: { periodo },
    create: { periodo, contenido: "", estado: EstadoInsight.INVALIDADO },
    update: { estado: EstadoInsight.INVALIDADO, invalidadoEn: new Date() },
  });
  const pendingTimer = timers.get(periodo);
  if (pendingTimer) clearTimeout(pendingTimer);
  const nextTimer = setTimeout(() => { timers.delete(periodo); void refreshAnalisisInsight(prisma, periodo); }, 90_000);
  nextTimer.unref();
  timers.set(periodo, nextTimer);
}
