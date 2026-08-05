import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CuentaResponseDTO } from "../api/types";
import { AccountSelector } from "./AccountSelector";

const account: CuentaResponseDTO = {
  id: "account-1",
  nombre: "Cuenta principal",
  saldoActual: 12500,
  tipo: "EFECTIVO",
  saldoInicial: 12500,
};

describe("AccountSelector", () => {
  it("shows account balances and emits the selected account", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSelector accounts={[account, { ...account, id: "account-2", nombre: "Billetera", saldoActual: 4000 }]} value="account-1" onChange={onChange} />);

    expect(screen.getByRole("option", { name: /Cuenta principal/ })).toHaveTextContent(/12[.]500/);
    await user.selectOptions(screen.getByRole("combobox"), "account-2");
    expect(onChange).toHaveBeenCalledWith("account-2");
  });

  it("disables selection when there are no accounts", () => {
    render(<AccountSelector accounts={[]} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: "No hay cuentas configuradas" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
