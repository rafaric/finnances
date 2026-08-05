import type { ChangeEvent } from "react";

interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function MoneyInput({ value, onChange, autoFocus = false }: MoneyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="amount-field">
      <span>Monto</span>
      <div>
        <b>$</b>
        <input
          required
          inputMode="decimal"
          min="0.01"
          step="0.01"
          type="number"
          autoFocus={autoFocus}
          value={value}
          onChange={handleChange}
          placeholder="0"
        />
      </div>
    </label>
  );
}
