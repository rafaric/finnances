import { useEffect, useState } from "react";
import { ArrowLeftRight, Settings } from "lucide-react";
import type { CuentaResponseDTO, ResumenMensualDTO, TransaccionResponseDTO } from "../../api/types";
import { PendingWidget } from "../../components/PendingWidget";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PeriodPills } from "../../components/PeriodPills";
import { confirmarInstanciaRecurrente, listarInstanciasProximas, omitirInstanciaRecurrente, proyectarRecurrentes } from "../../api/client";
import type { InstanciaRecurrenteResponseDTO } from "../../api/types";

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
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
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
}: HomeProps) {
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);
  const [recurringInstances, setRecurringInstances] = useState<InstanciaRecurrenteResponseDTO[]>([]);
  const [recurringError, setRecurringError] = useState<string>();

  async function loadRecurringInstances() {
    try {
      await proyectarRecurrentes(token, periodo);
      setRecurringInstances(await listarInstanciasProximas(token, 4));
      setRecurringError(undefined);
    } catch (error) {
      setRecurringError(error instanceof Error ? error.message : "No se pudieron cargar los próximos vencimientos.");
    }
  }

  useEffect(() => { void loadRecurringInstances(); }, [token, periodo]);

  async function resolveRecurring(id: string, action: "confirm" | "omit") {
    try {
      if (action === "confirm") await confirmarInstanciaRecurrente(token, id);
      else await omitirInstanciaRecurrente(token, id);
      await loadRecurringInstances();
      onPendingChanged();
    } catch (error) {
      setRecurringError(error instanceof Error ? error.message : "No se pudo resolver el vencimiento.");
    }
  }

  return (
    <section className="home-content">
      <PeriodPills value={periodo} onChange={onPeriodChange} />

      <section className="balance-panel">
        <p>Disponible líquido</p>
        <strong>{isLoadingSummary ? "Cargando..." : summaryError ? "No disponible" : summary ? currency(summary.disponibleLiquido) : "Sin datos aún"}</strong>
        <span>{accounts.length ? `${accounts.length} cuenta${accounts.length === 1 ? "" : "s"} conectada${accounts.length === 1 ? "" : "s"}.` : "Creá una cuenta para empezar."}</span>
      </section>

      <div className="period-grid">
        <article>
          <span>Ingresos del período</span>
          <strong>{isLoadingSummary ? "Cargando..." : summaryError ? "No disponible" : summary ? currency(summary.ingresos) : "Sin datos"}</strong>
          <p>Resumen mensual</p>
        </article>
        <article>
          <span>Gastos del período</span>
          <strong>{isLoadingSummary ? "Cargando..." : summaryError ? "No disponible" : summary ? currency(summary.gastos) : "Sin datos"}</strong>
          <p>Solo transacciones confirmadas</p>
        </article>
        <article>
          <span>Gastos proyectados</span>
          <strong>{isLoadingSummary ? "Cargando..." : summaryError ? "No disponible" : summary ? currency(summary.gastosProyectados ?? 0) : "Sin datos"}</strong>
          <p>Cuotas con vencimiento en el período</p>
        </article>
      </div>
      {summaryError ? <ErrorState message={summaryError} onRetry={onRetrySummary} /> : null}

      {recurringInstances.length ? <section className="recurring-due-widget">
        <div className="section-heading"><div><p className="eyebrow">PARA REVISAR</p><h2>Próximos vencimientos</h2></div><span>Dentro de 4 días</span></div>
        {recurringInstances.map((instance) => <article className="recurring-due-row" key={instance.id}><div><strong>{instance.gastoRecurrente.nombre}</strong><span>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(instance.fechaVencimiento))} · {instance.gastoRecurrente.cuenta.nombre}</span></div><b>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(instance.monto))}</b><button type="button" onClick={() => void resolveRecurring(instance.id, "confirm")}>Confirmar</button><button type="button" onClick={() => void resolveRecurring(instance.id, "omit")}>Omitir</button></article>)}
      </section> : recurringError ? <ErrorState message={recurringError} onRetry={() => void loadRecurringInstances()} /> : null}

      {pendingItems.length ? <PendingWidget token={token} accounts={accounts} items={pendingItems} onChanged={onPendingChanged} /> : null}

      <section className="section-heading">
        <div>
          <h2>Acciones rápidas</h2>
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
          {isLoadingAccounts ? <LoadingState label="Cargando cuentas..." /> : accountsError ? <ErrorState message={accountsError} onRetry={onRetryAccounts} /> : accounts.length ? <div className="account-list">
            {accounts.map((account) => <div className="account-list-row" key={account.id}><span>{account.nombre}</span><strong>{currency(account.saldoActual)}</strong></div>)}
          </div> : <p className="accounts-empty">Todavía no hay cuentas creadas.</p>}
          <button className="transfer-action" type="button" disabled={accounts.length < 2} onClick={onTransfer}><ArrowLeftRight size={17} />Transferir</button>
          {accounts.length < 2 ? <p className="action-hint">Necesitás dos cuentas para transferir.</p> : null}
        </> : null}
      </section>
    </section>
  );
}
