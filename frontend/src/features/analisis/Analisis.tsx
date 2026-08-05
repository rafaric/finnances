import { useEffect, useState } from "react";
import { getResumenMensual } from "../../api/client";
import type { ResumenMensualDTO } from "../../api/types";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
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

  return (
    <section className="analisis-page">
      <PeriodPills value={periodo} onChange={setPeriodo} />

      {isLoading ? <LoadingState label="Cargando análisis..." /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && summary ? (
        <>
          <div className="analysis-metrics">
            <article><span>Ingresos</span><strong>{currency(summary.ingresos)}</strong></article>
            <article><span>Gastos</span><strong>{currency(summary.gastos)}</strong></article>
            <article><span>Ahorro</span><strong>{currency(summary.ahorro)}</strong></article>
            <article><span>Margen</span><strong>{summary.margen.toFixed(2)}%</strong></article>
          </div>

          <section className="analysis-section">
            <div className="section-heading">
              <div>
                <h2>Gastos por categoría</h2>
                <p>{formatPeriod(summary.periodo)}</p>
              </div>
            </div>
            {summary.gastosPorCategoria.length ? (
              <div className="category-breakdown">
                {summary.gastosPorCategoria.map((item) => (
                  <div className="category-breakdown-row" key={item.categoria}>
                    <div className="category-breakdown-label"><strong>{item.categoria}</strong><span>{item.porcentaje.toFixed(2)}%</span></div>
                    <div className="category-bar"><span style={{ width: `${Math.min(item.porcentaje, 100)}%` }} /></div>
                    <strong>{currency(item.monto)}</strong>
                  </div>
                ))}
              </div>
            ) : <div className="empty-page"><h2>Sin movimientos</h2><p>No hay gastos confirmados para este período.</p></div>}
          </section>
        </>
      ) : null}
    </section>
  );
}
