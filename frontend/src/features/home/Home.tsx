import { useState } from "react";
import { ArrowLeftRight, Settings } from "lucide-react";
import type { CuentaResponseDTO, ResumenMensualDTO, TransaccionResponseDTO } from "../../api/types";
import { PendingWidget } from "../../components/PendingWidget";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PeriodPills } from "../../components/PeriodPills";

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
  onTransfer: () => void;
  onManageAccounts: () => void;
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
  onTransfer,
  onManageAccounts,
  onPeriodChange,
  periodo,
  token,
  pendingItems,
  onPendingChanged,
}: HomeProps) {
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);

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
      </div>
      {summaryError ? <ErrorState message={summaryError} onRetry={onRetrySummary} /> : null}

      {pendingItems.length ? <PendingWidget token={token} accounts={accounts} items={pendingItems} onChanged={onPendingChanged} /> : null}

      <section className="section-heading">
        <div>
          <h2>Acciones rápidas</h2>
        </div>
      </section>

      <div className="actions-grid">
        <button type="button" onClick={onRegisterExpense}>Registrar gasto</button>
        <button type="button" onClick={onRegisterIncome}>Registrar ingreso</button>
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
