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
  createdAt: string;
  updatedAt: string;
}

export interface SubcategoriaResponseDTO {
  id: string;
  nombre: string;
  categoriaId: string;
  categoria: CategoriaResponseDTO;
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
  categoria: CategoriaResponseDTO;
  subcategoria?: SubcategoriaResponseDTO;
  cuenta: CuentaResumenDTO;
}

export interface CrearIngresoInput {
  monto: string;
  fechaCobro: string;
  periodoDisponible: string;
  cuentaId: string;
  categoriaId: string;
  subcategoriaId?: string;
  idempotencyKey: string;
}

export type FrecuenciaRecurrente = "MENSUAL";
export type EstadoInstanciaRecurrente = "PROYECTADO" | "CONFIRMADO" | "OMITIDO";

export interface GastoRecurrenteResponseDTO {
  id: string;
  nombre: string;
  montoFijo: number;
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
  montoFijo: string;
  cuentaId: string;
  categoriaId: string;
  subcategoriaId?: string;
  diaDelMes: number;
  notas?: string;
}

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
  categoriaId: string;
  subcategoriaId?: string;
  origen: "MANUAL";
  idempotencyKey: string;
  fecha: string;
  comercio?: string;
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
