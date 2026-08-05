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

export type Categoria =
  | "COMIDA"
  | "TRANSPORTE"
  | "VIVIENDA"
  | "SERVICIOS"
  | "OCIO"
  | "DEUDAS"
  | "OTROS";

export type EstadoTransaccion =
  | "CONFIRMADA"
  | "PENDIENTE_REVISION"
  | "PENDIENTE_CATEGORIA";

export type TipoMovimiento = "GASTO" | "INGRESO";

export type OrigenTransaccion =
  | "APPLE_PAY"
  | "OCR_IA"
  | "MANUAL"
  | "RECURRENTE_CONFIRMADO"
  | "RESUMEN_CONFIRMADO";

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
}

export interface TransaccionResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  comercio?: string;
  origen: OrigenTransaccion;
  categoria: Categoria;
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
  categoria: Categoria;
  monto: number;
  porcentaje: number;
}

export interface ResumenMensualDTO {
  periodo: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  margen: number;
  gastosPorCategoria: GastoCategoriaDTO[];
  disponibleLiquido: number;
  deudaTarjetas: number;
}

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
}

export type ActualizarCuentaInput = Partial<Omit<CrearCuentaInput, "tipo" | "saldoInicial">>;

export interface CrearGastoInput {
  monto: string;
  cuentaId: string;
  categoria: Categoria;
  origen: "MANUAL";
  idempotencyKey: string;
  fecha: string;
  comercio?: string;
  nota?: string;
}

export interface CorregirOcrInput {
  monto?: string;
  categoria?: Categoria;
  comercio?: string;
  fecha?: string;
  cuentaId?: string;
}

export interface TransferenciaResponseDTO {
  id: string;
  cuentaOrigen: CuentaResumenDTO;
  cuentaDestino: CuentaResumenDTO;
  monto: number;
  fecha: string;
  nota?: string;
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
  categoria?: Categoria;
  estado?: EstadoTransaccion;
  tipo?: TipoMovimiento;
  page?: number;
  limit?: number;
}
