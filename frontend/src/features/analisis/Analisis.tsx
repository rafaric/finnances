import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getAnalisisInsight, getResumenMensual, refreshAnalisisInsight } from "../../api/client";
import type { AnalisisInsightDTO, ResumenMensualDTO } from "../../api/types";
import { ErrorState } from "../../components/ErrorState";
import { PeriodPills } from "../../components/PeriodPills";
import { formatPeriod } from "../../lib/periods";

interface AnalisisProps {
  token: string;
  initialPeriod: string;
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function Analisis({ token, initialPeriod }: AnalisisProps) {
  const [periodo, setPeriodo] = useState(initialPeriod);
  const [summary, setSummary] = useState<ResumenMensualDTO>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [insight, setInsight] = useState<AnalisisInsightDTO>();
  const [insightError, setInsightError] = useState<string>();
  const [isRefreshingInsight, setIsRefreshingInsight] = useState(false);

  const leadingCategory = summary?.gastosPorCategoria[0];
  const descriptiveReading = leadingCategory
    ? `${leadingCategory.categoria.nombre} representa ${leadingCategory.porcentaje.toFixed(0)}% de los gastos confirmados de ${formatPeriod(periodo).toLowerCase()}.`
    : "Todavía no hay suficientes movimientos confirmados para describir este período.";

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(undefined);
    void getResumenMensual(token, periodo)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el análisis.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [periodo, token]);

  useEffect(() => {
    let active = true;
    setInsight(undefined);
    setInsightError(undefined);
    void getAnalisisInsight(token, periodo).then((result) => {
      if (!active) return;
      setInsight(result);
      if (result.estado === "INVALIDADO" || result.estado === "ERROR") {
        setIsRefreshingInsight(true);
        void refreshAnalisisInsight(token, periodo).then((refreshed) => { if (active) { setInsight(refreshed); setInsightError(refreshed.estado === "ERROR" ? "No se pudo generar la lectura automática." : undefined); } }).catch((requestError) => { if (active) setInsightError(requestError instanceof Error ? requestError.message : "No se pudo generar la lectura automática."); }).finally(() => { if (active) setIsRefreshingInsight(false); });
      }
    }).catch((requestError) => { if (active) setInsightError(requestError instanceof Error ? requestError.message : "No se pudo cargar la lectura."); });
    return () => { active = false; };
  }, [periodo, token]);

  async function handleRefresh() {
    setIsRefreshingInsight(true);
    try { setInsight(await refreshAnalisisInsight(token, periodo)); setInsightError(undefined); } catch (requestError) { setInsightError(requestError instanceof Error ? requestError.message : "No se pudo actualizar la lectura."); } finally { setIsRefreshingInsight(false); }
  }

  return (
    <section className="analisis-page">
      <PeriodPills value={periodo} onChange={setPeriodo} />

      {isLoading ? <div className="analysis-skeleton" role="status" aria-label="Cargando análisis"><span /><span /><span /><span /><div><span /><span /></div></div> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && summary ? (
        <>
          <section className="analysis-intro">
            <div><p className="eyebrow">LECTURA DEL PERÍODO</p><h2>Una vista clara de tus números</h2><p>Descripción basada únicamente en movimientos confirmados. Sin recomendaciones.</p></div>
            <button className="secondary-button" type="button" onClick={() => void handleRefresh()} disabled={isRefreshingInsight}>{isRefreshingInsight ? "Actualizando..." : "Actualizar análisis"}</button>
          </section>
          <section className="analysis-reading"><span className="analysis-reading-mark" aria-hidden="true"><Sparkles size={19} /></span><div><strong>{insightError ? "No se pudo cargar la lectura automática." : insight?.estado === "DISPONIBLE" && insight.contenido ? insight.contenido : insight?.estado === "GENERANDO" ? "Preparando la lectura del período..." : descriptiveReading}</strong><p>{insightError ? "Revisá la conexión o intentá actualizar nuevamente." : insight?.generadoEn ? `Actualizado ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(insight.generadoEn))}. Lectura descriptiva, sin recomendaciones.` : "Lectura descriptiva, sin recomendaciones."}</p></div></section>
          <div className="analysis-metrics">
            <article><span>Ingresos</span><strong>{currency(summary.ingresos)}</strong></article>
            <article><span>Gastos</span><strong>{currency(summary.gastos)}</strong></article>
            <article><span>Ahorro</span><strong>{currency(summary.ahorro)}</strong></article>
            <article><span>Margen</span><strong>{summary.margen.toFixed(2)}%</strong></article>
          </div>

          <section className="analysis-section analysis-category-section">
            <div className="section-heading">
              <div>
                <h2>Gastos por categoría</h2>
                <p>{formatPeriod(summary.periodo)}</p>
              </div>
            </div>
            {summary.gastosPorCategoria.length ? (
              <div className="category-breakdown">
                {summary.gastosPorCategoria.map((item) => (
                  <div className="category-breakdown-row" key={item.categoria.id}>
                    <div className="category-breakdown-label"><strong>{item.categoria.nombre}</strong><span>{item.porcentaje.toFixed(2)}%</span></div>
                    <div className="category-bar"><span style={{ width: `${Math.min(item.porcentaje, 100)}%` }} /></div>
                    <strong>{currency(item.monto)}</strong>
                  </div>
                ))}
              </div>
            ) : <div className="analysis-empty"><span>—</span><h2>Sin movimientos confirmados</h2><p>Cuando registres movimientos en este período, acá vas a ver cómo se distribuyen.</p></div>}
          </section>
        </>
      ) : null}
    </section>
  );
}
