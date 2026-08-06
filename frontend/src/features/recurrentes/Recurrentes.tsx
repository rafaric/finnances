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
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";

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

export function Recurrentes({ token, accounts }: RecurrentesProps) {
  const [items, setItems] = useState<GastoRecurrenteResponseDTO[]>([]);
  const [instances, setInstances] = useState<InstanciaRecurrenteResponseDTO[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string>();
  const [subcategoryId, setSubcategoryId] = useState<string>();
  const [day, setDay] = useState("1");
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
      await crearRecurrente(token, { nombre: name, montoFijo: amount, cuentaId: accountId, categoriaId: categoryId, subcategoriaId: subcategoryId, diaDelMes: Number(day) });
      setName(""); setAmount(""); setCategoryId(undefined); setSubcategoryId(undefined); setIsFormOpen(false);
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

  return <section className="recurrentes-page">
    <div className="section-heading"><div><p className="eyebrow">COMPROMISOS</p><h2>Gastos recurrentes</h2></div><button className="primary-action" type="button" onClick={() => setIsFormOpen((current) => !current)}>+ Nuevo</button></div>
    {isFormOpen ? <div className="recurrente-form">
      <label className="form-field"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alquiler, gimnasio..." /></label>
      <label className="form-field"><span>Monto mensual</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label className="form-field"><span>Cuenta</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.nombre}</option>)}</select></label>
      <label className="form-field"><span>Día del mes</span><input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} /></label>
      <CategorySelector token={token} tipo="GASTO" categoriaId={categoryId} subcategoriaId={subcategoryId} onCategoriaChange={setCategoryId} onSubcategoriaChange={setSubcategoryId} />
      <button className="primary-action" type="button" disabled={!name || !amount || !categoryId} onClick={() => void submit()}>Guardar recurrente</button>
    </div> : null}
    {isLoading ? <LoadingState label="Cargando recurrentes..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : <>
      <div className="recurrente-list">{items.length ? items.map((item) => <article className="recurrente-card" key={item.id}><div><strong>{item.nombre}</strong><span>{item.categoria.nombre}{item.subcategoria ? ` · ${item.subcategoria.nombre}` : ""} · Día {item.diaDelMes}</span></div><b>{currency(item.montoFijo)}</b><button type="button" onClick={() => void generate(item)}>Generar instancia</button></article>) : <p className="empty-page">No hay gastos recurrentes creados.</p>}</div>
      {instances.length ? <div className="recurrente-instances"><h3>Instancias proyectadas</h3>{instances.map((instance) => <article className="recurrente-card" key={instance.id}><div><strong>{instance.gastoRecurrente.nombre}</strong><span>{date(instance.fechaVencimiento)} · {instance.gastoRecurrente.cuenta.nombre}</span></div><b>{currency(instance.monto)}</b><button type="button" onClick={() => void resolve(instance, "confirmar")}>Confirmar</button><button type="button" onClick={() => void resolve(instance, "omitir")}>Omitir</button></article>)}</div> : null}
    </>}
  </section>;
}
