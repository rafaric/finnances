import { useEffect, useState, type FormEvent } from "react";
import { actualizarCuenta, crearCuenta, crearGasto, crearIngreso, crearTransferencia, getResumenMensual, listCuentas, listPendientes } from "./api/client";
import type { CuentaResponseDTO, ResumenMensualDTO, TipoCuenta, TransaccionResponseDTO } from "./api/types";
import { CategorySelector } from "./components/CategorySelector";
import { MoneyInput } from "./components/MoneyInput";
import { Home } from "./features/home/Home";
import { Movimientos } from "./features/movimientos/Movimientos";
import { Analisis } from "./features/analisis/Analisis";
import { Categorias } from "./features/categorias/Categorias";
import { Recurrentes } from "./features/recurrentes/Recurrentes";
import { currentPeriod } from "./lib/periods";
import { Bolt, X } from "lucide-react";
import "./index.css";
type Screen = "inicio" | "movimientos" | "nuevo" | "transferir" | "analisis" | "categorias" | "recurrentes";

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

function browserStorage(kind: "local" | "session"): Storage | undefined {
  try {
    return kind === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [connection, setConnection] = useState<Connection>(() => ({
    token: browserStorage("local")?.getItem("finnances.apiToken") ?? browserStorage("session")?.getItem("finnances.apiToken") ?? "",
  }));
  const [draftConnection, setDraftConnection] = useState(connection);
  const [rememberConnection, setRememberConnection] = useState(() => browserStorage("local")?.getItem("finnances.rememberConnection") === "true");
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<"GASTO" | "INGRESO">("GASTO");
  const [categoriaId, setCategoriaId] = useState<string>();
  const [subcategoriaId, setSubcategoriaId] = useState<string>();
  const [date, setDate] = useState(() => dateValue());
  const [note, setNote] = useState("");
  const [incomePeriod, setIncomePeriod] = useState(() => currentPeriod());
  const [transferOriginId, setTransferOriginId] = useState("");
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(() => dateValue());
  const [transferNote, setTransferNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [monthlySummary, setMonthlySummary] = useState<ResumenMensualDTO>();
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const period = selectedPeriod || currentPeriod();
  const [isLoadingSummary, setIsLoadingSummary] = useState(Boolean(connection.token));
  const [summaryError, setSummaryError] = useState<string>();
  const [summaryRefreshVersion, setSummaryRefreshVersion] = useState(0);
  const [pendingItems, setPendingItems] = useState<TransaccionResponseDTO[]>([]);

  useEffect(() => {
    setSelectedPeriod(currentPeriod());
  }, []);

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
      getResumenMensual(connection.token, period),
      listPendientes(connection.token),
    ])
      .then(([, summary, pending]) => { setMonthlySummary(summary); setPendingItems(pending); })
      .catch((error) => setSummaryError(error instanceof Error ? error.message : "No se pudo cargar el resumen."))
      .finally(() => setIsLoadingSummary(false));
  }, [connection.token, period, summaryRefreshVersion]);

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
    browserStorage("session")?.removeItem("finnances.apiToken");
    browserStorage("local")?.removeItem("finnances.apiToken");
    if (rememberConnection) {
      browserStorage("local")?.setItem("finnances.apiToken", nextConnection.token);
      browserStorage("local")?.setItem("finnances.rememberConnection", "true");
    } else {
      browserStorage("session")?.setItem("finnances.apiToken", nextConnection.token);
      browserStorage("local")?.removeItem("finnances.rememberConnection");
    }
    setConnection(nextConnection);
    setNotice("Conexión guardada para esta sesión.");
  }

  async function connectWithToken() {
    const token = draftConnection.token.trim();
    if (!token) return;
    setIsConnecting(true);
    setAccountsError(undefined);
    try {
      browserStorage("session")?.removeItem("finnances.apiToken");
      browserStorage("local")?.removeItem("finnances.apiToken");
      if (rememberConnection) {
        browserStorage("local")?.setItem("finnances.apiToken", token);
        browserStorage("local")?.setItem("finnances.rememberConnection", "true");
      } else {
        browserStorage("session")?.setItem("finnances.apiToken", token);
        browserStorage("local")?.removeItem("finnances.rememberConnection");
      }
      setConnection({ token });
      setNotice("Conexión guardada para esta sesión.");
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : "No se pudo guardar la conexión.");
    } finally {
      setIsConnecting(false);
    }
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
       browserStorage("session")?.removeItem("finnances.apiToken");
       browserStorage("local")?.removeItem("finnances.apiToken");
       if (rememberConnection) {
         browserStorage("local")?.setItem("finnances.apiToken", token);
         browserStorage("local")?.setItem("finnances.rememberConnection", "true");
       } else {
         browserStorage("session")?.setItem("finnances.apiToken", token);
         browserStorage("local")?.removeItem("finnances.rememberConnection");
       }
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
    if (transactionType === "INGRESO" && !categoriaId) {
      setNotice("Seleccioná una categoría para registrar el ingreso.");
      return;
    }

    setIsSaving(true);
    try {
      if (transactionType === "INGRESO") {
        const income = await crearIngreso(connection.token, {
          monto: amount,
          fechaCobro: date,
          periodoDisponible: incomePeriod,
          cuentaId: selectedAccountId,
          categoriaId: categoriaId!,
          subcategoriaId,
          idempotencyKey: crypto.randomUUID(),
        });
        setAccounts((current) => current.map((account) => account.id === income.cuenta.id ? { ...account, saldoActual: income.cuenta.saldoActual } : account));
        setMonthlySummary(undefined);
        void getResumenMensual(connection.token, period).then(setMonthlySummary).catch(() => undefined);
        setAmount("");
        setCategoriaId(undefined);
        setSubcategoriaId(undefined);
        setNotice(`Ingreso registrado. Saldo actual: ${currency(income.cuenta.saldoActual)}.`);
        setScreen("inicio");
        return;
      }
      const transaction = await crearGasto(connection.token, {
        monto: amount,
        cuentaId: selectedAccountId,
        categoriaId: categoriaId ?? "cat-otros",
        subcategoriaId,
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
         void getResumenMensual(connection.token, period).then(setMonthlySummary).catch(() => undefined);
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
      void getResumenMensual(connection.token, period).then(setMonthlySummary).catch(() => undefined);
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
         {screen === "inicio" ? <div><p className="eyebrow">FINNANCES</p><h1>Tu plata, en contexto.</h1></div> : <h1>{screen === "nuevo" ? "Nueva transacción" : screen === "transferir" ? "Transferir" : screen === "movimientos" ? "Movimientos" : screen === "analisis" ? "Análisis" : screen === "recurrentes" ? "Gastos recurrentes" : "Categorías"}</h1>}
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
           onRetrySummary={() => setSummaryRefreshVersion((current) => current + 1)}
          onRegisterExpense={() => { setTransactionType("GASTO"); setCategoriaId(undefined); setSubcategoriaId(undefined); setScreen("nuevo"); }}
           onRegisterIncome={() => { setTransactionType("INGRESO"); setScreen("nuevo"); }}
           onRecurrentes={() => setScreen("recurrentes")}
          onTransfer={() => {
            setTransferOriginId(accounts[0]?.id ?? "");
            setTransferDestinationId(accounts[1]?.id ?? "");
            setScreen("transferir");
          }}
          onManageAccounts={() => setIsAccountsOpen(true)}
          onPeriodChange={setSelectedPeriod}
          periodo={period}
          token={connection.token}
          pendingItems={pendingItems}
          onPendingChanged={() => {
            void listPendientes(connection.token).then(setPendingItems);
            void loadAccounts(connection.token);
            void getResumenMensual(connection.token, period).then(setMonthlySummary);
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
           <div className="mode-toggle" aria-label="Tipo de movimiento"><button className={transactionType === "GASTO" ? "selected" : ""} type="button" onClick={() => setTransactionType("GASTO")}>Gasto</button><button className={transactionType === "INGRESO" ? "selected" : ""} type="button" onClick={() => setTransactionType("INGRESO")}>Ingreso</button></div>
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

            <CategorySelector token={connection.token} tipo={transactionType} categoriaId={categoriaId} subcategoriaId={subcategoriaId} onCategoriaChange={setCategoriaId} onSubcategoriaChange={setSubcategoriaId} />
            {transactionType === "INGRESO" ? <label className="form-field"><span>Disponible en</span><input type="month" value={incomePeriod} onChange={(event) => setIncomePeriod(event.target.value)} /></label> : null}

          {transactionType === "GASTO" ? <label className="form-field">
            <span>Nota <small>(opcional)</small></span>
            <input type="text" maxLength={60} value={note} onChange={(event) => setNote(event.target.value)} placeholder="¿En qué fue?" />
            <small className="character-count">{note.length}/60</small>
          </label> : null}

           <button className="primary-action" disabled={isSaving || accounts.length === 0} type="submit">
             {isSaving ? "Registrando..." : transactionType === "INGRESO" ? "Registrar ingreso" : "Registrar gasto"}
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

      {screen === "analisis" ? <Analisis token={connection.token} initialPeriod={period} /> : null}

      {screen === "categorias" ? <Categorias token={connection.token} /> : null}
      {screen === "recurrentes" ? <Recurrentes token={connection.token} accounts={accounts} /> : null}

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button className={screen === "inicio" ? "active" : ""} type="button" onClick={() => setScreen("inicio")}>Inicio</button>
        <button className={screen === "movimientos" ? "active" : ""} type="button" onClick={() => setScreen("movimientos")}>Movimientos</button>
        <button className="add-button" type="button" onClick={() => setScreen("nuevo")}>+</button>
        <button className={screen === "analisis" ? "active" : ""} type="button" onClick={() => setScreen("analisis")}>Análisis</button>
        <button className={screen === "categorias" ? "active" : ""} type="button" onClick={() => setScreen("categorias")}>Categorías</button>
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
            <label className="remember-connection"><input type="checkbox" checked={rememberConnection} onChange={(event) => setRememberConnection(event.target.checked)} /><span>Recordar conexión en este dispositivo</span></label>
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
              {!accounts.length ? <button type="button" disabled={isConnecting || !draftConnection.token.trim()} onClick={() => void connectWithToken()}>{isConnecting ? "Conectando..." : "Conectar"}</button> : <button type="button" onClick={() => setIsConfigOpen(false)}>Cancelar</button>}
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
