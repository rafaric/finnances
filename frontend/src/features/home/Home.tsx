import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, Settings } from "lucide-react";
import type { CuentaResponseDTO, ResumenMensualDTO, TransaccionResponseDTO } from "../../api/types";
import { PendingWidget } from "../../components/PendingWidget";
import { ErrorState } from "../../components/ErrorState";
import { PeriodPills } from "../../components/PeriodPills";
import { formatPeriod } from "../../lib/periods";
import { confirmarInstanciaRecurrente, listarInstanciasProximas, omitirInstanciaRecurrente, proyectarRecurrentes } from "../../api/client";
import type { InstanciaRecurrenteResponseDTO } from "../../api/types";
import type { QueuedOperation } from "../../lib/offlineQueue";

interface HomeProps {
  accounts: CuentaResponseDTO[];
  summary?: ResumenMensualDTO;
  isLoadingAccounts: boolean;
  isLoadingSummary: boolean;
  accountsError?: string;
  summaryError?: string;
  onRetryAccounts: () => void;
  onRetrySummary: () => void;
  onRegisterExpense: () => void;
  onRegisterIncome: () => void;
  onRecurrentes: () => void;
  onTransfer: () => void;
  onManageAccounts: () => void;
  onTarjetas: () => void;
  onPeriodChange: (periodo: string) => void;
  periodo: string;
  token: string;
  pendingItems: TransaccionResponseDTO[];
  onPendingChanged: () => void;
  offlineOperations: QueuedOperation[];
  onRetryOffline: () => void;
  onDiscardOffline: (id: string) => Promise<void>;
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={`skeleton-line ${className}`} aria-hidden="true" />;
}

export function Home({
  accounts,
  summary,
  isLoadingAccounts,
  isLoadingSummary,
  accountsError,
  summaryError,
  onRetryAccounts,
  onRetrySummary,
  onRegisterExpense,
  onRegisterIncome,
  onRecurrentes,
  onTransfer,
  onManageAccounts,
  onTarjetas,
  onPeriodChange,
  periodo,
  token,
  pendingItems,
  onPendingChanged,
  offlineOperations,
  onRetryOffline,
  onDiscardOffline,
}: HomeProps) {
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);
  const [recurringInstances, setRecurringInstances] = useState<InstanciaRecurrenteResponseDTO[]>([]);
  const [recurringError, setRecurringError] = useState<string>();
  const [selectedRecurring, setSelectedRecurring] = useState<InstanciaRecurrenteResponseDTO>();
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringAccountId, setRecurringAccountId] = useState("");
  const [recurringDate, setRecurringDate] = useState("");
  const [isConfirmingRecurring, setIsConfirmingRecurring] = useState(false);

  async function loadRecurringInstances() {
    try {
      await proyectarRecurrentes(token, periodo);
       setRecurringInstances(await listarInstanciasProximas(token, 4));
      setRecurringError(undefined);
    } catch (error) {
      if (navigator.onLine && !(error instanceof TypeError && error.message === "Failed to fetch")) {
        setRecurringError(error instanceof Error ? error.message : "No se pudieron cargar los próximos vencimientos.");
      }
    }
  }

  useEffect(() => { void loadRecurringInstances(); }, [token, periodo]);

  function openRecurringConfirmation(instance: InstanciaRecurrenteResponseDTO) {
    setSelectedRecurring(instance);
    setRecurringAmount(instance.monto == null ? "" : String(instance.monto));
    setRecurringAccountId(instance.gastoRecurrente.cuenta.id);
    setRecurringDate(instance.fechaVencimiento.slice(0, 10));
    setRecurringError(undefined);
  }

  async function confirmRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecurring || !recurringAccountId) return;
    setIsConfirmingRecurring(true);
    try {
      await confirmarInstanciaRecurrente(token, selectedRecurring.id, {
        cuentaRealId: recurringAccountId,
        monto: recurringAmount || undefined,
        fecha: recurringDate || undefined,
      });
      setSelectedRecurring(undefined);
      await loadRecurringInstances();
      onPendingChanged();
    } catch (error) {
      setRecurringError(error instanceof Error ? error.message : "No se pudo resolver el vencimiento.");
    } finally {
      setIsConfirmingRecurring(false);
    }
  }

  async function omitRecurring(id: string) {
    try {
      await omitirInstanciaRecurrente(token, id);
      await loadRecurringInstances();
      onPendingChanged();
    } catch (error) {
      setRecurringError(error instanceof Error ? error.message : "No se pudo omitir el vencimiento.");
    }
  }

  return (
    <section className="home-content">
      <PeriodPills value={periodo} onChange={onPeriodChange} />

      <section className="balance-panel">
        <div className="balance-panel-heading"><p>Disponible líquido</p><span>{formatPeriod(periodo)}</span></div>
        <strong>{isLoadingSummary ? <SkeletonLine className="skeleton-balance" /> : summaryError ? "No disponible" : summary ? currency(summary.disponibleLiquido) : "Sin datos aún"}</strong>
        {isLoadingAccounts ? <SkeletonLine className="skeleton-caption" /> : <span>{accounts.length ? `${accounts.length} cuenta${accounts.length === 1 ? "" : "s"} conectada${accounts.length === 1 ? "" : "s"}.` : "Creá una cuenta para empezar."}</span>}
      </section>

      <div className="period-grid">
        <article>
          <span>Ingresos del período</span>
          <strong>{isLoadingSummary ? <SkeletonLine className="skeleton-value" /> : summaryError ? "No disponible" : summary ? currency(summary.ingresos) : "Sin datos"}</strong>
          <p>{isLoadingSummary ? <SkeletonLine className="skeleton-small" /> : "Resumen mensual"}</p>
        </article>
        <article>
          <span>Gastos del período</span>
          <strong>{isLoadingSummary ? <SkeletonLine className="skeleton-value" /> : summaryError ? "No disponible" : summary ? currency(summary.gastos) : "Sin datos"}</strong>
          <p>{isLoadingSummary ? <SkeletonLine className="skeleton-small" /> : "Solo transacciones confirmadas"}</p>
        </article>
        <article>
          <span>Gastos proyectados</span>
          <strong>{isLoadingSummary ? <SkeletonLine className="skeleton-value" /> : summaryError ? "No disponible" : summary ? currency(summary.gastosProyectados ?? 0) : "Sin datos"}</strong>
          <p>{isLoadingSummary ? <SkeletonLine className="skeleton-small" /> : "Cuotas con vencimiento en el período"}</p>
        </article>
      </div>
      {summaryError ? <ErrorState message={summaryError} onRetry={onRetrySummary} /> : null}

      {isLoadingSummary ? <section className="home-attention home-attention-skeleton" aria-label="Cargando pendientes"><div className="section-heading"><div><SkeletonLine className="skeleton-eyebrow" /><SkeletonLine className="skeleton-heading" /></div></div><SkeletonLine className="skeleton-attention-row" /><SkeletonLine className="skeleton-attention-row" /></section> : recurringInstances.length || pendingItems.length ? <section className="home-attention"><div className="section-heading"><div><p className="eyebrow">PARA RESOLVER</p><h2>Lo que requiere atención</h2></div><span>{recurringInstances.length + pendingItems.length} pendientes</span></div>{recurringInstances.length ? <section className="recurring-due-widget">
        <div className="section-heading"><div><p className="eyebrow">PARA REVISAR</p><h2>Próximos vencimientos</h2></div><span>Dentro de 4 días</span></div>
          {recurringInstances.map((instance) => <article className="recurring-due-row" key={instance.id}><div><strong>{instance.gastoRecurrente.nombre}</strong><span>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(instance.fechaVencimiento))} · {instance.gastoRecurrente.cuenta.nombre}</span></div><b>{instance.monto == null ? "Importe pendiente" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(instance.monto))}</b><button type="button" onClick={() => openRecurringConfirmation(instance)}>{instance.monto == null ? "Completar importe" : "Confirmar"}</button><button type="button" onClick={() => void omitRecurring(instance.id)}>Omitir</button></article>)}
       </section> : recurringError ? <ErrorState message={recurringError} onRetry={() => void loadRecurringInstances()} /> : null}{pendingItems.length ? <PendingWidget token={token} accounts={accounts} items={pendingItems} onChanged={onPendingChanged} /> : null}</section> : recurringError ? <ErrorState message={recurringError} onRetry={() => void loadRecurringInstances()} /> : null}

      {selectedRecurring ? <div className="modal-backdrop" role="presentation"><form className="connection-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-recurring-title" onSubmit={confirmRecurring}><div className="section-heading"><div><p className="eyebrow">CONFIRMACIÓN</p><h2 id="confirm-recurring-title">Confirmar gasto recurrente</h2></div><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setSelectedRecurring(undefined)}>×</button></div><p>{selectedRecurring.gastoRecurrente.nombre}</p><label className="form-field"><span>Importe</span><input required type="number" min="0.01" step="0.01" value={recurringAmount} onChange={(event) => setRecurringAmount(event.target.value)} /></label><label className="form-field"><span>Cuenta que pagó</span><select required value={recurringAccountId} onChange={(event) => setRecurringAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.nombre} · {currency(account.saldoActual)}</option>)}</select></label><label className="form-field"><span>Fecha real</span><input required type="date" value={recurringDate} onChange={(event) => setRecurringDate(event.target.value)} /></label>{recurringError ? <p className="notice">{recurringError}</p> : null}<div className="modal-actions"><button type="button" onClick={() => setSelectedRecurring(undefined)}>Cancelar</button><button className="primary-action" type="submit" disabled={isConfirmingRecurring}>{isConfirmingRecurring ? "Confirmando..." : "Confirmar gasto"}</button></div></form></div> : null}
      {offlineOperations.length ? <section className="offline-queue-widget" aria-label="Operaciones offline pendientes"><div className="section-heading"><div><p className="eyebrow">SINCRONIZACIÓN</p><h2>Operaciones pendientes</h2></div><span>{offlineOperations.length}</span></div>{offlineOperations.map((operation) => <article className="offline-queue-row" key={operation.id}><div><strong>{operation.kind === "gasto" ? "Gasto manual" : "Ingreso"}</strong><span>{operation.lastError ?? "Esperando sincronización"}</span></div><button type="button" onClick={onRetryOffline}>Reintentar</button><button type="button" onClick={() => void onDiscardOffline(operation.id)}>Descartar</button></article>)}</section> : null}

      <section className="section-heading">
        <div>
          <p className="eyebrow">ACCIONES</p><h2>¿Qué necesitás registrar?</h2>
        </div>
      </section>

      <div className="actions-grid">
        <button type="button" onClick={onRegisterExpense}>Registrar gasto</button>
        <button type="button" onClick={onRegisterIncome}>Registrar ingreso</button>
       <button type="button" onClick={onRecurrentes}>Gastos recurrentes</button>
        <button type="button" onClick={onTarjetas}>Tarjetas y resúmenes</button>
      </div>

      <section className={isAccountsExpanded ? "accounts-widget expanded" : "accounts-widget"}>
        <div className="accounts-widget-heading">
          <button className="accounts-toggle" type="button" aria-expanded={isAccountsExpanded} onClick={() => setIsAccountsExpanded((current) => !current)}>
            <span><strong>Mis cuentas</strong><small>{accounts.length ? `${accounts.length} cuenta${accounts.length === 1 ? "" : "s"}` : "Sin cuentas"}</small></span>
            <span aria-hidden="true">{isAccountsExpanded ? "−" : "+"}</span>
          </button>
          <button className="icon-button" type="button" aria-label="Administrar cuentas" title="Administrar cuentas" onClick={onManageAccounts}><Settings size={18} /></button>
        </div>
        {isAccountsExpanded ? <>
           {isLoadingAccounts ? <div className="account-list account-list-skeleton"><SkeletonLine /><SkeletonLine /><SkeletonLine /></div> : accountsError ? <ErrorState message={accountsError} onRetry={onRetryAccounts} /> : accounts.length ? <div className="account-list">
            {accounts.map((account) => <div className="account-list-row" key={account.id}><span>{account.nombre}</span><strong>{currency(account.saldoActual)}</strong></div>)}
          </div> : <p className="accounts-empty">Todavía no hay cuentas creadas.</p>}
          <button className="transfer-action" type="button" disabled={accounts.length < 2} onClick={onTransfer}><ArrowLeftRight size={17} />Transferir</button>
          {accounts.length < 2 ? <p className="action-hint">Necesitás dos cuentas para transferir.</p> : null}
        </> : null}
      </section>
    </section>
  );
}
