import { useEffect, useState } from "react";
import { Check, CreditCard, PenLine, ReceiptText, RefreshCw, Zap } from "lucide-react";
import { listTransacciones, listCategorias } from "../../api/client";
import type {
  CuentaResponseDTO,
  EstadoTransaccion,
  PaginatedResponseDTO,
  TransaccionResponseDTO,
  CategoriaResponseDTO,
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

const STATES: Array<{ value: EstadoTransaccion; label: string }> = [
  { value: "CONFIRMADA", label: "Confirmadas" },
  { value: "PENDIENTE_REVISION", label: "Revisión pendiente" },
  { value: "PENDIENTE_CATEGORIA", label: "Categoría pendiente" },
];

const PAGE_SIZE = 100;

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

function originMeta(origin: TransaccionResponseDTO["origen"]) {
  switch (origin) {
    case "MANUAL": return { label: "Manual", icon: <PenLine aria-hidden="true" /> };
    case "OCR_IA": return { label: "OCR", icon: <Zap aria-hidden="true" /> };
    case "APPLE_PAY": return { label: "Apple Pay", icon: <Zap aria-hidden="true" /> };
    case "RECURRENTE_CONFIRMADO": return { label: "Recurrente", icon: <RefreshCw aria-hidden="true" /> };
    case "RESUMEN_CONFIRMADO": return { label: "Resumen", icon: <ReceiptText aria-hidden="true" /> };
    case "CUOTA_CONFIRMADA": return { label: "Cuota", icon: <CreditCard aria-hidden="true" /> };
  }
}

export function Movimientos({ token, accounts, onRegisterExpense }: MovimientosProps) {
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));
  const [cuentaId, setCuentaId] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | "">("");
  const [categorias, setCategorias] = useState<CategoriaResponseDTO[]>([]);
  const [estado, setEstado] = useState<EstadoTransaccion | "">("");
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponseDTO<TransaccionResponseDTO>>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const defaultPeriod = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    void listCategorias(token, { tipo: "GASTO", activa: true }).then(setCategorias).catch(() => setCategorias([]));
  }, [token]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(undefined);
    void listTransacciones(token, {
      periodo,
      cuentaId: cuentaId || undefined,
      categoriaId: categoriaId || undefined,
      estado: estado || undefined,
      tipo: tipo || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((nextResult) => {
        if (active) setResult((current) => page === 1 || !current ? nextResult : { ...nextResult, items: [...current.items, ...nextResult.items] });
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
  }, [categoriaId, cuentaId, estado, page, periodo, reloadVersion, tipo, token]);

  const hasFilters = Boolean(cuentaId || categoriaId || estado || tipo || periodo !== defaultPeriod);

  function clearFilters() {
    setPeriodo(defaultPeriod);
    setCuentaId("");
    setCategoriaId("");
    setEstado("");
    setTipo("");
    setPage(1);
  }

  return (
    <section className="movimientos-page">
      <div className="movement-toolbar">
        <PeriodPills value={periodo} onChange={(nextPeriod) => { setPeriodo(nextPeriod); setPage(1); }} includeAll />
        <div className="movement-actions">
          <button className={isFiltersOpen ? "filter-button active" : "filter-button"} type="button" aria-expanded={isFiltersOpen} onClick={() => setIsFiltersOpen((current) => !current)}>Filtrar</button>
          {hasFilters ? <button className="clear-filters-button" type="button" onClick={clearFilters}>Limpiar filtros</button> : null}
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
          <select value={categoriaId} onChange={(event) => { setCategoriaId(event.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
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
                    <span className="movement-category-mark" aria-hidden="true"><span className={`category-icon icon-${transaction.categoria?.icono.toLowerCase() ?? "otro"}`} /></span>
                    <div className="movement-copy">
                      <div className="movement-title"><strong>{transaction.categoria?.nombre ?? "Sin categoría"}</strong><span className={`movement-origin movement-origin-${transaction.origen.toLowerCase()}`} title={originMeta(transaction.origen).label}>{originMeta(transaction.origen).icon}<span className="sr-only">{originMeta(transaction.origen).label}</span></span></div>
                      <span>{transaction.comercio ?? transaction.cuenta?.nombre ?? "Cuenta sin resolver"} · {formatDate(transaction.fecha)}</span>
                    </div>
                  </div>
                 <div className="movement-amount">
                   <strong className={transaction.monto < 0 ? "expense" : "income"}>{transaction.monto < 0 ? "-" : "+"}{formatCurrency(transaction.monto)}</strong>
                   <span className="movement-status"><span className={transaction.estado === "CONFIRMADA" ? "status-confirmed" : "status-pending"}>{transaction.estado === "CONFIRMADA" ? <Check aria-hidden="true" /> : "Pendiente"}</span>{originMeta(transaction.origen).label}</span>
                 </div>
               </article>
             ))}
           </div>
            {result.hasNextPage ? <div className="load-more"><span>{result.items.length} movimientos cargados</span><button className="primary-action" type="button" disabled={isLoading} onClick={() => setPage((current) => current + 1)}>{isLoading ? "Cargando..." : "Cargar más"}</button></div> : <p className="movement-end">Mostrando todos los movimientos de este filtro</p>}
         </>
       ) : null}
    </section>
  );
}
