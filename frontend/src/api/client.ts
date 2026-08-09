import type {
  ApiError,
  ActualizarCuentaInput,
  CrearCuentaInput,
  CrearGastoInput,
  CuentaResponseDTO,
  ListTransaccionesParams,
  PaginatedResponseDTO,
  ResumenMensualDTO,
  AnalisisInsightDTO,
  CrearTransferenciaInput,
  CorregirOcrInput,
  TransferenciaResponseDTO,
  TransaccionResponseDTO,
  CrearIngresoInput,
  IngresoResponseDTO,
  CategoriaResponseDTO,
  SubcategoriaResponseDTO,
  TipoCategoria,
  CrearRecurrenteInput,
  GastoRecurrenteResponseDTO,
  ActualizarRecurrenteInput,
  InstanciaRecurrenteResponseDTO,
  CargoResumenResponseDTO,
  PagoResumenResponseDTO,
  ResumenResponseDTO,
  CrearCompraInput,
  CompraResponseDTO,
} from "./types";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.details = error.details;
    this.status = status;
  }
}

function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:4000";
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let error: ApiError;
    try {
      error = (await response.json()) as ApiError;
    } catch {
      error = {
        code: "INTERNAL_ERROR",
        message: "No se pudo interpretar la respuesta del servidor.",
      };
    }
    throw new ApiRequestError(error, response.status);
  }

  return (await response.json()) as T;
}

export function listCuentas(token: string): Promise<CuentaResponseDTO[]> {
  return request<CuentaResponseDTO[]>(token, "/api/v1/cuentas");
}

export function crearCuenta(
  token: string,
  input: CrearCuentaInput,
): Promise<CuentaResponseDTO> {
  return request<CuentaResponseDTO>(token, "/api/v1/cuentas", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function actualizarCuenta(token: string, cuentaId: string, input: ActualizarCuentaInput): Promise<CuentaResponseDTO> {
  return request<CuentaResponseDTO>(token, `/api/v1/cuentas/${encodeURIComponent(cuentaId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function crearGasto(
  token: string,
  input: CrearGastoInput,
): Promise<TransaccionResponseDTO> {
  return request<TransaccionResponseDTO>(token, "/api/v1/gastos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function crearIngreso(token: string, input: CrearIngresoInput): Promise<IngresoResponseDTO> {
  return request<IngresoResponseDTO>(token, "/api/v1/ingresos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function crearTransferencia(
  token: string,
  input: CrearTransferenciaInput,
): Promise<TransferenciaResponseDTO> {
  return request<TransferenciaResponseDTO>(token, "/api/v1/transferencias", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listTransacciones(
  token: string,
  params: ListTransaccionesParams = {},
): Promise<PaginatedResponseDTO<TransaccionResponseDTO>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return request<PaginatedResponseDTO<TransaccionResponseDTO>>(
    token,
    `/api/v1/transacciones${query ? `?${query}` : ""}`,
  );
}

export function listPendientes(token: string): Promise<TransaccionResponseDTO[]> {
  return request<TransaccionResponseDTO[]>(token, "/api/v1/pendientes");
}

export function corregirOcr(token: string, id: string, input: CorregirOcrInput): Promise<TransaccionResponseDTO> {
  return request<TransaccionResponseDTO>(token, `/api/v1/gastos/ocr/${encodeURIComponent(id)}/corregir`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getResumenMensual(
  token: string,
  periodo: string,
): Promise<ResumenMensualDTO> {
  return request<ResumenMensualDTO>(
    token,
    `/api/v1/resumen-mensual?periodo=${encodeURIComponent(periodo)}`,
  );
}

export function getAnalisisInsight(token: string, periodo: string): Promise<AnalisisInsightDTO> {
  return request<AnalisisInsightDTO>(token, `/api/v1/analisis-insight?periodo=${encodeURIComponent(periodo)}`);
}

export function refreshAnalisisInsight(token: string, periodo: string): Promise<AnalisisInsightDTO> {
  return request<AnalisisInsightDTO>(token, "/api/v1/analisis-insight/refresh", {
    method: "POST",
    body: JSON.stringify({ periodo }),
  });
}

export async function analizarResumenPdf(token: string, cuentaId: string, file: File): Promise<{ resumen: ResumenResponseDTO; requiereRevision: boolean }> {
  const body = new FormData();
  body.append("cuentaId", cuentaId);
  body.append("file", file);
  const response = await fetch(`${getApiUrl()}/api/v1/resumenes/pdf/analizar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new ApiRequestError(error, response.status);
  }
  return (await response.json()) as { resumen: ResumenResponseDTO; requiereRevision: boolean };
}

export function listCargosResumen(token: string, resumenId: string): Promise<CargoResumenResponseDTO[]> {
  return request<CargoResumenResponseDTO[]>(token, `/api/v1/resumenes/${encodeURIComponent(resumenId)}/cargos`);
}

export function resolverCargoResumen(token: string, cargoId: string, estado: "CONFIRMADO" | "OMITIDO"): Promise<CargoResumenResponseDTO> {
  return request<CargoResumenResponseDTO>(token, `/api/v1/cargos-resumen/${encodeURIComponent(cargoId)}`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

export function crearCompra(token: string, input: CrearCompraInput): Promise<CompraResponseDTO> {
  return request<CompraResponseDTO>(token, "/api/v1/compras", { method: "POST", body: JSON.stringify(input) });
}

export async function eliminarCompra(token: string, compraId: string): Promise<void> {
  await request<unknown>(token, `/api/v1/compras/${encodeURIComponent(compraId)}`, { method: "DELETE" });
}

export function listCompras(token: string, cuentaId: string): Promise<CompraResponseDTO[]> {
  return request<CompraResponseDTO[]>(token, `/api/v1/compras?cuentaId=${encodeURIComponent(cuentaId)}`);
}

export function reconciliarResumen(token: string, resumenId: string): Promise<ResumenResponseDTO> {
  return request<ResumenResponseDTO>(token, `/api/v1/resumenes/${encodeURIComponent(resumenId)}/reconciliar`, { method: "POST" });
}

export function listResumens(token: string, cuentaId?: string): Promise<ResumenResponseDTO[]> {
  const query = cuentaId ? `?cuentaId=${encodeURIComponent(cuentaId)}` : "";
  return request<ResumenResponseDTO[]>(token, `/api/v1/resumenes${query}`);
}

export function registrarPagoResumen(token: string, resumenId: string, input: { cuentaOrigenId: string; monto: string; fecha: string; tipo: "MANUAL" }): Promise<unknown> {
  return request<unknown>(token, `/api/v1/resumenes/${encodeURIComponent(resumenId)}/pagos`, { method: "POST", body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }) });
}

export function listPagosResumen(token: string, resumenId: string): Promise<PagoResumenResponseDTO[]> {
  return request<PagoResumenResponseDTO[]>(token, `/api/v1/resumenes/${encodeURIComponent(resumenId)}/pagos`);
}

export function listCategorias(
  token: string,
  params?: { tipo?: TipoCategoria; activa?: boolean },
): Promise<CategoriaResponseDTO[]> {
  const search = new URLSearchParams();
  if (params?.tipo) search.set("tipo", params.tipo);
  if (params?.activa !== undefined) search.set("activa", String(params.activa));
  const query = search.toString();
  return request<CategoriaResponseDTO[]>(
    token,
    `/api/v1/categorias${query ? `?${query}` : ""}`,
  );
}

export function listSubcategorias(
  token: string,
  categoriaId?: string,
  activa?: boolean,
): Promise<SubcategoriaResponseDTO[]> {
  const search = new URLSearchParams();
  if (categoriaId) search.set("categoriaId", categoriaId);
  if (activa !== undefined) search.set("activa", String(activa));
  const query = search.toString();
  return request<SubcategoriaResponseDTO[]>(
    token,
    `/api/v1/subcategorias${query ? `?${query}` : ""}`,
  );
}

export interface CrearCategoriaInput {
  nombre: string;
  icono: string;
  color: string;
  tipo: TipoCategoria;
  activa?: boolean;
}

export interface CrearSubcategoriaInput {
  nombre: string;
  categoriaId: string;
  activa?: boolean;
}

export function crearSubcategoria(token: string, input: CrearSubcategoriaInput): Promise<SubcategoriaResponseDTO> {
  return request<SubcategoriaResponseDTO>(token, "/api/v1/subcategorias", { method: "POST", body: JSON.stringify(input) });
}

export function actualizarSubcategoria(token: string, id: string, input: Partial<CrearSubcategoriaInput>): Promise<SubcategoriaResponseDTO> {
  return request<SubcategoriaResponseDTO>(token, `/api/v1/subcategorias/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function crearCategoria(
  token: string,
  input: CrearCategoriaInput,
): Promise<CategoriaResponseDTO> {
  return request<CategoriaResponseDTO>(token, "/api/v1/categorias", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function actualizarCategoria(
  token: string,
  id: string,
  input: Partial<CrearCategoriaInput>,
): Promise<CategoriaResponseDTO> {
  return request<CategoriaResponseDTO>(token, `/api/v1/categorias/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listarRecurrentes(token: string, incluirInactivos = false): Promise<GastoRecurrenteResponseDTO[]> {
  return request<GastoRecurrenteResponseDTO[]>(token, `/api/v1/recurrentes${incluirInactivos ? "?incluirInactivos=true" : ""}`);
}

export function crearRecurrente(token: string, input: CrearRecurrenteInput): Promise<GastoRecurrenteResponseDTO> {
  return request<GastoRecurrenteResponseDTO>(token, "/api/v1/recurrentes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function actualizarRecurrente(token: string, id: string, input: ActualizarRecurrenteInput): Promise<GastoRecurrenteResponseDTO> {
  return request<GastoRecurrenteResponseDTO>(token, `/api/v1/recurrentes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function listarInstanciasRecurrentes(token: string, params?: { periodo?: string; estado?: "PROYECTADO" | "CONFIRMADO" | "OMITIDO" }): Promise<InstanciaRecurrenteResponseDTO[]> {
  const query = new URLSearchParams();
  if (params?.periodo) query.set("periodo", params.periodo);
  if (params?.estado) query.set("estado", params.estado);
  return request<InstanciaRecurrenteResponseDTO[]>(token, `/api/v1/recurrentes/instancias${query.toString() ? `?${query}` : ""}`);
}

export function proyectarRecurrentes(token: string, periodo: string): Promise<InstanciaRecurrenteResponseDTO[]> {
  return request<InstanciaRecurrenteResponseDTO[]>(token, "/api/v1/recurrentes/proyectar", {
    method: "POST",
    body: JSON.stringify({ periodo }),
  });
}

export function listarInstanciasProximas(token: string, dias = 4): Promise<InstanciaRecurrenteResponseDTO[]> {
  return request<InstanciaRecurrenteResponseDTO[]>(token, `/api/v1/recurrentes/proximas?dias=${dias}`);
}

export function generarInstanciaRecurrente(token: string, recurrenteId: string): Promise<InstanciaRecurrenteResponseDTO> {
  return request<InstanciaRecurrenteResponseDTO>(token, `/api/v1/recurrentes/${encodeURIComponent(recurrenteId)}/instancia`, { method: "POST" });
}

export function confirmarInstanciaRecurrente(token: string, instanciaId: string, input?: { cuentaRealId?: string; monto?: string; fecha?: string }): Promise<InstanciaRecurrenteResponseDTO> {
  return request<InstanciaRecurrenteResponseDTO>(token, `/api/v1/recurrentes/instancias/${encodeURIComponent(instanciaId)}/confirmar`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export function omitirInstanciaRecurrente(token: string, instanciaId: string): Promise<InstanciaRecurrenteResponseDTO> {
  return request<InstanciaRecurrenteResponseDTO>(token, `/api/v1/recurrentes/instancias/${encodeURIComponent(instanciaId)}/omitir`, { method: "POST" });
}
