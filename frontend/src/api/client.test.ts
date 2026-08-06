import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, crearGasto, crearTransferencia, listTransacciones } from "./client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("API client", () => {
  it("sends bearer token and transaction query parameters", async () => {
    const response = {
      items: [],
      page: 2,
      limit: 20,
      total: 0,
      hasNextPage: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    globalThis.fetch = fetchMock;

    await listTransacciones("token-123", {
      periodo: "2026-08",
      cuentaId: "account-1",
      page: 2,
      limit: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/transacciones?periodo=2026-08&cuentaId=account-1&page=2&limit=20",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-123" },
      }),
    );
  });

  it("serializes a manual expense as JSON", async () => {
    const transaction = { id: "transaction-1" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(transaction), { status: 200 }));
    globalThis.fetch = fetchMock;
    const input = {
      monto: "1200",
      cuentaId: "account-1",
      categoriaId: "cat-comida",
      origen: "MANUAL" as const,
      idempotencyKey: "request-1",
      fecha: "2026-08-03",
      nota: "Almuerzo",
    };

    await crearGasto("token-123", input);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/gastos",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("serializes an internal transfer as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "transfer-1" }), { status: 201 }));
    globalThis.fetch = fetchMock;
    const input = {
      cuentaOrigenId: "account-1",
      cuentaDestinoId: "account-2",
      monto: "500",
      fecha: "2026-08-03",
      nota: "Ahorro",
      idempotencyKey: "transfer-request-1",
    };

    await crearTransferencia("token-123", input);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/transferencias",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });

  it("exposes structured API errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "BAD_REQUEST",
      message: "Monto inválido",
      details: { field: "monto" },
    }), { status: 400 }));

    const request = listTransacciones("token-123");

    await expect(request).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "BAD_REQUEST",
      status: 400,
      message: "Monto inválido",
      details: { field: "monto" },
    } satisfies Partial<ApiRequestError>);
  });
});
