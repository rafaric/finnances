export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type TipoCuenta =
  | "EFECTIVO"
  | "BILLETERA_VIRTUAL"
  | "CUENTA_BANCARIA"
  | "TARJETA_CREDITO";

export type TipoMovimiento = "GASTO" | "INGRESO";

export type IconoCategoria =
  | "UTENSILIOS_COCINA"
  | "CARRO"
  | "CASA"
  | "LLAVE"
  | "TELEFONO"
  | "CORAZON"
  | "OCULOS"
  | "SUPER"
  | "GIMNASIO"
  | "LIBROS"
  | "AVION"
  | "OTRO";

export type ColorCategoria =
  | "ROJO"
  | "NARANJA"
  | "AMARILLO"
  | "VERDE"
  | "AZUL"
  | "INDIGO"
  | "VIOLETA"
  | "ROSA"
  | "PEZ"
  | "TURQUESA"
  | "BLANCO"
  | "NEGRO";

export type TipoCategoria = "GASTO" | "INGRESO";

export interface CategoriaResponseDTO {
  id: string;
  nombre: string;
  icono: IconoCategoria;
  color: ColorCategoria;
  tipo: TipoCategoria;
  activa: boolean;
  createdAt?: string;
  updatedAt: string;
  uso?: number;
}

export interface SubcategoriaResponseDTO {
  id: string;
  nombre: string;
  categoriaId: string;
  categoria: CategoriaResponseDTO;
  activa?: boolean;
  uso?: number;
}

export type EstadoTransaccion =
  | "CONFIRMADA"
  | "PENDIENTE_REVISION"
  | "PENDIENTE_CATEGORIA";

export interface IngresoResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  fechaCobro: string;
  periodoDisponible: string;
  iniciaCicloFinanciero?: boolean;
  categoria: CategoriaResponseDTO;
  subcategoria?: SubcategoriaResponseDTO;
  cuenta: CuentaResumenDTO;
}

export interface CrearIngresoInput {
  monto: string;
  fechaCobro: string;
  periodoDisponible: string;
  iniciaCicloFinanciero?: boolean;
  cuentaId: string;
  categoriaId: string;
  subcategoriaId?: string;
  idempotencyKey: string;
  confirmarDebitosAutomaticos?: boolean;
}

export type FrecuenciaRecurrente = "MENSUAL";
export const TIPO_MONTO_RECURRENTES = { FIJO: "FIJO", VARIABLE: "VARIABLE" } as const;
export type TipoMontoRecurrente = (typeof TIPO_MONTO_RECURRENTES)[keyof typeof TIPO_MONTO_RECURRENTES];
export type EstadoInstanciaRecurrente = "PROYECTADO" | "CONFIRMADO" | "OMITIDO";

export interface GastoRecurrenteResponseDTO {
  id: string;
  nombre: string;
  montoFijo?: number;
  tipoMonto: TipoMontoRecurrente;
  cuenta: CuentaResumenDTO;
  categoria: CategoriaResponseDTO;
  subcategoria?: SubcategoriaResponseDTO;
  frecuencia: FrecuenciaRecurrente;
  diaDelMes: number;
  activo: boolean;
}

export interface InstanciaRecurrenteResponseDTO {
  id: string;
  fechaVencimiento: string;
  monto: number;
  estado: EstadoInstanciaRecurrente;
  gastoRecurrente: GastoRecurrenteResponseDTO;
  cuentaRealId?: string;
}

export interface CrearRecurrenteInput {
  nombre: string;
  tipoMonto: TipoMontoRecurrente;
  montoFijo?: string;
  cuentaId: string;
  categoriaId: string;
  subcategoriaId?: string;
  diaDelMes: number;
  notas?: string;
}

export interface ActualizarRecurrenteInput extends Partial<CrearRecurrenteInput> {
  activo?: boolean;
}

export type OrigenTransaccion =
  | "APPLE_PAY"
  | "OCR_IA"
  | "MANUAL"
  | "RECURRENTE_CONFIRMADO"
  | "RESUMEN_CONFIRMADO"
  | "CUOTA_CONFIRMADA";

export interface CuentaResumenDTO {
  id: string;
  nombre: string;
  saldoActual: number;
}

export interface CuentaResponseDTO extends CuentaResumenDTO {
  tipo: TipoCuenta;
  banco?: string;
  nombreEntidad?: string;
  ultimosDigitos?: string;
  colorIdentificador?: string;
  saldoInicial: number;
  diaCierre?: number;
  diaPago?: number;
  cuentaDebitoMinimoId?: string;
}

export interface TransaccionResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  comercio?: string;
  nota?: string;
  createdAt?: string;
  origen: OrigenTransaccion;
  categoria: CategoriaResponseDTO;
  subcategoria?: SubcategoriaResponseDTO;
  fecha: string;
  estado: EstadoTransaccion;
  cuenta?: CuentaResumenDTO;
  textoCrudoOCR?: string;
  esTransferenciaAPersona: boolean;
}

export interface PaginatedResponseDTO<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

export interface GastoCategoriaDTO {
  categoria: CategoriaResponseDTO;
  monto: number;
  porcentaje: number;
  subcategorias?: GastoSubcategoriaDTO[];
}

export interface GastoSubcategoriaDTO {
  subcategoria: { id: string; nombre: string };
  monto: number;
  porcentaje: number;
}

export interface ResumenMensualDTO {
  periodo: string;
  fechaCierre?: string;
  fechaVencimiento?: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  margen: number;
  gastosPorCategoria: GastoCategoriaDTO[];
  disponibleLiquido: number;
  deudaTarjetas: number;
  gastosProyectados?: number;
  gastosProyectadosPorCategoria?: GastoCategoriaDTO[];
}

export type EstadoAnalisisInsight = "INVALIDADO" | "GENERANDO" | "DISPONIBLE" | "ERROR";

export interface AnalisisInsightDTO {
  periodo: string;
  contenido?: string;
  estado: EstadoAnalisisInsight;
  generadoEn?: string;
  invalidadoEn: string;
}

export interface TendenciaMesDTO {
  periodo: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  tieneDatos: boolean;
}

export type EstadoConciliacion = "PENDIENTE" | "COINCIDE" | "CON_DIFERENCIA";
export type TipoCargoResumen = "INTERESES" | "IMPUESTOS" | "COMISIONES" | "SEGUROS" | "IVA_INTERESES" | "IVA_COMISIONES" | "IVA_IMPUESTOS" | "IMPUESTO_SELLO";
export type EstadoCargoResumen = "PENDIENTE" | "CONFIRMADO" | "OMITIDO";

export interface ResumenResponseDTO {
  id: string;
  cuentaId: string;
  periodo: string;
  montoTotalInformado: number;
  montoMinimoInformado: number;
  totalConsumosInformado?: number;
  totalConsumosUSDInformado?: number;
  saldoUSDInformado?: number;
  montoPagado?: number;
  fechaPago?: string;
  saldoFinanciado: number;
  entidadInformada?: string;
  ultimosDigitosInformados?: string;
  interesesInformados?: number;
  impuestosInformados?: number;
  comisionesInformadas?: number;
  segurosInformados?: number;
  confianzaOCR?: number;
  diferenciaConciliacion?: number;
  estadoConciliacion: EstadoConciliacion;
  estado: string;
  consumosExtraidos?: ConsumoExtraidoDTO[];
}

export interface ConsumoExtraidoDTO {
  fecha: string | null;
  comercio: string | null;
  monto: number;
  moneda: "ARS" | "USD";
  cuotaActual: number | null;
  cuotasTotales: number | null;
  estado?: "COINCIDE" | "SIN_REGISTRAR";
  cuotaId?: string;
  compraId?: string;
}

export interface CargoResumenResponseDTO {
  id: string;
  resumenId: string;
  tipo: TipoCargoResumen;
  monto: number;
  estado: EstadoCargoResumen;
  transaccionId?: string;
}

export interface PagoResumenResponseDTO {
  id: string;
  resumenId: string;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  monto: number;
  fecha: string;
  tipo: "MANUAL" | "DEBITO_AUTOMATICO";
}

export interface CrearCompraInput {
  montoTotal: string;
  comercio: string;
  fechaCompra: string;
  cantidadCuotas: number;
  cuentaId: string;
  categoriaId: string;
  moneda?: "ARS" | "USD";
}

export interface CompraResponseDTO {
  id: string;
  montoTotal: number;
  moneda: "ARS" | "USD";
  comercio: string;
  fechaCompra: string;
  cantidadCuotas: number;
  cuentaId: string;
  cuotas: CuotaResponseDTO[];
}

export interface CuotaResponseDTO { id: string; numeroCuota: number; monto: number; moneda: "ARS" | "USD"; fechaImputacion: string; estado: string; }

export interface CrearCuentaInput {
  nombre: string;
  tipo: TipoCuenta;
  saldoInicial?: string;
  nombreEntidad?: string;
  banco?: string;
  ultimosDigitos?: string;
  colorIdentificador?: string;
  diaCierre?: number;
  diaPago?: number;
  cuentaDebitoMinimoId?: string | null;
}

export type ActualizarCuentaInput = Partial<Omit<CrearCuentaInput, "tipo" | "saldoInicial">>;

export interface CrearGastoInput {
  monto: string;
  cuentaId: string;
  categoriaId: string;
  subcategoriaId?: string;
  origen: "MANUAL";
  idempotencyKey: string;
  fecha: string;
  comercio?: string;
  nota?: string;
}

export interface CrearWalletInput {
  monto: string;
  comercio: string;
  tarjeta: string;
  fecha?: string;
  idempotencyKey: string;
}

export interface CorregirOcrInput {
  monto?: string;
  categoriaId?: string;
  comercio?: string;
  fecha?: string;
  cuentaId?: string;
  subcategoriaId?: string;
}

export interface TransferenciaResponseDTO {
  id: string;
  cuentaOrigen: CuentaResumenDTO;
  cuentaDestino: CuentaResumenDTO;
  monto: number;
  fecha: string;
  nota?: string;
  createdAt?: string;
}

export interface CrearTransferenciaInput {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: string;
  fecha?: string;
  nota?: string;
  idempotencyKey: string;
}

export interface ListTransaccionesParams {
  cuentaId?: string;
  periodo?: string;
  categoriaId?: string;
  estado?: EstadoTransaccion;
  tipo?: TipoMovimiento;
  page?: number;
  limit?: number;
}
