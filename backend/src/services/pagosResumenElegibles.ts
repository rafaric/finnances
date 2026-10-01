/**
 * A payment belongs to a summary's calculations only from its closing date.
 *
 * Summaries without a closing date have no reliable temporal boundary, so no
 * payment is eligible. This is intentionally conservative: it prevents an
 * accidentally associated historical payment from changing financial totals.
 */
export function pagoEsElegibleParaResumen(
  fechaPago: Date,
  fechaCierre: Date | null,
): boolean {
  return fechaCierre != null && fechaPago >= fechaCierre;
}

export function sumarPagosElegibles(
  pagos: ReadonlyArray<{ fecha: Date; monto: unknown }>,
  fechaCierre: Date | null,
): number {
  return pagos
    .filter((pago) => pagoEsElegibleParaResumen(pago.fecha, fechaCierre))
    .reduce((total, pago) => total + Number(pago.monto), 0);
}
