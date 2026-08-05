import type { ChangeEvent } from "react";
import type { CuentaResponseDTO } from "../api/types";

interface AccountSelectorProps {
  accounts: CuentaResponseDTO[];
  value: string;
  onChange: (accountId: string) => void;
}

function formatBalance(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AccountSelector({ accounts, value, onChange }: AccountSelectorProps) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="account-selector">
      <span>Cuenta</span>
      <select aria-label="Cuenta del gasto" value={value} onChange={handleChange} disabled={accounts.length === 0}>
        {accounts.length === 0 ? <option value="">No hay cuentas configuradas</option> : null}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.nombre} · {formatBalance(account.saldoActual)}
          </option>
        ))}
      </select>
    </label>
  );
}
