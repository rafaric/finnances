import { useEffect, useState, type FormEvent } from "react";
import { actualizarCuenta, crearCuenta, crearGasto, crearTransferencia, getResumenMensual, listCuentas, listPendientes } from "./api/client";
import type { CuentaResponseDTO, ResumenMensualDTO, TipoCuenta, TransaccionResponseDTO } from "./api/types";
import { CategorySelector } from "./components/CategorySelector";
import type { Category } from "./components/categories";
import { MoneyInput } from "./components/MoneyInput";
import { Home } from "./features/home/Home";
import { Movimientos } from "./features/movimientos/Movimientos";
import { Analisis } from "./features/analisis/Analisis";
import { currentPeriod } from "./lib/periods";
import { Bolt, X } from "lucide-react";
import "./index.css";
type Screen = "inicio" | "movimientos" | "nuevo" | "transferir" | "analisis" | "metas";

interface Connection {
  token: string;
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateValue(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [connection, setConnection] = useState<Connection>(() => ({
    token: sessionStorage.getItem("finnances.apiToken") ?? "",
  }));
  const [draftConnection, setDraftConnection] = useState(connection);
  const [accounts, setAccounts] = useState<CuentaResponseDTO[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(Boolean(connection.token));
  const [accountsError, setAccountsError] = useState<string>();
  const [isConfigOpen, setIsConfigOpen] = useState(!connection.token);
  const [accountName, setAccountName] = useState("");
  const [accountEntity, setAccountEntity] = useState("");
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isExpenseAccountOpen, setIsExpenseAccountOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string>();
  const [accountFormSaving, setAccountFormSaving] = useState(false);
  const [accountType, setAccountType] = useState<TipoCuenta>("EFECTIVO");
  const [initialBalance, setInitialBalance] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("COMIDA");
  const [date, setDate] = useState(() => dateValue());
  const [note, setNote] = useState("");
  const [transferOriginId, setTransferOriginId] = useState("");
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(() => dateValue());
  const [transferNote, setTransferNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [monthlySummary, setMonthlySummary] = useState<ResumenMensualDTO>();
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod());
  const [isLoadingSummary, setIsLoadingSummary] = useState(Boolean(connection.token));
  const [summaryError, setSummaryError] = useState<string>();
  const [pendingItems, setPendingItems] = useState<TransaccionResponseDTO[]>([]);

  async function loadAccounts(token: string) {
    setIsLoadingAccounts(true);
    setAccountsError(undefined);
    try {
      const nextAccounts = await listCuentas(token);
      setAccounts(nextAccounts);
      setSelectedAccountId((current) =>
        nextAccounts.some((account) => account.id === current)
          ? current
          : nextAccounts[0]?.id ?? "",
      );
      setIsConfigOpen(nextAccounts.length === 0);
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : "No se pudieron cargar las cuentas.");
      setIsConfigOpen(true);
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  useEffect(() => {
    if (!connection.token) return;
    setIsLoadingSummary(true);
    setSummaryError(undefined);
    void Promise.all([
      loadAccounts(connection.token),
      getResumenMensual(connection.token, selectedPeriod),
      listPendientes(connection.token),
    ])
      .then(([, summary, pending]) => { setMonthlySummary(summary); setPendingItems(pending); })
      .catch((error) => setSummaryError(error instanceof Error ? error.message : "No se pudo cargar el resumen."))
      .finally(() => setIsLoadingSummary(false));
  }, [connection.token, selectedPeriod]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextConnection = {
      token: draftConnection.token.trim(),
    };
    sessionStorage.setItem("finnances.apiToken", nextConnection.token);
    setConnection(nextConnection);
    setNotice("Conexión guardada para esta sesión.");
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = draftConnection.token.trim();
    if (!token) {
      setAccountsError("Ingresá el token de API para continuar.");
      return;
    }
    setIsCreatingAccount(true);
    try {
      const account = await crearCuenta(token, {
        nombre: accountName.trim(),
        tipo: accountType,
        nombreEntidad: accountEntity.trim() || undefined,
        saldoInicial: initialBalance || undefined,
      });
      sessionStorage.setItem("finnances.apiToken", token);
      setConnection({ token });
      setAccounts((current) => [...current, account]);
      setSelectedAccountId(account.id);
      setAccountName("");
      setAccountEntity("");
      setInitialBalance("");
      setIsConfigOpen(false);
      setNotice(`Cuenta ${account.nombre} creada.`);
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : "No se pudo crear la cuenta.");
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function submitManagedAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection.token) return;
    setAccountFormSaving(true);
    try {
      if (editingAccountId) {
        const updated = await actualizarCuenta(connection.token, editingAccountId, { nombre: accountName.trim(), nombreEntidad: accountEntity.trim() || undefined });
        setAccounts((current) => current.map((account) => account.id === updated.id ? updated : account));
        setNotice(`Cuenta ${updated.nombre} actualizada.`);
      } else {
        const created = await crearCuenta(connection.token, { nombre: accountName.trim(), tipo: accountType, nombreEntidad: accountEntity.trim() || undefined, saldoInicial: initialBalance || undefined });
        setAccounts((current) => [...current, created]);
        setSelectedAccountId(created.id);
        setNotice(`Cuenta ${created.nombre} creada.`);
      }
      setAccountName(""); setAccountEntity(""); setInitialBalance(""); setEditingAccountId(undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar la cuenta.");
    } finally { setAccountFormSaving(false); }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccountId || !connection.token) {
      setIsConfigOpen(true);
      setNotice("Configurá una cuenta antes de registrar un gasto.");
      return;
    }

    setIsSaving(true);
    try {
      const transaction = await crearGasto(connection.token, {
        monto: amount,
        cuentaId: selectedAccountId,
        categoria: category,
        origen: "MANUAL",
          fecha: date,
          nota: note.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!transaction.cuenta) throw new Error("El backend no devolvió la cuenta del gasto confirmado.");
      const transactionAccount = transaction.cuenta;
      setAccounts((current) => current.map((account) =>
        account.id === transactionAccount.id
          ? { ...account, saldoActual: transactionAccount.saldoActual }
          : account,
      ));
      setMonthlySummary(undefined);
      if (connection.token) {
        void getResumenMensual(connection.token, selectedPeriod).then(setMonthlySummary).catch(() => undefined);
      }
      setAmount("");
      setNote("");
      setNotice(`Gasto registrado. Saldo actual: ${currency(transactionAccount.saldoActual)}.`);
      setScreen("inicio");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo registrar el gasto.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const origin = accounts.find((account) => account.id === transferOriginId);
    if (!origin || !transferDestinationId || !connection.token) {
      setNotice("Elegí cuentas de origen y destino para continuar.");
      return;
    }
    const amountValue = Number(transferAmount.replace(",", "."));
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setNotice("Ingresá un monto válido.");
      return;
    }
    if (amountValue > origin.saldoActual) {
      setNotice("El monto supera el saldo disponible.");
      return;
    }

    setIsSaving(true);
    try {
      const transfer = await crearTransferencia(connection.token, {
        cuentaOrigenId: transferOriginId,
        cuentaDestinoId: transferDestinationId,
        monto: transferAmount,
        fecha: transferDate,
        nota: transferNote.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setAccounts((current) => current.map((account) => {
        if (account.id === transfer.cuentaOrigen.id) return { ...account, saldoActual: transfer.cuentaOrigen.saldoActual };
        if (account.id === transfer.cuentaDestino.id) return { ...account, saldoActual: transfer.cuentaDestino.saldoActual };
        return account;
      }));
      void getResumenMensual(connection.token, selectedPeriod).then(setMonthlySummary).catch(() => undefined);
      setTransferAmount("");
      setTransferNote("");
      setNotice(`Transferencia registrada. Saldo origen: ${currency(transfer.cuentaOrigen.saldoActual)}.`);
      setScreen("inicio");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo registrar la transferencia.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className={screen === "inicio" ? "topbar home-topbar" : "topbar compact-topbar"}>
        {screen === "inicio" ? <div><p className="eyebrow">FINNANCES</p><h1>Tu plata, en contexto.</h1></div> : <h1>{screen === "nuevo" ? "Nueva transacción" : screen === "transferir" ? "Transferir" : screen === "movimientos" ? "Movimientos" : screen === "analisis" ? "Análisis" : "Metas"}</h1>}
        <button className="settings-button icon-button" type="button" aria-label="Configuración de conexión" title="Configuración de conexión" onClick={() => setIsConfigOpen(true)}><Bolt size={19} strokeWidth={2.2} /></button>
      </header>

      {notice ? <p className="notice" role="status">{notice}</p> : null}

      {screen === "inicio" ? (
        <Home
          accounts={accounts}
          summary={monthlySummary}
          isLoadingAccounts={isLoadingAccounts}
          isLoadingSummary={isLoadingSummary}
          accountsError={accountsError}
          summaryError={summaryError}
          onRetryAccounts={() => void loadAccounts(connection.token)}
          onRegisterExpense={() => setScreen("nuevo")}
          onTransfer={() => {
            setTransferOriginId(accounts[0]?.id ?? "");
            setTransferDestinationId(accounts[1]?.id ?? "");
            setScreen("transferir");
          }}
          onManageAccounts={() => setIsAccountsOpen(true)}
          onPeriodChange={setSelectedPeriod}
          periodo={selectedPeriod}
          token={connection.token}
          pendingItems={pendingItems}
          onPendingChanged={() => {
            void listPendientes(connection.token).then(setPendingItems);
            void loadAccounts(connection.token);
            void getResumenMensual(connection.token, selectedPeriod).then(setMonthlySummary);
          }}
        />
      ) : null}

      {screen === "transferir" ? (
        <form className="transaction-form transfer-form" onSubmit={submitTransfer}>
          <div className="transfer-accounts">
            <label className="form-field">
              <span>Desde</span>
              <select value={transferOriginId} onChange={(event) => {
                setTransferOriginId(event.target.value);
                if (event.target.value === transferDestinationId) setTransferDestinationId(accounts.find((account) => account.id !== event.target.value)?.id ?? "");
              }}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.nombre} · {currency(account.saldoActual)}</option>)}
              </select>
              <small>Disponible: {currency(accounts.find((account) => account.id === transferOriginId)?.saldoActual ?? 0)}</small>
            </label>
            <span className="transfer-arrow" aria-hidden="true">→</span>
            <label className="form-field">
              <span>Hacia</span>
              <select value={transferDestinationId} onChange={(event) => setTransferDestinationId(event.target.value)}>
                {accounts.filter((account) => account.id !== transferOriginId).map((account) => <option key={account.id} value={account.id}>{account.nombre}</option>)}
              </select>
            </label>
          </div>
          <MoneyInput value={transferAmount} onChange={setTransferAmount} />
          <label className="form-field"><span>Fecha</span><input type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} /></label>
          <label className="form-field"><span>Nota <small>(opcional)</small></span><input type="text" maxLength={60} value={transferNote} onChange={(event) => setTransferNote(event.target.value)} placeholder="¿Para qué es?" /><small className="character-count">{transferNote.length}/60</small></label>
          <button className="primary-action" disabled={isSaving || accounts.length < 2} type="submit">{isSaving ? "Registrando..." : "Transferir"}</button>
        </form>
      ) : null}

      {screen === "nuevo" ? (
        <form className="transaction-form" onSubmit={submitExpense}>
           <MoneyInput value={amount} onChange={setAmount} autoFocus />

           <div className="date-section">
             <span className="date-section-title">Fecha</span>
               <label className="date-field" aria-label="Fecha"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
             <div className="date-controls">
               <div className="date-shortcuts" aria-label="Atajos de fecha">
                 <button type="button" className={date === dateValue() ? "selected" : ""} onClick={() => setDate(dateValue())}>Hoy</button>
                 <button type="button" className={date === dateValue(-1) ? "selected" : ""} onClick={() => setDate(dateValue(-1))}>Ayer</button>
               </div>
             </div>
           </div>

           <div className="account-note">
             <button className="account-picker-button" type="button" disabled={accounts.length === 0} onClick={() => setIsExpenseAccountOpen(true)}>
               <span>Cuenta</span><strong>{accounts.find((account) => account.id === selectedAccountId)?.nombre ?? "No hay cuentas configuradas"}</strong><b>{currency(accounts.find((account) => account.id === selectedAccountId)?.saldoActual ?? 0)}</b>
             </button>
           </div>

          <CategorySelector value={category} onChange={setCategory} />

          <label className="form-field">
            <span>Nota <small>(opcional)</small></span>
            <input type="text" maxLength={60} value={note} onChange={(event) => setNote(event.target.value)} placeholder="¿En qué fue?" />
            <small className="character-count">{note.length}/60</small>
          </label>

          <button className="primary-action" disabled={isSaving || accounts.length === 0} type="submit">
            {isSaving ? "Registrando..." : "Registrar gasto"}
          </button>
        </form>
      ) : null}

      {isExpenseAccountOpen ? <div className="modal-backdrop" role="presentation">
        <section className="account-picker-modal" aria-labelledby="expense-account-title">
          <div className="section-heading"><h2 id="expense-account-title">Elegir cuenta</h2><button className="icon-button" type="button" aria-label="Cerrar" title="Cerrar" onClick={() => setIsExpenseAccountOpen(false)}><X size={19} /></button></div>
          <div className="account-picker-list">
            {accounts.map((account) => <button className={account.id === selectedAccountId ? "selected" : ""} type="button" key={account.id} onClick={() => { setSelectedAccountId(account.id); setIsExpenseAccountOpen(false); }}><span>{account.nombre}</span><strong>{currency(account.saldoActual)}</strong></button>)}
          </div>
        </section>
      </div> : null}

      {screen === "movimientos" ? <Movimientos token={connection.token} accounts={accounts} onRegisterExpense={() => setScreen("nuevo")} /> : null}

      {screen === "analisis" ? <Analisis token={connection.token} initialPeriod={selectedPeriod} /> : null}

      {screen === "metas" ? (
        <section className="empty-page">
          <h2>Metas</h2>
          <p>Esta pantalla necesita endpoints de lectura. Preferimos mostrar un estado honesto antes que datos ficticios.</p>
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button className={screen === "inicio" ? "active" : ""} type="button" onClick={() => setScreen("inicio")}>Inicio</button>
        <button className={screen === "movimientos" ? "active" : ""} type="button" onClick={() => setScreen("movimientos")}>Movimientos</button>
        <button className="add-button" type="button" onClick={() => setScreen("nuevo")}>+</button>
        <button className={screen === "analisis" ? "active" : ""} type="button" onClick={() => setScreen("analisis")}>Análisis</button>
        <button className={screen === "metas" ? "active" : ""} type="button" onClick={() => setScreen("metas")}>Metas</button>
      </nav>

      {isConfigOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="connection-modal" onSubmit={accounts.length ? saveConnection : submitAccount}>
            <div>
              <p className="eyebrow">{accounts.length ? "CONEXIÓN LOCAL" : "PRIMER PASO"}</p>
              <h2>{accounts.length ? "Configuración" : "Creá tu primera cuenta"}</h2>
              <p>{accounts.length ? "El token se guarda solo durante esta sesión del navegador." : "El saldo inicial se carga una vez y el saldo actual siempre se calcula."}</p>
            </div>
            <label className="form-field">
              <span>Token de API</span>
              <input required type="password" value={draftConnection.token} onChange={(event) => setDraftConnection({ ...draftConnection, token: event.target.value })} />
            </label>
            {!accounts.length ? <>
              <label className="form-field">
                <span>Nombre de la cuenta</span>
                <input required value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Banco principal" />
              </label>
              <label className="form-field">
                <span>Entidad para OCR <small>(opcional)</small></span>
                <input value={accountEntity} onChange={(event) => setAccountEntity(event.target.value)} placeholder="Mercado Pago" />
              </label>
              <label className="form-field">
                <span>Tipo de cuenta</span>
                <select value={accountType} onChange={(event) => setAccountType(event.target.value as TipoCuenta)}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="BILLETERA_VIRTUAL">Billetera virtual</option>
                  <option value="CUENTA_BANCARIA">Cuenta bancaria</option>
                  <option value="TARJETA_CREDITO">Tarjeta de crédito</option>
                </select>
              </label>
              <label className="form-field">
                <span>Saldo inicial</span>
                <input inputMode="decimal" type="number" step="0.01" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} placeholder={accountType === "TARJETA_CREDITO" ? "Deuda actual" : "0"} />
              </label>
            </> : null}
            <div className="modal-actions">
              {accounts.length ? <button type="button" onClick={() => setIsConfigOpen(false)}>Cancelar</button> : null}
              <button className="primary-action" disabled={isCreatingAccount} type="submit">{isCreatingAccount ? "Guardando..." : accounts.length ? "Guardar conexión" : "Crear cuenta"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {isAccountsOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="connection-modal" aria-labelledby="accounts-title">
            <div className="section-heading"><h2 id="accounts-title">Mis cuentas</h2><button className="icon-button" type="button" aria-label="Cerrar" title="Cerrar" onClick={() => setIsAccountsOpen(false)}><X size={19} /></button></div>
            <div className="managed-accounts">
              {accounts.map((account) => <article key={account.id}><strong>{account.nombre}</strong><span>{account.nombreEntidad ?? "Sin entidad OCR"} · {currency(account.saldoActual)}</span><button type="button" onClick={() => { setEditingAccountId(account.id); setAccountName(account.nombre); setAccountEntity(account.nombreEntidad ?? ""); }}>Editar</button></article>)}
            </div>
            <form className="form-field" onSubmit={submitManagedAccount}>
              <h3>{editingAccountId ? "Editar cuenta" : "Nueva cuenta"}</h3>
              <input required aria-label="Nombre de cuenta" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Nombre visible" />
              <input aria-label="Entidad para OCR" value={accountEntity} onChange={(event) => setAccountEntity(event.target.value)} placeholder="Entidad para OCR" />
              {!editingAccountId ? <><select aria-label="Tipo de cuenta" value={accountType} onChange={(event) => setAccountType(event.target.value as TipoCuenta)}><option value="EFECTIVO">Efectivo</option><option value="BILLETERA_VIRTUAL">Billetera virtual</option><option value="CUENTA_BANCARIA">Cuenta bancaria</option><option value="TARJETA_CREDITO">Tarjeta de crédito</option></select><input aria-label="Saldo inicial" type="number" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} placeholder="Saldo inicial" /></> : null}
              <div className="modal-actions"><button type="button" onClick={() => { setEditingAccountId(undefined); setAccountName(""); setAccountEntity(""); }}>Limpiar</button><button className="primary-action" disabled={accountFormSaving} type="submit">{accountFormSaving ? "Guardando..." : editingAccountId ? "Guardar cambios" : "Crear cuenta"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
