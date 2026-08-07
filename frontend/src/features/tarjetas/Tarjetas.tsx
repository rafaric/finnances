import { useEffect, useRef, useState } from "react";
import { analizarResumenPdf, crearCompra, eliminarCompra, listCargosResumen, listCategorias, listCompras, listResumens, reconciliarResumen, resolverCargoResumen } from "../../api/client";
import type { CargoResumenResponseDTO, CategoriaResponseDTO, CompraResponseDTO, ConsumoExtraidoDTO, CuentaResponseDTO, ResumenResponseDTO } from "../../api/types";

interface TarjetasProps {
  token: string;
  accounts: CuentaResponseDTO[];
}

const labels: Record<CargoResumenResponseDTO["tipo"], string> = {
  INTERESES: "Intereses",
  IMPUESTOS: "Impuestos",
  COMISIONES: "Comisiones",
  SEGUROS: "Seguros",
  IVA_INTERESES: "IVA sobre intereses",
  IVA_COMISIONES: "IVA sobre comisiones",
  IVA_IMPUESTOS: "IVA sobre impuestos",
  IMPUESTO_SELLO: "Impuesto al sello",
};

function money(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function formatConsumption(consumption: ConsumoExtraidoDTO): string {
  if (!consumption.fecha) return "Fecha no detectada";
  const value = consumption.fecha.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : (() => {
        const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
        return match ? new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00`) : new Date("invalid");
      })();
  if (Number.isNaN(date.getTime())) return "Fecha no detectada";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(date);
}

export function Tarjetas({ token, accounts }: TarjetasProps) {
  const cards = accounts.filter((account) => account.tipo === "TARJETA_CREDITO");
  const [accountId, setAccountId] = useState(cards[0]?.id ?? "");
  const [file, setFile] = useState<File>();
  const [summary, setSummary] = useState<ResumenResponseDTO>();
  const [summaries, setSummaries] = useState<ResumenResponseDTO[]>([]);
  const [purchases, setPurchases] = useState<CompraResponseDTO[]>([]);
  const [charges, setCharges] = useState<CargoResumenResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [purchaseMerchant, setPurchaseMerchant] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [purchaseInstallments, setPurchaseInstallments] = useState("1");
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [categories, setCategories] = useState<CategoriaResponseDTO[]>([]);
  const [purchaseCategoryId, setPurchaseCategoryId] = useState("");
  const purchaseFormRef = useRef<HTMLDivElement>(null);
  const [selectedConsumptionLabel, setSelectedConsumptionLabel] = useState<string>();

  function preparePurchaseDraft(nextSummary: ResumenResponseDTO) {
    if (nextSummary.estadoConciliacion !== "CON_DIFERENCIA" || nextSummary.diferenciaConciliacion == null) return;
    setPurchaseAmount(Math.abs(nextSummary.diferenciaConciliacion).toFixed(2));
    setPurchaseDate(`${nextSummary.periodo}-01`);
    setPurchaseInstallments("1");
  }

  function selectConsumption(consumption: ConsumoExtraidoDTO) {
    setPurchaseMerchant(consumption.comercio ?? "");
    setSelectedConsumptionLabel(consumption.comercio ?? "Consumo seleccionado");
    setPurchaseAmount((consumption.monto * (consumption.cuotasTotales ?? 1)).toFixed(2));
    setPurchaseDate(consumption.fecha && /^\d{4}-\d{2}-\d{2}$/.test(consumption.fecha) ? consumption.fecha : purchaseDate);
    setPurchaseInstallments(String(consumption.cuotasTotales ?? 1));
    setPurchaseCategoryId((current) => current || categories[0]?.id || "");
    window.setTimeout(() => purchaseFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  useEffect(() => {
    if (!accountId && cards[0]) setAccountId(cards[0].id);
  }, [accountId, cards]);

  useEffect(() => {
    if (!accountId) return;
    void Promise.all([listResumens(token, accountId), listCompras(token, accountId)]).then(async ([nextSummaries, nextPurchases]) => {
      setSummaries(nextSummaries);
      setPurchases(nextPurchases);
      const latest = nextSummaries[0];
      if (!latest) return;
      setSummary(latest);
      preparePurchaseDraft(latest);
      setCharges(await listCargosResumen(token, latest.id));
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar los resúmenes."));
  }, [accountId, token]);

  async function selectSummary(id: string) {
    const next = summaries.find((item) => item.id === id);
    if (!next) return;
    setSummary(next);
    preparePurchaseDraft(next);
    setCharges(await listCargosResumen(token, next.id));
  }

  useEffect(() => {
    void listCategorias(token, { tipo: "GASTO", activa: true }).then(setCategories).catch(() => setError("No se pudieron cargar las categorías."));
  }, [token]);

  async function submit() {
    if (!file || !accountId) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await analizarResumenPdf(token, accountId, file);
      setSummary(result.resumen);
      preparePurchaseDraft(result.resumen);
      setCharges(await listCargosResumen(token, result.resumen.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar el resumen.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveCharge(id: string, estado: "CONFIRMADO" | "OMITIDO") {
    try {
      const resolved = await resolverCargoResumen(token, id, estado);
      setCharges((current) => current.map((charge) => charge.id === id ? resolved : charge));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo resolver el cargo.");
    }
  }

  async function addPurchase() {
    if (!summary || !purchaseMerchant.trim() || !purchaseAmount || !accountId || !purchaseCategoryId) return;
    setIsSavingPurchase(true);
    setError(undefined);
    try {
      await crearCompra(token, {
        montoTotal: purchaseAmount,
        comercio: purchaseMerchant.trim(),
        fechaCompra: purchaseDate,
        cantidadCuotas: Number(purchaseInstallments),
        cuentaId: accountId,
        categoriaId: purchaseCategoryId,
      });
      const updatedSummary = await reconciliarResumen(token, summary.id);
      setSummary(updatedSummary);
      preparePurchaseDraft(updatedSummary);
      setPurchaseMerchant("");
      setPurchaseAmount("");
      setPurchaseInstallments("1");
      setPurchaseCategoryId("");
      setSelectedConsumptionLabel(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la compra.");
    } finally {
      setIsSavingPurchase(false);
    }
  }

  async function removePurchase(compraId: string) {
    if (!summary || !window.confirm("¿Eliminar esta compra y sus cuotas proyectadas?")) return;
    try {
      await eliminarCompra(token, compraId);
      setPurchases((current) => current.filter((purchase) => purchase.id !== compraId));
      setSummary(await reconciliarResumen(token, summary.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la compra.");
    }
  }

  return <section className="cards-content">
    <div className="cards-intro">
      <p className="eyebrow">TARJETAS</p>
      <h2>Subí tu resumen sin cargarlo a mano.</h2>
      <p>El PDF se procesa en el backend. Vas a revisar los datos antes de que cualquier cargo financiero afecte tus movimientos.</p>
    </div>

    {!cards.length ? <div className="empty-page"><h2>Primero configurá una tarjeta</h2><p>Necesitás una cuenta de tipo Tarjeta de crédito para analizar resúmenes.</p></div> : <>
      <div className="card-picker-row">
        <label className="form-field"><span>Tarjeta</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{cards.map((card) => <option key={card.id} value={card.id}>{card.nombre}{card.ultimosDigitos ? ` ···· ${card.ultimosDigitos}` : ""}</option>)}</select></label>
        <label className="form-field"><span>PDF protegido</span><input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0])} /></label>
      </div>
      <button className="primary-action" type="button" disabled={!file || isLoading} onClick={() => void submit()}>{isLoading ? "Analizando..." : "Analizar resumen"}</button>
    </>}

    {error ? <p className="error-state" role="alert">{error}</p> : null}
    {summary ? <section className="statement-review">
      {summaries.length > 1 ? <label className="form-field"><span>Resumen a revisar</span><select value={summary.id} onChange={(event) => void selectSummary(event.target.value)}>{summaries.map((item) => <option key={item.id} value={item.id}>{item.periodo} · {money(item.montoTotalInformado)}</option>)}</select></label> : null}
      <div className="section-heading"><div><p className="eyebrow">REVISIÓN</p><h2>{summary.periodo}</h2></div><span className={`reconciliation-badge ${summary.estadoConciliacion.toLowerCase()}`}>{summary.estadoConciliacion.replace("_", " ")}</span></div>
      <div className="statement-metrics"><div><span>Total informado</span><strong>{money(summary.montoTotalInformado)}</strong></div><div><span>Mínimo</span><strong>{money(summary.montoMinimoInformado)}</strong></div><div><span>Consumos</span><strong>{summary.totalConsumosInformado == null ? "No detectado" : money(summary.totalConsumosInformado)}</strong></div><div><span>Diferencia</span><strong>{summary.diferenciaConciliacion == null ? "Pendiente" : money(summary.diferenciaConciliacion)}</strong></div></div>
      <p className="review-note">Este resumen queda pendiente de revisión. Los consumos no se crean nuevamente; sólo se revisan los cargos financieros detectados.</p>
      {summary.consumosExtraidos?.length ? <section className="consumption-queue"><div className="section-heading"><div><h3>Consumos para conciliar</h3><p>{summary.consumosExtraidos.filter((item) => item.estado !== "COINCIDE").length} por revisar de {summary.consumosExtraidos.length}</p></div><span>{summary.consumosExtraidos.filter((item) => item.estado === "COINCIDE").length} coinciden</span></div><div className="consumption-list">{summary.consumosExtraidos.map((consumption, index) => <article className={`consumption-row ${consumption.estado === "COINCIDE" ? "matched" : ""}`} key={`${consumption.fecha}-${consumption.comercio}-${index}`}><div><strong>{consumption.comercio ?? "Comercio no detectado"}</strong><span>{formatConsumption(consumption)} · {consumption.cuotaActual && consumption.cuotasTotales ? `Cuota ${consumption.cuotaActual}/${consumption.cuotasTotales}` : "Compra única"}</span></div><b>{money(consumption.monto)}</b><span className="consumption-status">{consumption.estado === "COINCIDE" ? "Coincide con una cuota" : "Sin registrar"}</span>{consumption.estado !== "COINCIDE" ? <button className="consumption-action" type="button" onClick={() => selectConsumption(consumption)}>Registrar esta compra</button> : consumption.compraId ? <button className="consumption-action" type="button" onClick={() => void removePurchase(consumption.compraId!)}>Eliminar compra</button> : null}</article>)}</div></section> : null}
      {summary.consumosExtraidos?.some((item) => item.estado !== "COINCIDE") ? <div className="missing-purchase" ref={purchaseFormRef}><div><h3>{selectedConsumptionLabel ? `Registrar ${selectedConsumptionLabel}` : "Hay consumos sin registrar"}</h3><p>{selectedConsumptionLabel ? "Revisá los datos y elegí una categoría antes de guardar." : "La diferencia representa compras o cargos que todavía no están en Finnances. Agregá la compra manualmente; no se crea de forma automática."}</p></div><div className="purchase-form"><label className="form-field"><span>Comercio</span><input value={purchaseMerchant} onChange={(event) => setPurchaseMerchant(event.target.value)} placeholder="Nombre del comercio" /></label><label className="form-field"><span>Categoría</span><select required value={purchaseCategoryId} onChange={(event) => setPurchaseCategoryId(event.target.value)}><option value="">Elegí una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label><label className="form-field"><span>Monto total</span><input inputMode="decimal" type="number" min="0.01" step="0.01" value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} placeholder="0,00" /></label><label className="form-field"><span>Fecha de compra</span><input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label><label className="form-field"><span>Cuotas</span><input type="number" min="1" max="120" value={purchaseInstallments} onChange={(event) => setPurchaseInstallments(event.target.value)} /></label><button className="primary-action" type="button" disabled={isSavingPurchase || !purchaseMerchant.trim() || !purchaseAmount || !purchaseCategoryId} onClick={() => void addPurchase()}>{isSavingPurchase ? "Registrando..." : "Agregar compra"}</button></div></div> : null}
      {charges.length ? <div className="charge-list"><h3>Cargos financieros</h3>{charges.map((charge) => <article className="charge-row" key={charge.id}><div><strong>{labels[charge.tipo]}</strong><span>{charge.estado === "PENDIENTE" ? "Requiere confirmación" : charge.estado}</span></div><b>{money(charge.monto)}</b>{charge.estado === "PENDIENTE" ? <div className="charge-actions"><button type="button" onClick={() => void resolveCharge(charge.id, "OMITIDO")}>Omitir</button><button className="primary-action" type="button" onClick={() => void resolveCharge(charge.id, "CONFIRMADO")}>Confirmar cargo</button></div> : null}</article>)}</div> : <p className="review-note">No se detectaron cargos financieros para revisar.</p>}
       <div className="purchase-library"><h3>Compras cargadas</h3>{purchases.length ? purchases.map((purchase) => <article className="purchase-library-row" key={purchase.id}><div><strong>{purchase.comercio}</strong><span>{money(purchase.montoTotal)} · {purchase.cantidadCuotas} cuotas</span></div><button className="consumption-action" type="button" onClick={() => void removePurchase(purchase.id)}>Eliminar</button></article>) : <p className="review-note">Todavía no hay compras cargadas.</p>}</div>
     </section> : null}
  </section>;
}
