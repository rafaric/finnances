import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { actualizarCuenta, crearGasto, crearIngreso, crearTransferencia, getResumenMensual, listCuentas, listPendientes, listCategorias, listSubcategorias } from "./api/client";
import type { CuentaResponseDTO, CategoriaResponseDTO, ResumenMensualDTO, TransaccionResponseDTO } from "./api/types";

vi.mock("./api/client", () => ({
  actualizarCuenta: vi.fn(),
  crearCuenta: vi.fn(),
  crearGasto: vi.fn(),
  crearIngreso: vi.fn(),
  crearTransferencia: vi.fn(),
  listPendientes: vi.fn(),
  getResumenMensual: vi.fn(),
  listCuentas: vi.fn(),
  listCategorias: vi.fn(),
  listSubcategorias: vi.fn(),
}));

const listCuentasMock = vi.mocked(listCuentas);
const getResumenMensualMock = vi.mocked(getResumenMensual);
const crearGastoMock = vi.mocked(crearGasto);
const crearIngresoMock = vi.mocked(crearIngreso);
const crearTransferenciaMock = vi.mocked(crearTransferencia);
const actualizarCuentaMock = vi.mocked(actualizarCuenta);
const listPendientesMock = vi.mocked(listPendientes);
const listCategoriasMock = vi.mocked(listCategorias);
const listSubcategoriasMock = vi.mocked(listSubcategorias);

const account: CuentaResponseDTO = {
  id: "account-1",
  nombre: "Cuenta principal",
  saldoActual: 10000,
  tipo: "EFECTIVO",
  saldoInicial: 10000,
};
const destinationAccount: CuentaResponseDTO = {
  ...account,
  id: "account-2",
  nombre: "Billetera",
  saldoActual: 2500,
};

const categoriaTransporte: CategoriaResponseDTO = {
  id: "cat-transporte",
  nombre: "Transporte",
  icono: "CARRO",
  color: "AZUL",
  tipo: "GASTO",
  activa: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const categoriaSueldo: CategoriaResponseDTO = {
  id: "cat-sueldo",
  nombre: "Sueldo",
  icono: "LIBROS",
  color: "VERDE",
  tipo: "INGRESO",
  activa: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const summary: ResumenMensualDTO = {
  periodo: "2026-08",
  ingresos: 0,
  gastos: 0,
  ahorro: 0,
  margen: 0,
  gastosPorCategoria: [],
  disponibleLiquido: 10000,
  deudaTarjetas: 0,
};

const transaction: TransaccionResponseDTO = {
  id: "transaction-1",
  monto: -1250,
  moneda: "ARS",
  origen: "MANUAL",
  categoria: categoriaTransporte,
  fecha: "2026-08-03T00:00:00.000Z",
  estado: "CONFIRMADA",
  esTransferenciaAPersona: false,
  cuenta: { id: account.id, nombre: account.nombre, saldoActual: 8750 },
};

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("finnances.apiToken", "token-123");
  listCuentasMock.mockResolvedValue([account]);
  getResumenMensualMock.mockResolvedValue(summary);
  crearGastoMock.mockResolvedValue(transaction);
  listCategoriasMock.mockResolvedValue([categoriaTransporte]);
  listSubcategoriasMock.mockResolvedValue([]);
  crearTransferenciaMock.mockReset();
  actualizarCuentaMock.mockReset();
  listPendientesMock.mockResolvedValue([]);
});

describe("App expense form", () => {
  it("submits the complete manual expense payload", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));
    await user.type(screen.getByRole("spinbutton"), "1250");
    await user.click(screen.getByRole("button", { name: "Ayer" }));
    await user.selectOptions(screen.getByRole("combobox", { name: /Cuenta/ }), account.id);
    await user.click(screen.getByRole("button", { name: "Transporte" }));
    await user.type(screen.getByPlaceholderText("¿En qué fue?"), "Carga SUBE");
    await user.click(screen.getByRole("button", { name: "Registrar gasto" }));

    await waitFor(() => expect(crearGastoMock).toHaveBeenCalledOnce());
    expect(crearGastoMock).toHaveBeenCalledWith("token-123", expect.objectContaining({
      monto: "1250",
      cuentaId: "account-1",
      categoriaId: "cat-transporte",
      origen: "MANUAL",
      nota: "Carga SUBE",
      idempotencyKey: expect.any(String),
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
  });

  it("edits an account OCR entity from the account manager", async () => {
    const user = userEvent.setup();
    actualizarCuentaMock.mockResolvedValue({ ...account, nombreEntidad: "banco nuevo" });
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: "Administrar cuentas" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const entityInput = screen.getByRole("textbox", { name: "Entidad para OCR" });
    await user.clear(entityInput);
    await user.type(entityInput, "Banco Nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(actualizarCuentaMock).toHaveBeenCalledWith("token-123", account.id, { nombre: account.nombre, nombreEntidad: "Banco Nuevo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("actualizada");
  });

  it("submits a transfer with distinct accounts and note", async () => {
    const user = userEvent.setup();
    listCuentasMock.mockResolvedValue([account, destinationAccount]);
    crearTransferenciaMock.mockResolvedValue({
      id: "transfer-1",
      cuentaOrigen: { id: account.id, nombre: account.nombre, saldoActual: 8500 },
      cuentaDestino: { id: destinationAccount.id, nombre: destinationAccount.nombre, saldoActual: 4000 },
      monto: 1500,
      fecha: "2026-08-03T00:00:00.000Z",
      nota: "Ahorro",
    });
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: /Mis cuentas/ }));
    await user.click(screen.getByRole("button", { name: "Transferir" }));
    await user.type(screen.getByRole("spinbutton"), "1500");
    await user.type(screen.getByPlaceholderText("¿Para qué es?"), "Ahorro");
    await user.click(screen.getByRole("button", { name: "Transferir" }));

    await waitFor(() => expect(crearTransferenciaMock).toHaveBeenCalledOnce());
    expect(crearTransferenciaMock).toHaveBeenCalledWith("token-123", expect.objectContaining({
      cuentaOrigenId: account.id,
      cuentaDestinoId: destinationAccount.id,
      monto: "1500",
      nota: "Ahorro",
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      idempotencyKey: expect.any(String),
    }));
  });

  it("blocks a transfer above the available origin balance", async () => {
    const user = userEvent.setup();
    listCuentasMock.mockResolvedValue([account, destinationAccount]);
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: /Mis cuentas/ }));
    await user.click(screen.getByRole("button", { name: "Transferir" }));
    await user.type(screen.getByRole("spinbutton"), "10001");
    await user.click(screen.getByRole("button", { name: "Transferir" }));

    expect(crearTransferenciaMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("El monto supera el saldo disponible.");
  });

  it("preserves the transfer form when the backend rejects the balance", async () => {
    const user = userEvent.setup();
    listCuentasMock.mockResolvedValue([account, destinationAccount]);
    crearTransferenciaMock.mockRejectedValue(new Error("Saldo insuficiente para la transferencia"));
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: /Mis cuentas/ }));
    await user.click(screen.getByRole("button", { name: "Transferir" }));
    await user.type(screen.getByRole("spinbutton"), "9000");
    await user.type(screen.getByPlaceholderText("¿Para qué es?"), "No perder este dato");
    await user.click(screen.getByRole("button", { name: "Transferir" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saldo insuficiente para la transferencia");
    expect(screen.getByRole("spinbutton")).toHaveValue(9000);
    expect(screen.getByPlaceholderText("¿Para qué es?")).toHaveValue("No perder este dato");
  });
});

describe("App income form", () => {
  it("requires an income category before submitting", async () => {
    const user = userEvent.setup();
    listCategoriasMock.mockResolvedValue([categoriaSueldo]);
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));
    await user.type(screen.getByRole("spinbutton"), "250000");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));

    expect(crearIngresoMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Seleccioná una categoría");
  });

  it("submits an income with category and optional subcategory", async () => {
    const user = userEvent.setup();
    listCategoriasMock.mockResolvedValue([categoriaSueldo]);
    listSubcategoriasMock.mockResolvedValue([{
      id: "sub-sueldo-blanco",
      nombre: "Sueldo en blanco",
      categoriaId: "cat-sueldo",
      categoria: categoriaSueldo,
    }]);
    crearIngresoMock.mockResolvedValue({
      id: "income-1",
      monto: 250000,
      moneda: "ARS",
      fechaCobro: "2026-08-03T00:00:00.000Z",
      periodoDisponible: "2026-08",
      categoria: categoriaSueldo,
      cuenta: { id: account.id, nombre: account.nombre, saldoActual: 260000 },
    });
    render(<App />);

    await screen.findByText("Finnances");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));
    await user.type(screen.getByRole("spinbutton"), "250000");
    await user.click(screen.getByRole("button", { name: "Sueldo" }));
    await user.click(screen.getByRole("button", { name: "Sueldo en blanco" }));
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));

    await waitFor(() => expect(crearIngresoMock).toHaveBeenCalledOnce());
    expect(crearIngresoMock).toHaveBeenCalledWith("token-123", expect.objectContaining({
      monto: "250000",
      cuentaId: account.id,
      categoriaId: "cat-sueldo",
      subcategoriaId: "sub-sueldo-blanco",
      idempotencyKey: expect.any(String),
    }));
  });
});
