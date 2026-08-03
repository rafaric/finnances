import { FormEvent, useEffect, useState } from "react";
import { crearGasto, type TransaccionResponseDTO } from "./api";
import "./index.css";

const CATEGORIES = [
  ["COMIDA", "Comida"],
  ["TRANSPORTE", "Transporte"],
  ["VIVIENDA", "Vivienda"],
  ["SERVICIOS", "Servicios"],
  ["OCIO", "Ocio"],
  ["DEUDAS", "Deudas"],
  ["OTROS", "Otros"],
] as const;

type Category = (typeof CATEGORIES)[number][0];
type Screen = "inicio" | "movimientos" | "nuevo" | "analisis" | "metas";

interface Connection {
  accountId: string;
  token: string;
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [connection, setConnection] = useState<Connection>(() => ({
    accountId: sessionStorage.getItem("finnances.accountId") ?? "",
    token: sessionStorage.getItem("finnances.apiToken") ?? "",
  }));
  const [draftConnection, setDraftConnection] = useState(connection);
  const [isConfigOpen, setIsConfigOpen] = useState(!connection.accountId);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("COMIDA");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [lastTransaction, setLastTransaction] = useState<TransaccionResponseDTO>();

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextConnection = {
      accountId: draftConnection.accountId.trim(),
      token: draftConnection.token.trim(),
    };
    sessionStorage.setItem("finnances.accountId", nextConnection.accountId);
    sessionStorage.setItem("finnances.apiToken", nextConnection.token);
    setConnection(nextConnection);
    setIsConfigOpen(false);
    setNotice("Conexión guardada para esta sesión.");
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection.accountId || !connection.token) {
      setIsConfigOpen(true);
      setNotice("Configurá una cuenta y el token antes de registrar un gasto.");
      return;
    }

    setIsSaving(true);
    try {
      const transaction = await crearGasto(connection.token, {
        monto: amount,
        cuentaId: connection.accountId,
        categoria: category,
        origen: "MANUAL",
        fecha,
        idempotencyKey: crypto.randomUUID(),
      });
      setLastTransaction(transaction);
      setAmount("");
      setNotice(`Gasto registrado. Saldo actual: ${currency(transaction.cuenta.saldoActual)}.`);
      setScreen("inicio");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo registrar el gasto.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FINNANCES</p>
          <h1>{screen === "nuevo" ? "Nueva transacción" : "Tu plata, en contexto."}</h1>
        </div>
        <button className="settings-button" type="button" onClick={() => setIsConfigOpen(true)}>
          Conexión
        </button>
      </header>

      {notice ? <p className="notice" role="status">{notice}</p> : null}

      {screen === "inicio" ? (
        <section className="home-content">
          <div className="month-strip" aria-label="Mes seleccionado">
            <button type="button">Jun</button>
            <button type="button">Jul</button>
            <button className="active" type="button">Ago 2026</button>
          </div>

          <section className="balance-panel">
            <p>Disponible líquido</p>
            <strong>{lastTransaction ? currency(lastTransaction.cuenta.saldoActual) : "Sin datos aún"}</strong>
            <span>{lastTransaction ? lastTransaction.cuenta.nombre : "Conectá una cuenta para ver tu saldo."}</span>
          </section>

          <div className="period-grid">
            <article>
              <span>Ingresos del período</span>
              <strong>Sin datos</strong>
              <p>Próxima lectura de API</p>
            </article>
            <article>
              <span>Gastos del período</span>
              <strong>Sin datos</strong>
              <p>Solo transacciones confirmadas</p>
            </article>
          </div>

          <section className="section-heading">
            <div>
              <h2>Acciones rápidas</h2>
              <p>Capturá lo importante sin perder contexto.</p>
            </div>
          </section>

          <div className="actions-grid">
            <button type="button" onClick={() => setScreen("nuevo")}>Registrar gasto</button>
            <button type="button" disabled>Transferir</button>
            <button type="button" disabled>Recurrentes</button>
            <button type="button" disabled>Asistente</button>
          </div>

          <section className="empty-section">
            <h2>Mis cuentas</h2>
            <p>El backend todavía no expone una consulta de cuentas. Cuando exista, esta vista mostrará los saldos derivados sin editar nada manualmente.</p>
          </section>
        </section>
      ) : null}

      {screen === "nuevo" ? (
        <form className="transaction-form" onSubmit={submitExpense}>
          <div className="mode-toggle" aria-label="Tipo de movimiento">
            <button className="selected" type="button">Gasto</button>
            <button type="button" disabled>Ingreso</button>
          </div>

          <label className="amount-field">
            <span>Monto</span>
            <div><b>$</b><input required inputMode="decimal" min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div>
          </label>

          <label className="form-field">
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <fieldset>
            <legend>Categoría</legend>
            <div className="category-grid">
              {CATEGORIES.map(([value, label]) => (
                <button className={category === value ? "selected" : ""} key={value} type="button" onClick={() => setCategory(value)}>{label}</button>
              ))}
            </div>
          </fieldset>

          <div className="account-note">
            <span>Cuenta</span>
            <strong>{connection.accountId ? "Cuenta conectada" : "Sin configurar"}</strong>
            <button type="button" onClick={() => setIsConfigOpen(true)}>Cambiar</button>
          </div>

          <button className="primary-action" disabled={isSaving} type="submit">
            {isSaving ? "Registrando..." : "Registrar gasto"}
          </button>
        </form>
      ) : null}

      {screen === "movimientos" || screen === "analisis" || screen === "metas" ? (
        <section className="empty-page">
          <h2>{screen === "movimientos" ? "Movimientos" : screen === "analisis" ? "Análisis" : "Metas"}</h2>
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
          <form className="connection-modal" onSubmit={saveConnection}>
            <div>
              <p className="eyebrow">CONEXIÓN LOCAL</p>
              <h2>Conectá tu cuenta</h2>
              <p>El token se guarda solo durante esta sesión del navegador.</p>
            </div>
            <label className="form-field">
              <span>ID de cuenta</span>
              <input required value={draftConnection.accountId} onChange={(event) => setDraftConnection({ ...draftConnection, accountId: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Token de API</span>
              <input required type="password" value={draftConnection.token} onChange={(event) => setDraftConnection({ ...draftConnection, token: event.target.value })} />
            </label>
            <div className="modal-actions">
              {connection.accountId ? <button type="button" onClick={() => setIsConfigOpen(false)}>Cancelar</button> : null}
              <button className="primary-action" type="submit">Guardar conexión</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

export default App;
