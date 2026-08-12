import { useState } from "react";
import type { CuentaResponseDTO, TransaccionResponseDTO } from "../api/types";
import { corregirOcr } from "../api/client";
import { CategorySelector } from "./CategorySelector";

interface PendingWidgetProps {
  token: string;
  accounts: CuentaResponseDTO[];
  items: TransaccionResponseDTO[];
  onChanged: () => void;
}

function money(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Math.abs(value));
}

export function PendingWidget({ token, accounts, items, onChanged }: PendingWidgetProps) {
  const [selected, setSelected] = useState<TransaccionResponseDTO>();
  const [amount, setAmount] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>();
  const [subcategoriaId, setSubcategoriaId] = useState<string>();
  const [merchant, setMerchant] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  function open(item: TransaccionResponseDTO) {
    setSelected(item);
    setAmount(item.monto ? String(Math.abs(item.monto)) : "");
    setCategoriaId(item.categoria?.id);
    setSubcategoriaId(item.subcategoria?.id);
    setMerchant(item.comercio ?? "");
    setAccountId(item.cuenta?.id ?? "");
    setDate(item.fecha.slice(0, 10));
    setNote(item.nota ?? "");
    setError(undefined);
  }

  async function submit() {
    if (!selected) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await corregirOcr(token, selected.id, {
        monto: amount || undefined,
        categoriaId: categoriaId || undefined,
        subcategoriaId: subcategoriaId || undefined,
        comercio: merchant || undefined,
        fecha: date || undefined,
        cuentaId: accountId || undefined,
        nota: note.trim() || null,
      });
      setSelected(undefined);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la corrección.");
    } finally { setIsSaving(false); }
  }

  return (
    <section className="pending-widget">
      <div className="section-heading"><div><p className="eyebrow">PARA REVISAR</p><h2>Pendientes de confirmar</h2></div><strong>{items.length}</strong></div>
      <div className="pending-list">
        {items.map((item) => <button className="pending-item" key={item.id} type="button" onClick={() => open(item)}><span>{item.esTransferenciaAPersona ? `Transferencia a ${item.comercio ?? "persona"}` : item.comercio ?? "Comprobante sin comercio"}</span><strong>{item.monto ? money(item.monto) : "Monto pendiente"}</strong><small>{item.estado === "PENDIENTE_CATEGORIA" ? "Falta categoría" : item.cuenta ? item.cuenta.nombre : "Falta cuenta o datos"}</small></button>)}
      </div>
      {selected ? (
        <div className="pending-editor">
          <div className="section-heading">
            <h3>Corregir comprobante</h3>
            <button type="button" onClick={() => setSelected(undefined)}>Cerrar</button>
          </div>
          {selected.textoCrudoOCR ? (
            <details>
              <summary>Ver texto original</summary>
              <pre className="ocr-text">{selected.textoCrudoOCR}</pre>
            </details>
          ) : null}
          <label className="form-field">
            <span>Monto</span>
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Cuenta</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.nombre} · {money(account.saldoActual)}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Comercio</span>
            <input value={merchant} onChange={(event) => setMerchant(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Notas <small>(opcional)</small></span>
            <input maxLength={120} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. Pago de servicio" />
          </label>
          <CategorySelector
            token={token}
            tipo="GASTO"
            categoriaId={categoriaId}
            subcategoriaId={subcategoriaId}
            onCategoriaChange={setCategoriaId}
            onSubcategoriaChange={setSubcategoriaId}
          />
          {error ? <p className="notice">{error}</p> : null}
          <button className="primary-action" type="button" disabled={isSaving} onClick={() => void submit()}>
            {isSaving ? "Guardando..." : "Confirmar gasto"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
