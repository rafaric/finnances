import { useEffect, useState } from "react";
import { listTransacciones } from "../../api/client";
import type {
  Categoria,
  CuentaResponseDTO,
  EstadoTransaccion,
  PaginatedResponseDTO,
  TransaccionResponseDTO,
  TipoMovimiento,
} from "../../api/types";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PeriodPills } from "../../components/PeriodPills";

interface MovimientosProps {
  token: string;
  accounts: CuentaResponseDTO[];
  onRegisterExpense: () => void;
}

const CATEGORIES: Array<{ value: Categoria; label: string }> = [
  { value: "COMIDA", label: "Comida" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "VIVIENDA", label: "Vivienda" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "OCIO", label: "Ocio" },
  { value: "DEUDAS", label: "Deudas" },
  { value: "OTROS", label: "Otros" },
];

const STATES: Array<{ value: EstadoTransaccion; label: string }> = [
  { value: "CONFIRMADA", label: "Confirmadas" },
  { value: "PENDIENTE_REVISION", label: "Revisión pendiente" },
  { value: "PENDIENTE_CATEGORIA", label: "Categoría pendiente" },
];

const PAGE_SIZE = 50;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function originLabel(origin: TransaccionResponseDTO["origen"]): string {
  switch (origin) {
    case "MANUAL": return "Manual";
    case "OCR_IA": return "OCR";
    case "APPLE_PAY": return "Apple Pay";
    case "RECURRENTE_CONFIRMADO": return "Recurrente";
    case "RESUMEN_CONFIRMADO": return "Resumen";
  }
}

export function Movimientos({ token, accounts, onRegisterExpense }: MovimientosProps) {
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));
  const [cuentaId, setCuentaId] = useState("");
  const [categoria, setCategoria] = useState<Categoria | "">("");
  const [estado, setEstado] = useState<EstadoTransaccion | "">("");
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponseDTO<TransaccionResponseDTO>>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(undefined);
    void listTransacciones(token, {
      periodo,
      cuentaId: cuentaId || undefined,
      categoria: categoria || undefined,
      estado: estado || undefined,
      tipo: tipo || undefined,
       page,
       limit: PAGE_SIZE,
    })
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los movimientos.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categoria, cuentaId, estado, page, periodo, reloadVersion, tipo, token]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <section className="movimientos-page">
      <div className="movement-toolbar">
        <PeriodPills value={periodo} onChange={(nextPeriod) => { setPeriodo(nextPeriod); setPage(1); }} includeAll />
        <div className="movement-actions">
          
          <button className={isFiltersOpen ? "filter-button active" : "filter-button"} type="button" aria-expanded={isFiltersOpen} onClick={() => setIsFiltersOpen((current) => !current)}>Filtrar</button>
        </div>
      </div>
      <div className="movement-type-pills" aria-label="Tipo de movimiento">
        <button className={!tipo ? "active" : ""} type="button" onClick={() => { setTipo(""); setPage(1); }}>Todos</button>
        <button className={tipo === "GASTO" ? "active" : ""} type="button" onClick={() => { setTipo("GASTO"); setPage(1); }}>Gastos</button>
        <button className={tipo === "INGRESO" ? "active" : ""} type="button" onClick={() => { setTipo("INGRESO"); setPage(1); }}>Ingresos</button>
      </div>
      {isFiltersOpen ? <div className="movement-filters">
        <label className="form-field">
          <span>Cuenta</span>
          <select value={cuentaId} onChange={(event) => { setCuentaId(event.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.nombre}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Categoría</span>
          <select value={categoria} onChange={(event) => { setCategoria(event.target.value as Categoria | ""); setPage(1); }}>
            <option value="">Todas</option>
            {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Estado</span>
          <select value={estado} onChange={(event) => { setEstado(event.target.value as EstadoTransaccion | ""); setPage(1); }}>
            <option value="">Todos</option>
            {STATES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div> : null}

      {isLoading ? <LoadingState label="Cargando movimientos..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => setReloadVersion((current) => current + 1)} /> : null}
      {!isLoading && !error && result?.items.length === 0 ? (
        <div className="empty-page">
          <h2>No hay movimientos</h2>
           <p>No hay movimientos con estos filtros.</p>
          <button className="primary-action" type="button" onClick={onRegisterExpense}>Registrar gasto</button>
        </div>
      ) : null}
       {!isLoading && !error && result?.items.length ? (
         <>
           <div className="movement-list">
             {result.items.map((transaction) => (
               <article className="movement-row" key={transaction.id}>
                 <div className="movement-main">
                   <strong>{CATEGORIES.find((item) => item.value === transaction.categoria)?.label ?? transaction.categoria}</strong>
                    <span>{transaction.comercio ?? transaction.cuenta?.nombre ?? "Cuenta sin resolver"} · {formatDate(transaction.fecha)}</span>
                 </div>
                 <div className="movement-amount">
                   <strong className={transaction.monto < 0 ? "expense" : "income"}>{transaction.monto < 0 ? "-" : "+"}{formatCurrency(transaction.monto)}</strong>
                  <span>{transaction.estado === "CONFIRMADA" ? "Confirmado" : "Pendiente"} · {originLabel(transaction.origen)}</span>
                 </div>
               </article>
             ))}
           </div>
           <nav className="pagination" aria-label="Paginación de movimientos">
             <button type="button" disabled={page === 1 || isLoading} onClick={() => setPage((current) => current - 1)}>Anterior</button>
             <span>Página {page} de {totalPages}</span>
             <button type="button" disabled={!result.hasNextPage || isLoading} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
           </nav>
         </>
       ) : null}
    </section>
  );
}
