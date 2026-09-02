import { useEffect, useState } from "react";
import {
  actualizarRecurrente,
  eliminarRecurrente,
  crearRecurrente,
  confirmarInstanciaRecurrente,
  listarInstanciasRecurrentes,
  omitirInstanciaRecurrente,
  listarRecurrentes,
} from "../../api/client";
import type {
  CuentaResponseDTO,
  GastoRecurrenteResponseDTO,
  InstanciaRecurrenteResponseDTO,
  TipoMontoRecurrente,
} from "../../api/types";
import { CategorySelector } from "../../components/CategorySelector";
import { AccountPicker } from "../../components/AccountPicker";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { MoneyInput } from "../../components/MoneyInput";
import { PeriodPills } from "../../components/PeriodPills";
import { currentPeriod } from "../../lib/periods";

interface RecurrentesProps {
  token: string;
  accounts: CuentaResponseDTO[];
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value));
}

function daysUntilDue(day: number): string {
  const today = new Date();
  const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), Math.min(day, lastDayThisMonth));
  const due = dueThisMonth >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
    ? dueThisMonth
    : new Date(today.getFullYear(), today.getMonth() + 1, Math.min(day, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()));
  const days = Math.ceil((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Falta 1 día";
  return `Faltan ${days} días`;
}


export function Recurrentes({ token, accounts }: RecurrentesProps) {
  const [items, setItems] = useState<GastoRecurrenteResponseDTO[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState<TipoMontoRecurrente>("FIJO");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string>();
  const [subcategoryId, setSubcategoryId] = useState<string>();
  const [day, setDay] = useState("1");
  const [customDayOpen, setCustomDayOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [instances, setInstances] = useState<InstanciaRecurrenteResponseDTO[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [instanceAmounts, setInstanceAmounts] = useState<Record<string, string>>({});
  const [instanceDates, setInstanceDates] = useState<Record<string, string>>({});
  const [periodo, setPeriodo] = useState(() => currentPeriod());
  const [instanceStatus, setInstanceStatus] = useState<"TODOS" | "PROYECTADO" | "CONFIRMADO" | "OMITIDO">("TODOS");

  async function load() {
    setIsLoading(true);
    setError(undefined);
    try {
      const [nextItems, nextInstances] = await Promise.all([listarRecurrentes(token, true), listarInstanciasRecurrentes(token, { periodo, ...(instanceStatus === "TODOS" ? {} : { estado: instanceStatus }) })]);
      setItems(nextItems);
      setInstances(nextInstances);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los recurrentes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token, periodo, instanceStatus]);

  async function submit() {
    if (!categoryId || !accountId) return;
    try {
      const input = { nombre: name, tipoMonto: amountType, ...(amountType === "FIJO" ? { montoFijo: amount } : {}), cuentaId: accountId, categoriaId: categoryId, subcategoriaId: subcategoryId, diaDelMes: Number(day), notas: notes || undefined };
      if (editingId) await actualizarRecurrente(token, editingId, input);
      else await crearRecurrente(token, input);
      setName(""); setAmount(""); setAmountType("FIJO"); setNotes(""); setCategoryId(undefined); setSubcategoryId(undefined); setDay("1"); setEditingId(undefined); setIsFormOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear el recurrente.");
    }
  }

  const isCustomDay = ![1, 3, 5, 10, 15, 20, 25].includes(Number(day));

  function edit(item: GastoRecurrenteResponseDTO) {
    setIsFormOpen(true);
    setEditingId(item.id);
    setName(item.nombre);
    setAmount(item.montoFijo?.toFixed(2) ?? "");
    setAmountType(item.tipoMonto);
    setAccountId(item.cuenta?.id ?? "");
    setCategoryId(item.categoria?.id);
    setSubcategoryId(item.subcategoria?.id);
    setDay(String(item.diaDelMes));
    setNotes(item.notas ?? "");
    setCustomDayOpen(false);
  }

  async function toggleActive(item: GastoRecurrenteResponseDTO) {
    try { await actualizarRecurrente(token, item.id, { activo: !item.activo }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el recurrente."); }
  }

  async function remove(item: GastoRecurrenteResponseDTO) {
    if (!window.confirm(`¿Eliminar "${item.nombre}" y sus proyecciones pendientes?`)) return;
    try {
      await eliminarRecurrente(token, item.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el recurrente.");
    }
  }


  async function confirmInstance(instance: InstanciaRecurrenteResponseDTO) {
    const monto = instanceAmounts[instance.id] ?? "";
    if (instance.gastoRecurrente.tipoMonto === "VARIABLE" && !monto) return;
    try { await confirmarInstanciaRecurrente(token, instance.id, { monto: monto || undefined, fecha: instanceDates[instance.id] || undefined }); setInstanceAmounts((current) => { const next = { ...current }; delete next[instance.id]; return next; }); setInstanceDates((current) => { const next = { ...current }; delete next[instance.id]; return next; }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo confirmar el vencimiento."); }
  }

  async function omitInstance(instanceId: string) {
    try { await omitirInstanciaRecurrente(token, instanceId); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo omitir el vencimiento."); }
  }

  return <section className="recurrentes-page">
     <div className="section-heading"><div><p className="eyebrow">COMPROMISOS</p><h2>Recurrentes</h2></div><button className="primary-action" type="button" onClick={() => setIsFormOpen(true)}>+ Nuevo</button></div>
    {isFormOpen ? <div className="modal-backdrop" role="presentation">
       <section className="recurrente-form" role="dialog" aria-modal="true" aria-labelledby="new-recurring-title">
       <div className="section-heading"><h2 id="new-recurring-title">{editingId ? "Editar recurrente" : "Nuevo gasto recurrente"}</h2><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => { setEditingId(undefined); setIsFormOpen(false); }}>×</button></div>
       <label className="form-field"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alquiler, gimnasio..." /></label>
       <label className="form-field"><span>Tipo de importe</span><select value={amountType} onChange={(event) => setAmountType(event.target.value as TipoMontoRecurrente)}><option value="FIJO">Importe fijo</option><option value="VARIABLE">Importe variable</option></select></label>
       {amountType === "FIJO" ? <MoneyInput value={amount} onChange={setAmount} /> : <p className="form-hint">El importe se informará al recibir cada factura.</p>}
      <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} disabled={!accounts.length} />
      <div className="recurring-day-field"><span className="recurring-field-label">Día del mes</span><div className="recurring-day-pills">{[1, 3, 5, 10, 15, 20, 25].map((value) => <button className={Number(day) === value && !customDayOpen ? "selected" : ""} key={value} type="button" onClick={() => { setDay(String(value)); setCustomDayOpen(false); }}>{value}</button>)}<button className={customDayOpen || isCustomDay ? "selected" : ""} type="button" onClick={() => setCustomDayOpen(true)}>Otro día{isCustomDay ? `: ${day}` : ""}</button></div>{customDayOpen ? <div className="recurring-all-days">{Array.from({ length: 31 }, (_, index) => index + 1).map((value) => <button className={Number(day) === value ? "selected" : ""} key={value} type="button" onClick={() => { setDay(String(value)); setCustomDayOpen(false); }}>{value}</button>)}</div> : null}</div>
      <CategorySelector token={token} tipo="GASTO" categoriaId={categoryId} subcategoriaId={subcategoryId} onCategoriaChange={setCategoryId} onSubcategoriaChange={setSubcategoryId} />
      <label className="form-field"><span>Nota <small>(opcional)</small></span><input maxLength={60} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="¿Qué gasto es?" /><small className="character-count">{notes.length}/60</small></label>
       <button className="primary-action" type="button" disabled={!name || (amountType === "FIJO" && !amount) || !categoryId} onClick={() => void submit()}>Guardar recurrente</button>
      </section>
    </div> : null}
    {isLoading ? <LoadingState label="Cargando recurrentes..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : <>
       <section className="recurring-rules"><div className="section-heading"><div><p className="eyebrow">REGLAS ACTIVAS</p><h2>Compromisos</h2></div></div><div className="recurrente-list">{items.filter((item) => item.activo).length ? items.filter((item) => item.activo).map((item) => <article className="recurrente-card" key={item.id}><div><strong>{item.nombre}</strong><span>{daysUntilDue(item.diaDelMes)} · {item.tipoMonto === "VARIABLE" ? "Importe variable" : currency(item.montoFijo ?? 0)}</span></div><div><button type="button" onClick={() => edit(item)}>Editar</button><button type="button" onClick={() => void toggleActive(item)}>Pausar</button></div></article>) : <p className="empty-page">No hay reglas activas.</p>}</div><div className="section-heading"><div><p className="eyebrow">REGLAS PAUSADAS</p><h2>Inactivas</h2></div></div><div className="recurrente-list paused-rules">{items.filter((item) => !item.activo).length ? items.filter((item) => !item.activo).map((item) => <article className="recurrente-card" key={item.id}><div><strong>{item.nombre}</strong><span>Sin nuevas proyecciones</span></div><button type="button" onClick={() => void toggleActive(item)}>Reactivar</button></article>) : <p className="empty-page">No hay reglas pausadas.</p>}</div></section>
       <section className="recurring-instances"><div className="section-heading"><div><p className="eyebrow">HISTORIAL</p><h2>Vencimientos</h2></div></div><PeriodPills value={periodo} onChange={setPeriodo} /><div className="movement-type-pills" aria-label="Estado de instancia"><button className={instanceStatus === "TODOS" ? "active" : ""} type="button" onClick={() => setInstanceStatus("TODOS")}>Todos</button>{(["PROYECTADO", "CONFIRMADO", "OMITIDO"] as const).map((status) => <button className={instanceStatus === status ? "active" : ""} key={status} type="button" onClick={() => setInstanceStatus(status)}>{status === "PROYECTADO" ? "Pendientes" : status === "CONFIRMADO" ? "Confirmados" : "Omitidos"}</button>)}</div>{instances.length ? instances.map((instance) => <article className="recurring-instance-row" key={instance.id}><div><strong>{instance.gastoRecurrente.nombre}</strong><span>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(instance.fechaVencimiento))} · {instance.gastoRecurrente.tipoMonto === "VARIABLE" && instance.monto == null ? "Importe pendiente" : currency(instance.monto ?? 0)}</span></div>{instance.estado === "PROYECTADO" ? <><input aria-label={`Importe ${instance.gastoRecurrente.nombre}`} type="number" min="0.01" step="0.01" placeholder={instance.gastoRecurrente.tipoMonto === "VARIABLE" ? "Importe real" : undefined} value={instanceAmounts[instance.id] ?? ""} onChange={(event) => setInstanceAmounts((current) => ({ ...current, [instance.id]: event.target.value }))} /><input aria-label={`Fecha ${instance.gastoRecurrente.nombre}`} type="date" value={instanceDates[instance.id] ?? ""} onChange={(event) => setInstanceDates((current) => ({ ...current, [instance.id]: event.target.value }))} /><button type="button" onClick={() => void confirmInstance(instance)}>Confirmar</button><button type="button" onClick={() => void omitInstance(instance.id)}>Omitir</button></> : <span>{instance.estado === "CONFIRMADO" ? "Confirmado" : "Omitido"}</span>}</article>) : <p className="empty-page">No hay instancias para este filtro.</p>}</section>
       <section className="recurring-rules paused-rules"><div className="section-heading"><div><p className="eyebrow">GESTION</p><h2>Eliminar reglas pausadas</h2></div></div><div className="recurrente-list">{items.filter((item) => !item.activo).map((item) => <article className="recurrente-card" key={`delete-${item.id}`}><div><strong>{item.nombre}</strong><span>Elimina también sus proyecciones pendientes</span></div><button type="button" onClick={() => void remove(item)}>Eliminar</button></article>)}</div></section>
     </>}
  </section>;
}
