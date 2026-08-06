import { useEffect, useState } from "react";
import {
  confirmarInstanciaRecurrente,
  crearRecurrente,
  generarInstanciaRecurrente,
  listarInstanciasRecurrentes,
  listarRecurrentes,
  omitirInstanciaRecurrente,
} from "../../api/client";
import type {
  CuentaResponseDTO,
  GastoRecurrenteResponseDTO,
  InstanciaRecurrenteResponseDTO,
} from "../../api/types";
import { CategorySelector } from "../../components/CategorySelector";
import { AccountPicker } from "../../components/AccountPicker";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { MoneyInput } from "../../components/MoneyInput";

interface RecurrentesProps {
  token: string;
  accounts: CuentaResponseDTO[];
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value));
}

function date(value: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(value));
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
  const [instances, setInstances] = useState<InstanciaRecurrenteResponseDTO[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string>();
  const [subcategoryId, setSubcategoryId] = useState<string>();
  const [day, setDay] = useState("1");
  const [customDayOpen, setCustomDayOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function load() {
    setIsLoading(true);
    setError(undefined);
    try {
      const [nextItems, nextInstances] = await Promise.all([listarRecurrentes(token), listarInstanciasRecurrentes(token)]);
      setItems(nextItems);
      setInstances(nextInstances);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los recurrentes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token]);

  async function submit() {
    if (!categoryId || !accountId) return;
    try {
      await crearRecurrente(token, { nombre: name, montoFijo: amount, cuentaId: accountId, categoriaId: categoryId, subcategoriaId: subcategoryId, diaDelMes: Number(day), notas: notes || undefined });
      setName(""); setAmount(""); setNotes(""); setCategoryId(undefined); setSubcategoryId(undefined); setDay("1"); setIsFormOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear el recurrente.");
    }
  }

  async function generate(item: GastoRecurrenteResponseDTO) {
    try { await generarInstanciaRecurrente(token, item.id); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo generar la instancia."); }
  }

  async function resolve(instance: InstanciaRecurrenteResponseDTO, action: "confirmar" | "omitir") {
    try {
      if (action === "confirmar") await confirmarInstanciaRecurrente(token, instance.id);
      else await omitirInstanciaRecurrente(token, instance.id);
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo resolver la instancia."); }
  }

  const isCustomDay = ![1, 3, 5, 10, 15, 20, 25].includes(Number(day));

  return <section className="recurrentes-page">
    <div className="section-heading"><div><p className="eyebrow">COMPROMISOS</p><h2>Recurrentes</h2></div><button className="primary-action" type="button" onClick={() => setIsFormOpen(true)}>+ Nuevo</button></div>
    {isFormOpen ? <div className="modal-backdrop" role="presentation">
      <section className="recurrente-form" role="dialog" aria-modal="true" aria-labelledby="new-recurring-title">
      <div className="section-heading"><h2 id="new-recurring-title">Nuevo gasto recurrente</h2><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsFormOpen(false)}>×</button></div>
      <label className="form-field"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alquiler, gimnasio..." /></label>
      <MoneyInput value={amount} onChange={setAmount} />
      <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} disabled={!accounts.length} />
      <div className="recurring-day-field"><span className="recurring-field-label">Día del mes</span><div className="recurring-day-pills">{[1, 3, 5, 10, 15, 20, 25].map((value) => <button className={Number(day) === value && !customDayOpen ? "selected" : ""} key={value} type="button" onClick={() => { setDay(String(value)); setCustomDayOpen(false); }}>{value}</button>)}<button className={customDayOpen || isCustomDay ? "selected" : ""} type="button" onClick={() => setCustomDayOpen(true)}>Otro día{isCustomDay ? `: ${day}` : ""}</button></div>{customDayOpen ? <div className="recurring-all-days">{Array.from({ length: 31 }, (_, index) => index + 1).map((value) => <button className={Number(day) === value ? "selected" : ""} key={value} type="button" onClick={() => { setDay(String(value)); setCustomDayOpen(false); }}>{value}</button>)}</div> : null}</div>
      <CategorySelector token={token} tipo="GASTO" categoriaId={categoryId} subcategoriaId={subcategoryId} onCategoriaChange={setCategoryId} onSubcategoriaChange={setSubcategoryId} />
      <label className="form-field"><span>Nota <small>(opcional)</small></span><input maxLength={60} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="¿Qué gasto es?" /><small className="character-count">{notes.length}/60</small></label>
      <button className="primary-action" type="button" disabled={!name || !amount || !categoryId} onClick={() => void submit()}>Guardar recurrente</button>
      </section>
    </div> : null}
    {isLoading ? <LoadingState label="Cargando recurrentes..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : <>
      <div className="recurrente-list">{items.length ? items.map((item) => <article className="recurrente-card" key={item.id}><div><strong>{item.nombre}</strong><span>{daysUntilDue(item.diaDelMes)}</span></div><b>{currency(item.montoFijo)}</b><button type="button" title="Crea el vencimiento para poder confirmarlo u omitirlo" onClick={() => void generate(item)}>Proyectar vencimiento</button></article>) : <p className="empty-page">No hay gastos recurrentes creados.</p>}</div>
      {instances.length ? <div className="recurrente-instances"><h3>Instancias proyectadas</h3>{instances.map((instance) => <article className="recurrente-card" key={instance.id}><div><strong>{instance.gastoRecurrente.nombre}</strong><span>{date(instance.fechaVencimiento)} · {instance.gastoRecurrente.cuenta.nombre}</span></div><b>{currency(instance.monto)}</b><button type="button" onClick={() => void resolve(instance, "confirmar")}>Confirmar</button><button type="button" onClick={() => void resolve(instance, "omitir")}>Omitir</button></article>)}</div> : null}
    </>}
  </section>;
}
