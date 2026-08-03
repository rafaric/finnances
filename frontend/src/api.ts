export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface CuentaResumenDTO {
  id: string;
  nombre: string;
  saldoActual: number;
}

export interface TransaccionResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  comercio?: string;
  origen: string;
  categoria: string;
  fecha: string;
  estado: string;
  cuenta: CuentaResumenDTO;
}

export interface CrearGastoInput {
  monto: string;
  cuentaId: string;
  categoria: string;
  origen: "MANUAL";
  idempotencyKey: string;
  fecha: string;
}

function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:4000";
}

export async function crearGasto(
  token: string,
  input: CrearGastoInput,
): Promise<TransaccionResponseDTO> {
  const response = await fetch(`${getApiUrl()}/api/v1/gastos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new Error(error.message);
  }

  return (await response.json()) as TransaccionResponseDTO;
}
