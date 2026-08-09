import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTransacciones, listCategorias } from "../../api/client";
import type { CuentaResponseDTO, CategoriaResponseDTO, PaginatedResponseDTO, TransaccionResponseDTO } from "../../api/types";
import { Movimientos } from "./Movimientos";

vi.mock("../../api/client", () => ({
  listTransacciones: vi.fn(),
  listCategorias: vi.fn(),
}));

const listTransaccionesMock = vi.mocked(listTransacciones);
const listCategoriasMock = vi.mocked(listCategorias);
const account: CuentaResponseDTO = {
  id: "account-1",
  nombre: "Cuenta principal",
  saldoActual: 10000,
  tipo: "EFECTIVO",
  saldoInicial: 10000,
};

const categoriaComida: CategoriaResponseDTO = {
  id: "cat-comida",
  nombre: "Comida",
  icono: "SUPER",
  color: "ROJO",
  tipo: "GASTO",
  activa: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const categoriaTransporte: CategoriaResponseDTO = {
  ...categoriaComida,
  id: "cat-transporte",
  nombre: "Transporte",
  icono: "CARRO",
};

function pageResult(page: number, hasNextPage = false): PaginatedResponseDTO<TransaccionResponseDTO> {
  return {
    items: page === 2 ? [{
      id: "transaction-2",
      monto: -1200,
      moneda: "ARS",
      origen: "MANUAL",
      categoria: categoriaComida,
      fecha: "2026-08-03T00:00:00.000Z",
      estado: "CONFIRMADA",
      esTransferenciaAPersona: false,
      cuenta: { id: account.id, nombre: account.nombre, saldoActual: account.saldoActual },
    }] : [{
      id: "transaction-1",
      monto: -800,
      moneda: "ARS",
      origen: "OCR_IA",
      categoria: categoriaTransporte,
      fecha: "2026-08-02T00:00:00.000Z",
      estado: "CONFIRMADA",
      esTransferenciaAPersona: false,
      cuenta: { id: account.id, nombre: account.nombre, saldoActual: account.saldoActual },
    }],
    page,
    limit: 50,
    total: 21,
    hasNextPage,
  };
}

beforeEach(() => {
  listTransaccionesMock.mockReset();
  listTransaccionesMock.mockResolvedValue(pageResult(1, true));
  listCategoriasMock.mockResolvedValue([categoriaComida, categoriaTransporte]);
});

describe("Movimientos", () => {
  it("loads the first page and displays the transaction origin", async () => {
    render(<Movimientos token="token-123" accounts={[account]} onRegisterExpense={vi.fn()} />);

    expect(await screen.findByTitle("OCR")).toBeInTheDocument();
    expect(listTransaccionesMock).toHaveBeenCalledWith("token-123", expect.objectContaining({ page: 1, limit: 100 }));
  });

  it("navigates pages and resets to page one when a filter changes", async () => {
    const user = userEvent.setup();
    listTransaccionesMock
      .mockResolvedValueOnce(pageResult(1, true))
      .mockResolvedValueOnce(pageResult(2, false))
      .mockResolvedValueOnce(pageResult(1, true));
    render(<Movimientos token="token-123" accounts={[account]} onRegisterExpense={vi.fn()} />);

    await screen.findByTitle("OCR");
    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByTitle("Manual");
    expect(listTransaccionesMock).toHaveBeenLastCalledWith("token-123", expect.objectContaining({ page: 2 }));

    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await user.selectOptions(screen.getByLabelText("Categoría"), "cat-comida");
    await waitFor(() => expect(listTransaccionesMock).toHaveBeenLastCalledWith("token-123", expect.objectContaining({ page: 1, categoriaId: "cat-comida" })));
  });

  it("offers an expense action for an empty result", async () => {
    const onRegisterExpense = vi.fn();
    listTransaccionesMock.mockResolvedValue({ ...pageResult(1), items: [], total: 0 });
    const user = userEvent.setup();
    render(<Movimientos token="token-123" accounts={[account]} onRegisterExpense={onRegisterExpense} />);

    await screen.findByText("No hay movimientos");
    await user.click(screen.getByRole("button", { name: "Registrar gasto" }));
    expect(onRegisterExpense).toHaveBeenCalledOnce();
  });

  it("retries the same query after an error", async () => {
    const user = userEvent.setup();
    listTransaccionesMock
      .mockRejectedValueOnce(new Error("Servidor no disponible"))
      .mockResolvedValueOnce(pageResult(1, false));
    render(<Movimientos token="token-123" accounts={[account]} onRegisterExpense={vi.fn()} />);

    expect(await screen.findByText("Servidor no disponible")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByTitle("OCR");
    expect(listTransaccionesMock).toHaveBeenLastCalledWith("token-123", expect.objectContaining({ page: 1, limit: 100 }));
  });
});
