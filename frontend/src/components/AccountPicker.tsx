import type { CuentaResponseDTO } from "../api/types";

interface AccountPickerProps {
  accounts: CuentaResponseDTO[];
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
}

function currency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function AccountPicker({ accounts, value, onChange, disabled }: AccountPickerProps) {
  return (
    <label className="form-field account-picker-field">
      <span>Cuenta</span>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {accounts.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {currency(item.saldoActual)}</option>)}
      </select>
    </label>
  );
}
