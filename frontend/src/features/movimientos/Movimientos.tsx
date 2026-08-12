import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, Check, CreditCard, PenLine, ReceiptText, RefreshCw, Trash2, X, Zap } from "lucide-react";
import { editarGasto, eliminarGasto, listCategorias, listTransacciones, listTransferencias } from "../../api/client";
import type {
  CuentaResponseDTO,
  EstadoTransaccion,
  PaginatedResponseDTO,
  TransaccionResponseDTO,
  TransferenciaResponseDTO,
  CategoriaResponseDTO,
  TipoMovimiento,
} from "../../api/types";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PeriodPills } from "../../components/PeriodPills";
import { CategorySelector } from "../../components/CategorySelector";

interface MovimientosProps {
  token: string;
  accounts: CuentaResponseDTO[];
  onRegisterExpense: () => void;
  onDataChanged?: () => void;
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
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(year, month - 1, day));
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

export function Movimientos({ token, accounts, onRegisterExpense, onDataChanged }: MovimientosProps) {
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));
  const [cuentaId, setCuentaId] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | "">("");
  const [categorias, setCategorias] = useState<CategoriaResponseDTO[]>([]);
  const [estado, setEstado] = useState<EstadoTransaccion | "">("");
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponseDTO<TransaccionResponseDTO>>();
  const [transferencias, setTransferencias] = useState<TransferenciaResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<TransaccionResponseDTO>();
  const [deletingTransaction, setDeletingTransaction] = useState<TransaccionResponseDTO>();
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>();
  const [editSubcategoryId, setEditSubcategoryId] = useState<string>();
  const [editMerchant, setEditMerchant] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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

  useEffect(() => {
    if (tipo) {
      setTransferencias([]);
      return;
    }
    void listTransferencias(token, { periodo: periodo || undefined, cuentaId: cuentaId || undefined })
      .then(setTransferencias)
      .catch(() => setTransferencias([]));
  }, [cuentaId, periodo, reloadVersion, tipo, token]);

  const hasFilters = Boolean(cuentaId || categoriaId || estado || tipo || periodo !== defaultPeriod);
  const unifiedItems = [
    ...(result?.items ?? []).map((value) => ({ kind: "transaction" as const, value })),
    ...transferencias.map((value) => ({ kind: "transfer" as const, value })),
  ].sort((left, right) => {
    const byDate = right.value.fecha.localeCompare(left.value.fecha);
    if (byDate !== 0) return byDate;
    return (right.value.createdAt ?? right.value.fecha).localeCompare(left.value.createdAt ?? left.value.fecha);
  });

  function clearFilters() {
    setPeriodo(defaultPeriod);
    setCuentaId("");
    setCategoriaId("");
    setEstado("");
    setTipo("");
    setPage(1);
  }

  function openEditor(transaction: TransaccionResponseDTO) {
    setEditingTransaction(transaction);
    setEditAmount(String(Math.abs(transaction.monto)));
    setEditDate(transaction.fecha.slice(0, 10));
    setEditAccountId(transaction.cuenta?.id ?? "");
    setEditCategoryId(transaction.categoria?.id);
    setEditSubcategoryId(transaction.subcategoria?.id);
    setEditMerchant(transaction.comercio ?? "");
    setEditNote(transaction.nota ?? "");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTransaction || !editCategoryId) return;
    setIsSavingEdit(true);
    try {
      await editarGasto(token, editingTransaction.id, {
        monto: editAmount,
        fecha: editDate,
        cuentaId: editAccountId,
        categoriaId: editCategoryId,
        subcategoriaId: editSubcategoryId ?? null,
        comercio: editMerchant.trim() || null,
        nota: editNote.trim() || null,
      });
      setEditingTransaction(undefined);
      setPage(1);
      setResult(undefined);
      setReloadVersion((current) => current + 1);
      onDataChanged?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo editar el gasto.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function removeTransaction(transaction: TransaccionResponseDTO) {
    try {
      await eliminarGasto(token, transaction.id);
      setPage(1);
      setResult(undefined);
      setReloadVersion((current) => current + 1);
      onDataChanged?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar el gasto.");
    } finally {
      setDeletingTransaction(undefined);
    }
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
       {!isLoading && !error && result?.items.length === 0 && transferencias.length === 0 ? (
        <div className="empty-page">
          <h2>No hay movimientos</h2>
          <p>No hay movimientos con estos filtros.</p>
          <button className="primary-action" type="button" onClick={onRegisterExpense}>Registrar gasto</button>
        </div>
      ) : null}
       {!isLoading && !error && unifiedItems.length ? (
         <>
            <div className="movement-list">
              {unifiedItems.map((item) => { if (item.kind === "transaction") { const transaction = item.value; return (
                <article className="movement-row" key={transaction.id}>
                  <div className="movement-main">
                    <span className={`movement-category-mark category-color-${transaction.categoria?.color.toLowerCase() ?? "blanco"}`} aria-hidden="true"><span className={`category-icon icon-${transaction.categoria?.icono.toLowerCase() ?? "otro"}`} /></span>
                    <div className="movement-copy">
                      <div className="movement-title"><strong>{transaction.categoria?.nombre ?? "Sin categoría"}</strong><span className={`movement-origin movement-origin-${transaction.origen.toLowerCase()}`} title={originMeta(transaction.origen).label}>{originMeta(transaction.origen).icon}<span className="sr-only">{originMeta(transaction.origen).label}</span></span></div>
                        <span className="movement-meta">{transaction.cuenta?.nombre ?? "Cuenta sin resolver"} · {formatDate(transaction.fecha)}</span>
                        {transaction.nota ? <span className="movement-note">{transaction.nota}</span> : null}
                    </div>
                  </div>
                  <div className="movement-amount">
                    <strong className={transaction.monto < 0 ? "expense" : "income"}>{transaction.monto < 0 ? "-" : "+"}{formatCurrency(transaction.monto)}</strong>
                    <span className="movement-status"><span className={transaction.estado === "CONFIRMADA" ? "status-confirmed" : "status-pending"}>{transaction.estado === "CONFIRMADA" ? <Check aria-hidden="true" /> : "Pendiente"}</span>{originMeta(transaction.origen).label}</span>
                    {transaction.monto < 0 && (transaction.origen === "MANUAL" || transaction.origen === "OCR_IA") ? <div className="movement-actions"><button type="button" aria-label="Editar gasto" title="Editar gasto" onClick={() => openEditor(transaction)}><PenLine aria-hidden="true" /></button><button type="button" aria-label="Eliminar gasto" title="Eliminar gasto" onClick={() => setDeletingTransaction(transaction)}><Trash2 aria-hidden="true" /></button></div> : null}
                  </div>
                </article>
              ); } const transferencia = item.value; return (
                <article className="movement-row transfer-row" key={transferencia.id}>
                  <div className="movement-main"><span className="movement-category-mark category-color-azul" aria-hidden="true"><ArrowLeftRight /></span><div className="movement-copy"><div className="movement-title"><strong>{transferencia.cuentaOrigen.nombre} → {transferencia.cuentaDestino.nombre}</strong><span className="movement-origin" title="Transferencia"><ArrowLeftRight aria-hidden="true" /><span className="sr-only">Transferencia</span></span></div><span className="movement-meta">{formatDate(transferencia.fecha)}</span>{transferencia.nota ? <span className="movement-note">{transferencia.nota}</span> : null}</div></div>
                  <div className="movement-amount"><strong className="transfer-amount">{formatCurrency(transferencia.monto)}</strong><span className="movement-status">Movimiento interno</span></div>
                </article>
              ); })}
            </div>
            {result?.hasNextPage ? <div className="load-more"><span>{result.items.length} movimientos cargados</span><button className="primary-action" type="button" disabled={isLoading} onClick={() => setPage((current) => current + 1)}>{isLoading ? "Cargando..." : "Cargar más"}</button></div> : <p className="movement-end">Mostrando todos los movimientos de este filtro</p>}
          </>
        ) : null}
       {editingTransaction ? <div className="modal-backdrop" role="presentation"><form className="connection-modal movement-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-expense-title" onSubmit={saveEdit}><div className="section-heading"><h2 id="edit-expense-title">Editar gasto</h2><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setEditingTransaction(undefined)}><X size={18} /></button></div><label className="form-field"><span>Monto</span><input required inputMode="decimal" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} /></label><label className="form-field"><span>Fecha</span><input required type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} /></label><label className="form-field"><span>Cuenta</span><select required value={editAccountId} onChange={(event) => setEditAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.nombre}</option>)}</select></label><CategorySelector token={token} tipo="GASTO" categoriaId={editCategoryId} subcategoriaId={editSubcategoryId} onCategoriaChange={(next) => { setEditCategoryId(next); setEditSubcategoryId(undefined); }} onSubcategoriaChange={setEditSubcategoryId} /><label className="form-field"><span>Nota o comercio</span><input maxLength={60} value={editMerchant} onChange={(event) => setEditMerchant(event.target.value)} /></label><div className="modal-actions"><button type="button" onClick={() => setEditingTransaction(undefined)}>Cancelar</button><button className="primary-action" type="submit" disabled={isSavingEdit}>{isSavingEdit ? "Guardando..." : "Guardar cambios"}</button></div></form></div> : null}
       {deletingTransaction ? <div className="modal-backdrop" role="presentation"><section className="connection-modal" role="dialog" aria-modal="true" aria-labelledby="delete-expense-title"><div className="section-heading"><h2 id="delete-expense-title">Eliminar gasto</h2><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setDeletingTransaction(undefined)}><X size={18} /></button></div><p>¿Querés eliminar el gasto de <strong>{formatCurrency(deletingTransaction.monto)}</strong> del <strong>{formatDate(deletingTransaction.fecha)}</strong>?</p><p>Esta acción actualizará el saldo de la cuenta y no se puede deshacer.</p><div className="modal-actions"><button type="button" onClick={() => setDeletingTransaction(undefined)}>Cancelar</button><button className="danger-action" type="button" onClick={() => void removeTransaction(deletingTransaction)}>Eliminar gasto</button></div></section></div> : null}
     </section>
  );
}
