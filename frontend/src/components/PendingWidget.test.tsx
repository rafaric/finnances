import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { corregirOcr, listCategorias, listSubcategorias } from "../api/client";
import type { CuentaResponseDTO, CategoriaResponseDTO, TransaccionResponseDTO } from "../api/types";
import { PendingWidget } from "./PendingWidget";

vi.mock("../api/client", () => ({
  corregirOcr: vi.fn(),
  listCategorias: vi.fn(),
  listSubcategorias: vi.fn(),
}));

const corregirOcrMock = vi.mocked(corregirOcr);
const listCategoriasMock = vi.mocked(listCategorias);
const listSubcategoriasMock = vi.mocked(listSubcategorias);
const account: CuentaResponseDTO = { id: "account-1", nombre: "Cuenta principal", saldoActual: 5000, tipo: "EFECTIVO", saldoInicial: 5000 };

const categoriaOtros: CategoriaResponseDTO = {
  id: "cat-otros",
  nombre: "Otros",
  icono: "OTRO",
  color: "BLANCO",
  tipo: "GASTO",
  activa: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const pending: TransaccionResponseDTO = {
  id: "ocr-1",
  monto: 1250,
  moneda: "ARS",
  origen: "OCR_IA",
  categoria: categoriaOtros,
  fecha: "2026-08-03T00:00:00.000Z",
  estado: "PENDIENTE_REVISION",
  esTransferenciaAPersona: false,
  textoCrudoOCR: "Pago desconocido total $1.250",
};

beforeEach(() => {
  corregirOcrMock.mockReset();
  listCategoriasMock.mockResolvedValue([categoriaOtros]);
  listSubcategoriasMock.mockResolvedValue([]);
});

describe("PendingWidget", () => {
  it("shows unresolved account and expands original OCR text", async () => {
    const user = userEvent.setup();
    render(<PendingWidget token="token-123" accounts={[account]} items={[pending]} onChanged={vi.fn()} />);

    expect(screen.getByText("Falta cuenta o datos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Comprobante sin comercio/ }));
    await user.click(screen.getByText("Ver texto original"));
    expect(screen.getByText("Pago desconocido total $1.250")).toBeVisible();
  });

  it("submits corrections and notifies the parent", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    corregirOcrMock.mockResolvedValue({ ...pending, estado: "CONFIRMADA", cuenta: { id: account.id, nombre: account.nombre, saldoActual: 3750 } });
    render(<PendingWidget token="token-123" accounts={[account]} items={[pending]} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /Comprobante sin comercio/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Cuenta" }), account.id);
    await user.click(screen.getByRole("button", { name: "Confirmar gasto" }));

    await waitFor(() => expect(corregirOcrMock).toHaveBeenCalledWith("token-123", "ocr-1", expect.objectContaining({ cuentaId: account.id, categoriaId: "cat-otros" })));
    expect(onChanged).toHaveBeenCalledOnce();
  });

});
