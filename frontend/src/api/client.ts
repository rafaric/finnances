import type {
  ApiError,
  ActualizarCuentaInput,
  CrearCuentaInput,
  CrearGastoInput,
  CuentaResponseDTO,
  ListTransaccionesParams,
  PaginatedResponseDTO,
  ResumenMensualDTO,
  CrearTransferenciaInput,
  CorregirOcrInput,
  TransferenciaResponseDTO,
  TransaccionResponseDTO,
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
